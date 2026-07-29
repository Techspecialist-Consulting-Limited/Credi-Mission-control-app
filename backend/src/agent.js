import { AzureOpenAI } from 'openai';
import { config, assertOpenAIConfigured } from './config.js';
import { toolDefinitions, runTool, describeCatalogForRole } from './tools.js';
import { AccessDeniedError } from './permissions.js';
import { isSynthetic } from './datasource/index.js';

const MAX_TOOL_ROUNDS = 6;

// Conversation memory is client-supplied (this prototype has no session store),
// so it is capped hard here regardless of what the caller sends - both to
// bound token cost and because a system/tool role smuggled into "history"
// would otherwise inject instructions ahead of the real system prompt.
const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CHARS = 2000;

let client = null;
function getClient() {
  assertOpenAIConfigured();
  client ??= new AzureOpenAI({
    endpoint: config.openai.endpoint,
    apiKey: config.openai.apiKey,
    apiVersion: config.openai.apiVersion,
    deployment: config.openai.deployment,
  });
  return client;
}

/** Keep only well-formed {role: user|assistant, content} pairs, trimmed and capped. */
export function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_CHARS) }));
}

function systemPrompt(role, catalog, synthetic) {
  return [
    'You are the analytics assistant for the CREDICORP executive dashboard.',
    // Without this the model anchors on its training cutoff and reads "this
    // year" as a year with no data in it.
    `Today is ${new Date().toISOString().slice(0, 10)}. Resolve relative dates ("this year", "last quarter") against that.`,
    `The caller's role is "${role}". You may only reason about the datasets listed below.`,
    '',
    catalog,
    '',
    'Rules:',
    '- Answer only from tool results. Never invent numbers, dataset names or column names.',
    '- If a tool reports an access denial, tell the user their role is not permitted to see that data. Do not attempt a different route to the same data.',
    '- If no tool can answer the question, say so plainly.',
    '- Prefer aggregate_metric over sample_records for questions about value or totals.',
    '- Use compare_periods when the question implies a direction ("up", "down", "growing", "vs last month").',
    '- Be concise and quantitative. Lead with the number, then one line of context.',
    '- For a broad request - a briefing, "what needs attention", explaining a KPI, a board summary, or anything spanning ' +
      'more than one dataset - call organisation_pulse and/or the relevant per-dataset tools across ALL datasets you can ' +
      'see, not just the one the question happens to name, then finish with present_findings rather than prose.',
    '- For a single direct factual question (a count, a specific value, a yes/no), just answer in plain text - do not ' +
      'force present_findings where one number will do.',
    '- Earlier turns in this conversation may already answer part of a follow-up question ("which department", ' +
      '"compare with last month", "only Finance") - read them before deciding which tool to call.',
    "- organisation_pulse's financialExposure and totalRecords are totals across EVERY record in a dataset, not just " +
      'the ones needing attention - it has no per-subset value at all. Before writing a monetary figure into a finding ' +
      'about a specific subset (e.g. "pending" memos), check: did a tool call return that number filtered to that exact ' +
      'subset? If not, either call aggregate_metric with that filter first, or state the count alone with no monetary ' +
      'figure - never attach organisation_pulse\'s overall total to a subset-specific finding.',
    ...(synthetic
      ? ['- The data source is a SYNTHETIC stand-in, not the real lakehouse. End every answer with a one-line note saying the figures are demo data.']
      : []),
  ].join('\n');
}

/** Dataset names actually queried, and total records actually touched - computed
 * from the real trace, never asked of the model, so the Evidence panel can't
 * be talked into a number that sounds right but isn't traceable.
 *
 * organisation_pulse is the one tool with no single `table` arg - it queries
 * every accessible dataset internally and lists them in `result.datasets`, so
 * it needs its own read instead of the generic args.table lookup below. */
function evidenceFrom(trace) {
  const sourceSet = new Set();
  let recordsAnalyzed = 0;

  for (const t of trace) {
    if (!t.ok || !t.result) continue;

    if (t.tool === 'organisation_pulse') {
      for (const d of t.result.datasets ?? []) sourceSet.add(d.dataset);
      recordsAnalyzed += t.result.headline?.totalRecords ?? 0;
      continue;
    }

    if (t.args?.table) sourceSet.add(t.args.table);
    recordsAnalyzed += typeof t.result.total === 'number' ? t.result.total : Array.isArray(t.result.rows) ? t.result.rows.length : 0;
  }

  return { sources: [...sourceSet], recordsAnalyzed, generatedAt: new Date().toISOString() };
}

/** The full trace (with tool results) is only needed internally to compute evidence -
 * shipping raw tool payloads back to the client a second time is pure waste. */
const publicTrace = (trace) => trace.map(({ tool, args, denied, ok }) => ({ tool, args, denied, ok }));

function finalize(fields, trace) {
  return { findings: null, ...fields, trace: publicTrace(trace), evidence: evidenceFrom(trace) };
}

/**
 * Function-calling loop: question + role + prior turns in, resolved answer out.
 *
 * Returns either a plain-text `answer` (simple factual questions) or a
 * structured `findings` object (broad questions, via the present_findings
 * tool) - never both - plus a trace of which tools ran and evidence computed
 * from that trace, so the dashboard can show real provenance rather than an
 * unsourced figure or a self-reported one.
 */
export async function ask(question, role, history = []) {
  const openai = getClient();
  const catalog = await describeCatalogForRole(role);
  const synthetic = await isSynthetic();

  const messages = [
    { role: 'system', content: systemPrompt(role, catalog, synthetic) },
    ...sanitizeHistory(history),
    { role: 'user', content: question },
  ];
  const trace = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await openai.chat.completions.create({
      model: config.openai.deployment,
      messages,
      tools: toolDefinitions,
      tool_choice: 'auto',
      temperature: 0,
    });

    const choice = response.choices[0].message;
    messages.push(choice);

    const calls = choice.tool_calls ?? [];
    if (calls.length === 0) {
      return finalize({ answer: choice.content ?? '', role }, trace);
    }

    const finalCall = calls.find((call) => call.function.name === 'present_findings');
    if (finalCall) {
      let findings = null;
      try {
        findings = JSON.parse(finalCall.function.arguments || '{}');
      } catch {
        // Fall through with findings null; treated as a soft failure below.
      }
      if (findings) {
        return finalize({ answer: null, findings, role }, trace);
      }
    }

    for (const call of calls) {
      if (call.function.name === 'present_findings') continue; // handled above, or malformed - either way, not a data tool

      let args = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        // Malformed arguments are the model's problem to fix; hand it back.
      }

      let payload;
      let denied = false;
      try {
        payload = await runTool(call.function.name, args, role);
      } catch (error) {
        denied = error instanceof AccessDeniedError;
        payload = { error: error.message, denied };
      }

      trace.push({ tool: call.function.name, args, denied, ok: !payload?.error, result: payload });
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(payload),
      });
    }
  }

  return finalize(
    { answer: 'I could not resolve that within the allowed number of data lookups.', role, truncated: true },
    trace
  );
}
