import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InfoCard } from "@/lib/dashboard-data";

function InfoCardView({ card }: { card: InfoCard }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md">
      <h3 className="text-[13px] font-bold tracking-tight text-foreground">{card.title}</h3>

      <ul className="mt-3 flex-1 divide-y divide-border">
        {card.rows.length === 0 ? (
          <li className="py-6 text-center text-[12px] text-secondary-foreground/70">{card.emptyLabel}</li>
        ) : (
          card.rows.map((row) => (
            <li key={row.key} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-[12.5px] font-semibold text-foreground">{row.primary}</p>
                <span
                  className={cn(
                    "shrink-0 text-[12px] font-semibold tabular-nums",
                    row.tone === "attention" ? "text-negative-text" : "text-foreground"
                  )}
                >
                  {row.value}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-secondary-foreground/70">{row.secondary}</p>
            </li>
          ))
        )}
      </ul>

      <Link
        href={card.viewAllHref}
        className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-ai-text hover:underline"
      >
        {card.viewAllLabel} <ArrowRight className="size-3" strokeWidth={2.5} />
      </Link>
    </div>
  );
}

export function ExecutiveInfoGrid({ cards }: { cards: InfoCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <InfoCardView key={card.title} card={card} />
      ))}
    </div>
  );
}
