"use client";

import { Sparkles, ArrowRight } from "lucide-react";
import { useAiModal } from "@/components/shell/ai-modal-context";
import type { Signal } from "@/lib/dashboard-data";

const DOT_TONE = { watch: "bg-warning", info: "bg-ai", good: "bg-primary" } as const;

const BRIEFING_PROMPT =
  "Give me a concise executive briefing across Credo memos, Barrister Craig compliance, and the Procurement Portal.";

export function ExecutiveBriefing({ signals }: { signals: Signal[] }) {
  const { open } = useAiModal();
  const half = Math.ceil(signals.length / 2);
  const left = signals.slice(0, half);
  const right = signals.slice(half);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-transparent bg-white p-6 shadow-sm"
      style={{
        backgroundImage:
          "linear-gradient(white, white), linear-gradient(135deg, rgba(91,124,250,0.4), rgba(39,174,96,0.3))",
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
      }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-ai/10 p-2 text-ai">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Executive Briefing</h3>
            <p className="text-[11px] text-secondary-foreground/80">
              Computed from live data across Credo, Barrister Craig &amp; the Procurement Portal
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => open(BRIEFING_PROMPT)}
          className="flex items-center gap-1 text-xs font-semibold text-ai-text hover:underline"
        >
          Ask AI Assistant <ArrowRight className="size-3.5" />
        </button>
      </div>

      {signals.length === 0 ? (
        <p className="text-xs text-secondary-foreground/80">
          Nothing needs attention right now — every connected platform is clear.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs text-foreground md:grid-cols-2">
          <div className="space-y-2.5">
            {left.map((s, i) => (
              <p key={i} className="flex items-start gap-2">
                <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${DOT_TONE[s.tone]}`} />
                <span>
                  <strong className="font-semibold">{s.title}.</strong> {s.body}
                </span>
              </p>
            ))}
          </div>
          {right.length > 0 && (
            <div className="space-y-2.5 md:border-l md:border-border md:pl-4">
              {right.map((s, i) => (
                <p key={i} className="flex items-start gap-2">
                  <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${DOT_TONE[s.tone]}`} />
                  <span>
                    <strong className="font-semibold">{s.title}.</strong> {s.body}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
