import { Scale, ShoppingBag, Workflow } from "lucide-react";
import type { PlatformCard } from "@/lib/dashboard-data";

const ICON = { credo: Workflow, compliance: Scale, procurement: ShoppingBag } as const;
const ICON_TONE = {
  credo: "bg-primary/10 text-primary",
  compliance: "bg-ai/10 text-ai",
  procurement: "bg-warning/10 text-warning",
} as const;

export function PlatformCards({ platforms }: { platforms: PlatformCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {platforms.map((platform) => {
        const Icon = ICON[platform.key];
        return (
          <div
            key={platform.key}
            className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${ICON_TONE[platform.key]}`}>
                <Icon className="size-[18px]" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15.5px] font-semibold tracking-tight text-foreground">{platform.name}</h3>
                <p className="mt-0.5 text-[12.5px] text-secondary-foreground/80">{platform.description}</p>
              </div>
            </div>

            <span
              className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold ${
                platform.statusTone === "attention" ? "bg-destructive/10 text-negative-text" : "bg-primary/10 text-positive-text"
              }`}
            >
              <span className={`size-1.5 rounded-full ${platform.statusTone === "attention" ? "bg-destructive" : "bg-primary"}`} />
              {platform.statusLabel}
            </span>

            <dl className="mt-4 flex flex-1 flex-col divide-y divide-border">
              {platform.metrics.map((metric) => (
                <div key={metric.label} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <dt className="text-[13px] text-secondary-foreground/80">{metric.label}</dt>
                  <dd
                    className={`text-[14px] font-semibold tabular-nums ${
                      metric.tone === "attention" ? "text-negative-text" : "text-foreground"
                    }`}
                  >
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
