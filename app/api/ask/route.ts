import { NextResponse } from "next/server";
import { askAssistant, type AiMessage } from "@/lib/dashboard-data";

function sanitizeHistory(value: unknown): AiMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (m): m is AiMessage =>
      Boolean(m) && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const history = sanitizeHistory(body?.history);

  if (!question) {
    return NextResponse.json({ error: "A question is required." }, { status: 400 });
  }

  try {
    const result = await askAssistant(question, history);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The assistant couldn't answer that." },
      { status: 502 }
    );
  }
}
