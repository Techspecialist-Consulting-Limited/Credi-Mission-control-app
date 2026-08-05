"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Renders **bold**, *italic*, "- " bullet lines and "#" headers as real
 * formatting instead of literal asterisks/hashes - the model is asked not to
 * use markdown, but LLMs don't always comply, so this is the guarantee. */
function renderInline(text: string, keyPrefix: string): ReactNode {
  return text.split(/(\*\*.+?\*\*)/g).map((part, i) => {
    const bold = /^\*\*(.+)\*\*$/.exec(part);
    if (bold) return <strong key={`${keyPrefix}-b${i}`}>{bold[1]}</strong>;
    const segments = part.split(/(\*.+?\*)/g);
    if (segments.length === 1) return part;
    return (
      <span key={`${keyPrefix}-s${i}`}>
        {segments.map((seg, j) => {
          const italic = /^\*(.+)\*$/.exec(seg);
          return italic ? <em key={`${keyPrefix}-i${i}-${j}`}>{italic[1]}</em> : seg;
        })}
      </span>
    );
  });
}

function renderMessage(content: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = (key: string) => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={key} style={{ margin: "2px 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
        {bullets.map((item, i) => (
          <li key={`${key}-${i}`} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <span style={{ flexShrink: 0 }}>•</span>
            <span>{renderInline(item, `${key}-${i}`)}</span>
          </li>
        ))}
      </ul>
    );
    bullets = [];
  };

  content.split("\n").forEach((rawLine, idx) => {
    const line = rawLine.trim();
    const bullet = /^[-*•]\s+(.*)/.exec(line);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }
    flushBullets(`ul-${idx}`);

    const heading = /^#{1,6}\s+(.*)/.exec(line);
    if (heading) {
      blocks.push(
        <div key={`h-${idx}`} style={{ fontWeight: 700, marginTop: idx === 0 ? 0 : 4 }}>
          {renderInline(heading[1], `h-${idx}`)}
        </div>
      );
    } else if (line.length === 0) {
      blocks.push(<div key={`sp-${idx}`} style={{ height: 4 }} />);
    } else {
      blocks.push(<div key={`p-${idx}`}>{renderInline(line, `p-${idx}`)}</div>);
    }
  });
  flushBullets("ul-end");

  return blocks;
}

export function AiWidget({
  open,
  onOpenChange,
  pendingQuestion,
  onPendingQuestionHandled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A specific, context-filled question queued up by a button elsewhere on
   * the page (e.g. "Explain this" on a domain card). Sent automatically the
   * moment the widget is open, so those buttons genuinely ask what they say
   * they'll ask instead of just popping open a blank chat. */
  pendingQuestion?: string | null;
  onPendingQuestionHandled?: () => void;
}) {
  const setOpen = onOpenChange;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: q }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history: messages }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setMessages([...nextMessages, { role: "assistant", content: data.answer }]);
      }
    } catch {
      setError("Couldn't reach Ada. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && pendingQuestion) {
      send(pendingQuestion);
      onPendingQuestionHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingQuestion]);

  return (
    <>
      {/* Sticky launcher */}
      {!open && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 200, width: 56, height: 56 }}>
          <span className="live-pulse-dot" style={{ position: "absolute", inset: 0, borderRadius: "50%", color: "#0F8A4B" }} />
          <button
            onClick={() => setOpen(true)}
            aria-label="Open Ada, your dashboard analyst"
            style={{
              position: "relative",
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#0F8A4B,#34D399)",
              border: "none",
              boxShadow: "0 8px 24px rgba(15, 138, 75,0.35)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              color: "white",
            }}
          >
            ✦
          </button>
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 200,
            width: "min(380px, calc(100vw - 32px))",
            height: "min(560px, calc(100vh - 48px))",
            background: "white",
            borderRadius: 16,
            boxShadow: "0 16px 48px rgba(10,14,26,0.22)",
            border: "1px solid rgba(10,14,26,0.08)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{ background: "#0F8A4B", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>✦</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "white", fontFamily: "Inter" }}>Ada</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", fontFamily: "Inter" }}>Your shortcut to a straight answer</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close Ada" style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, width: 26, height: 26, color: "white", cursor: "pointer", fontSize: 15 }}>
              ×
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10, background: "#F8FAFC" }}>
            {messages.length === 0 && (
              <div style={{ fontSize: 12.5, color: "#6B7A94", fontFamily: "Inter", lineHeight: 1.6 }}>
                Hi, I&rsquo;m Ada. Ask me anything about what&rsquo;s happening across the business — in plain language — and I&rsquo;ll always point you to the real number behind the answer.
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {["What needs my attention today?", "Which domain is most at risk?", "Summarise the lapsed approvals."].map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      style={{ textAlign: "left", fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "1px solid rgba(10,14,26,0.08)", background: "white", cursor: "pointer", fontFamily: "Inter", color: "#0A0E1A" }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                <div
                  style={{
                    background: m.role === "user" ? "#0F8A4B" : "white",
                    color: m.role === "user" ? "white" : "#1A2035",
                    border: m.role === "user" ? "none" : "1px solid rgba(10,14,26,0.08)",
                    borderRadius: 12,
                    padding: "9px 13px",
                    fontSize: 13,
                    lineHeight: 1.55,
                    fontFamily: "Inter",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {m.role === "assistant" ? renderMessage(m.content) : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: "flex-start", fontSize: 12, color: "#6B7A94", fontFamily: "Inter", padding: "9px 13px" }}>Thinking…</div>
            )}
            {error && (
              <div style={{ alignSelf: "flex-start", maxWidth: "85%", background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.18)", borderRadius: 10, padding: "9px 13px", fontSize: 12.5, color: "#B91C1C", fontFamily: "Inter" }}>
                {error}
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input) }}
            style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid rgba(10,14,26,0.07)", flexShrink: 0 }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Ada anything…"
              disabled={loading}
              style={{ flex: 1, border: "1px solid rgba(10,14,26,0.12)", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "Inter", outline: "none" }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{ background: "#0F8A4B", color: "white", border: "none", borderRadius: 8, padding: "0 16px", fontSize: 13, fontWeight: 600, fontFamily: "Inter", cursor: loading || !input.trim() ? "not-allowed" : "pointer", opacity: loading || !input.trim() ? 0.6 : 1 }}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
