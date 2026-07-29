"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { useAiModal } from "./ai-modal-context";
import { cn } from "@/lib/utils";
import type { AiEvidence, AiFindings } from "@/lib/dashboard-data";

type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; findings: AiFindings | null; evidence?: AiEvidence };

const SEVERITY_DOT = { critical: "bg-destructive", watch: "bg-warning", good: "bg-primary" } as const;

/** Plain-text form of a structured finding, used only as conversation history sent back
 * to the agent - the model reasons over text, not over the rendered card markup. */
function findingsToText(findings: AiFindings): string {
  return [
    findings.summary,
    ...findings.priorities.map(
      (p) => `- [${p.severity}] ${p.title}: ${p.detail}${p.recommendation ? ` (Recommendation: ${p.recommendation})` : ""}`
    ),
  ].join("\n");
}

function FindingsView({ findings, evidence }: { findings: AiFindings; evidence?: AiEvidence }) {
  return (
    <div className="space-y-3">
      <p className="leading-relaxed">{findings.summary}</p>
      <ul className="space-y-2">
        {findings.priorities.map((p, i) => (
          <li key={i} className="flex items-start gap-2.5 rounded-lg border border-border bg-white p-3">
            <span className={cn("mt-1 size-2 shrink-0 rounded-full", SEVERITY_DOT[p.severity])} />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{p.title}</p>
              <p className="mt-0.5 text-secondary-foreground/80">{p.detail}</p>
              {p.recommendation && <p className="mt-1 font-medium text-ai-text">→ {p.recommendation}</p>}
            </div>
          </li>
        ))}
      </ul>
      {evidence && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[10.5px] text-secondary-foreground/70">
          {evidence.sources.length > 0 && <span>Source: {evidence.sources.join(", ")}</span>}
          {evidence.recordsAnalyzed > 0 && <span>Records analyzed: {evidence.recordsAnalyzed.toLocaleString()}</span>}
          <span>
            Updated{" "}
            {new Date(evidence.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      )}
    </div>
  );
}

/** Splits **bold** spans out of a line of text into styled fragments. */
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

type ContentBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "record"; lead: string; items: string[] };

/** Groups the model's markdown-ish plain text into paragraphs, bullet lists,
 * and "numbered item + its bullet details" records (the shape it reaches for
 * when listing rows like memos) - so raw markdown syntax never reaches the UI. */
function parseContentBlocks(content: string): ContentBlock[] {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const numbered = /^\d+[.)]\s+(.*)/.exec(line);
      if (numbered) return { kind: "numbered" as const, text: numbered[1] };
      const bullet = /^[-*•]\s+(.*)/.exec(line);
      if (bullet) return { kind: "bullet" as const, text: bullet[1] };
      const heading = /^#{1,6}\s+(.*)/.exec(line);
      return { kind: "text" as const, text: heading ? heading[1] : line };
    });

  const blocks: ContentBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const cur = lines[i];
    if (cur.kind === "numbered" || cur.kind === "bullet") {
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j].kind === "bullet") {
        items.push(lines[j].text);
        j++;
      }
      blocks.push(
        cur.kind === "numbered" ? { type: "record", lead: cur.text, items } : { type: "ul", items: [cur.text, ...items] }
      );
      i = j;
      continue;
    }
    blocks.push({ type: "p", text: cur.text });
    i++;
  }
  return blocks;
}

function MessageContent({ content }: { content: string }) {
  const blocks = parseContentBlocks(content);
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        if (block.type === "p") {
          return (
            <p key={i} className="leading-relaxed">
              {renderInline(block.text)}
            </p>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-4 marker:text-secondary-foreground/40">
              {block.items.map((item, j) => (
                <li key={j} className="leading-relaxed">
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <div key={i} className="rounded-lg border border-border bg-white p-2.5">
            <p className="font-medium leading-relaxed">{renderInline(block.lead)}</p>
            {block.items.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-secondary-foreground/80">
                {block.items.map((item, j) => (
                  <li key={j} className="leading-relaxed">
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AiModal() {
  const { isOpen, presetPrompt, close } = useAiModal();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const submittedPreset = useRef<string | null>(null);

  function handleClose() {
    close();
    setMessages([]);
    setError(null);
    setStatus("idle");
  }

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || status === "loading") return;

    const history = messages.map((m) => ({
      role: m.role,
      content: m.role === "assistant" && m.findings ? findingsToText(m.findings) : (m.content ?? ""),
    }));

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setStatus("loading");
    setError(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "The assistant couldn't answer that.");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: body.answer, findings: body.findings, evidence: body.evidence },
      ]);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  useEffect(() => {
    if (isOpen && presetPrompt && submittedPreset.current !== presetPrompt) {
      submittedPreset.current = presetPrompt;
      void ask(presetPrompt);
    }
    if (!isOpen) submittedPreset.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, presetPrompt]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="AI Executive Search"
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18, ease: [0.22, 0.68, 0, 1.2] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 py-4">
              <div className="flex items-center gap-2 text-ai-text">
                <Sparkles className="size-5" strokeWidth={2} />
                <span className="text-[13.5px] font-bold text-foreground">Barrister Craig — AI Executive Search</span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-1.5 text-secondary-foreground/80 transition-colors duration-150 hover:bg-secondary hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6 text-[13.5px]">
              {messages.length === 0 && (
                <div className="rounded-xl bg-secondary/60 p-3.5 text-foreground">
                  <p className="mb-1 font-semibold text-foreground">How can I help with executive decision-making today?</p>
                  <p className="text-secondary-foreground/80">
                    Ask about pending memos, compliance flags, or vendor status — every answer is grounded in live data.
                    Ask a follow-up any time; I remember this conversation.
                  </p>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "ml-8 rounded-xl bg-ai/10 p-3 text-right font-medium text-foreground"
                      : "mr-8 space-y-1.5 rounded-xl border border-border bg-secondary/40 p-3.5 text-foreground"
                  }
                >
                  {m.role === "assistant" && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-ai-text">
                      <Sparkles className="size-3.5" /> Barrister Craig AI
                    </div>
                  )}
                  {m.role === "assistant" && m.findings ? (
                    <FindingsView findings={m.findings} evidence={m.evidence} />
                  ) : (
                    <MessageContent content={m.content ?? ""} />
                  )}
                </div>
              ))}
              {status === "loading" && (
                <div className="mr-8 flex items-center gap-2 rounded-xl border border-border bg-secondary/40 p-3.5 text-secondary-foreground/80">
                  <Loader2 className="size-4 animate-spin" strokeWidth={2.5} /> Thinking…
                </div>
              )}
              {error && <p className="text-[13px] font-medium text-negative-text">{error}</p>}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(input);
              }}
              className="flex items-center gap-2 border-t border-border bg-white p-4"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question grounded on live data…"
                disabled={status === "loading"}
                className="min-w-0 flex-1 rounded-xl border border-border bg-secondary/60 px-4 py-2 text-[13px] text-foreground placeholder:text-secondary-foreground/80 focus:border-ai focus:outline-none focus-visible:ring-2 focus-visible:ring-ai/40 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!input.trim() || status === "loading"}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-ai px-4 py-2 text-[13px] font-semibold text-ai-foreground transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md disabled:pointer-events-none disabled:opacity-40"
              >
                Ask <Send className="size-3.5" strokeWidth={2.5} />
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
