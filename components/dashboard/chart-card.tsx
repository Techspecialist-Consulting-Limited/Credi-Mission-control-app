import type { ReactNode } from "react";

export function ChartCard({ title, subtitle, badge, children }: { title: string; subtitle?: string; badge?: string; children: ReactNode }) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-secondary-foreground/80">{subtitle}</p>}
        </div>
        {badge && (
          <span className="shrink-0 rounded-md bg-secondary px-2.5 py-1 text-[11.5px] font-semibold text-secondary-foreground/80">
            {badge}
          </span>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}
