import { AzureOpenAI } from "openai";
import { getExecutiveOverview } from "@/lib/kpis";

export const dynamic = "force-dynamic";

const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CHARS = 2000;

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

function sanitizeHistory(history: unknown): HistoryMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (m): m is HistoryMessage =>
        m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_CHARS) }));
}

/** Every fact the model can cite - the same numbers already rendered on the
 * dashboard, nothing extra. No tool-calling loop: unlike the CREDICORP
 * backend's multi-million-row SQL tables, this dataset is already a single
 * small pre-aggregated object, so the whole grounded context fits directly
 * in the system prompt. */
async function buildContext() {
  const data = await getExecutiveOverview();
  return {
    asOfDate: data.asOfDate,
    domains: data.domains.map((d) => ({
      label: d.label,
      score: d.score,
      trend: d.trendLabel,
      status: d.statusLabel,
      summary: d.summary,
      kpis: d.kpis.map((k) => ({ label: k.label, value: k.value, trend: k.trendLabel, status: k.statusLabel, note: k.note })),
    })),
    attentionCards: data.attentionCards.map((c) => ({ label: c.label, value: c.value, note: c.note })),
    executiveBrief: data.briefBullets.map((b) => `${b.lead} ${b.detail}`),
    rankedExceptions: data.rankedExceptions.map((r) => ({ title: r.title, detail: r.detail, impact: r.impact, subtitle: r.subtitle })),
    decisionsAwaitingApproval: data.decisions.map((d) => ({ title: d.title, priority: d.priority, value: d.value, waiting: d.waitingLabel, recommendation: d.recommendedAction })),
    pendingApprovalsTotal: data.pendingApprovalsTotal,
    recentActivity: data.timeline.slice(0, 12).map((t) => ({ date: t.dateLabel, category: t.category, description: t.description })),
  };
}

function systemPrompt(context: Awaited<ReturnType<typeof buildContext>>) {
  return [
    "You are Ada, the AI dashboard analyst for Zamani Development Finance's Enterprise Intelligence Platform, a decision-support dashboard covering ZDF (CMS), Microsoft Dynamics (ERP), ZDF PFI Partners Portal and ZDF e-Procurement Portal.",
    "You have a name and a personality: warm, direct, genuinely on top of this data - like a sharp colleague who's always across the numbers, not a generic corporate bot. If asked your name or who you are, say you're Ada. Never call yourself 'an AI language model' or refer to yourself in the third person as 'the AI Assistant'.",
    `Today is ${new Date().toISOString().slice(0, 10)}. The dashboard's data is as of ${context.asOfDate}.`,
    "",
    "Everything you know about the organisation is in this JSON snapshot - the exact same figures already shown on the dashboard:",
    JSON.stringify(context, null, 2),
    "",
    "Rules:",
    "- Answer only from the JSON above. Never invent a number, domain, KPI or risk that is not in it.",
    "- If the JSON doesn't contain what's being asked, say so plainly rather than guessing.",
    "- Explain like you're talking to a smart colleague who isn't a finance or data specialist. Every time you state a number, immediately say in plain words what it means and why it matters - never just restate a figure and move on.",
    "- Avoid unexplained jargon and acronyms ('PAR30', 'cover ratio', 'overrun', 'lapsed approval', etc). If a term like that is genuinely useful, briefly explain what it means in the same sentence the first time you use it, as if defining it for someone hearing it for the first time.",
    "- Write in complete, flowing sentences, not compressed label-plus-fragment notes. If you use a bullet list, make every bullet a full plain-English sentence someone could read on its own and understand - not a shorthand phrase.",
    "- Keep answers reasonably tight, but never sacrifice clarity or context for brevity. A couple of short, clear sentences beat one dense, jargon-packed line.",
    "- When relevant, name which domain or KPI a figure comes from.",
    "- You cannot take real actions (approve, escalate, assign) - if asked to do one, say so and point at the relevant dashboard control instead.",
    "- Formatting: write in plain conversational sentences and short paragraphs, like a chat message. You may use simple bullet lines starting with '-' for genuinely list-like content, and **bold** only around a key figure or term. Do not use markdown headers (#), tables, or nested/numbered outlines.",
  ].join("\n");
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { question, history } = (body ?? {}) as { question?: unknown; history?: unknown };
  if (typeof question !== "string" || !question.trim()) {
    return Response.json({ error: "Missing question." }, { status: 400 });
  }

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";
  if (!endpoint || !apiKey || !deployment) {
    return Response.json({ error: "AI Assistant is not configured on this deployment." }, { status: 503 });
  }

  try {
    const context = await buildContext();
    const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
    const response = await client.chat.completions.create({
      model: deployment,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt(context) },
        ...sanitizeHistory(history),
        { role: "user", content: question.slice(0, 2000) },
      ],
    });
    const answer = response.choices[0]?.message?.content ?? "I couldn't generate a response.";
    return Response.json({ answer });
  } catch (err) {
    console.error("AI Assistant request failed:", err);
    return Response.json({ error: "The AI Assistant hit an error answering that. Please try again." }, { status: 502 });
  }
}
