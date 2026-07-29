import { CircleCheck } from "lucide-react";
import type { PressureItem } from "@/lib/dashboard-data";

const RANK_TONE = [
  "bg-destructive/10 text-negative-text",
  "bg-warning/10 text-caution-text",
  "bg-secondary text-secondary-foreground/80",
  "bg-secondary text-secondary-foreground/80",
];

const TRACK_TONE = ["bg-destructive", "bg-warning", "bg-secondary-foreground/30", "bg-secondary-foreground/30"];

export function PressureRanking({ items }: { items: PressureItem[] }) {
  const max = Math.max(...items.map((item) => item.count), 1);

  if (items.length === 0) {
    return (
      <section className="flex h-full flex-col items-center justify-center rounded-2xl border border-border bg-card px-8 py-14 text-center shadow-sm">
        <CircleCheck className="size-8 text-primary" strokeWidth={1.5} />
        <p className="mt-3 text-lg font-semibold text-foreground">Nothing needs attention</p>
        <p className="mt-1 text-sm text-secondary-foreground/80">Every dataset across CREDICORP is clear right now.</p>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground">Where the pressure is</h2>
          <p className="mt-0.5 text-[13px] text-secondary-foreground/80">Ranked by open volume, across every connected dataset</p>
        </div>
      </div>

      <ul className="mt-2 flex flex-col">
        {items.map((item, i) => (
          <li key={item.key} className={i > 0 ? "border-t border-border" : undefined}>
            <div className="-mx-2 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-secondary/40">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                    RANK_TONE[Math.min(i, RANK_TONE.length - 1)]
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-[13.5px] font-semibold text-foreground">{item.label}</h3>
                    <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-foreground">
                      {item.count.toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-secondary-foreground/80">
                    {item.states.map((s) => `${s.value.toLocaleString()} ${s.label.toLowerCase()}`).join(" · ")}
                  </p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full ${TRACK_TONE[Math.min(i, TRACK_TONE.length - 1)]}`}
                      style={{ width: `${Math.max(6, Math.round((item.count / max) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
