import { CircleCheck } from "lucide-react";
import type { TicketRow } from "@/lib/dashboard-data";

export function TicketRanking({ tickets }: { tickets: TicketRow[] }) {
  if (tickets.length === 0) {
    return (
      <section className="flex h-full flex-col items-center justify-center rounded-2xl border border-border bg-card px-8 py-14 text-center shadow-sm">
        <CircleCheck className="size-8 text-primary" strokeWidth={1.5} />
        <p className="mt-3 text-lg font-semibold text-foreground">No open tickets</p>
        <p className="mt-1 text-sm text-secondary-foreground/80">Everything logged has moved past Open.</p>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-1">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">Oldest open tickets</h2>
        <p className="mt-0.5 text-[13px] text-secondary-foreground/80">Sorted by time open, longest first</p>
      </div>

      <ul className="mt-2">
        {tickets.map((ticket, i) => (
          <li key={ticket.ticketId} className={i > 0 ? "border-t border-border" : undefined}>
            <div className="-mx-2 flex items-center gap-4 rounded-lg px-2 py-3.5 transition-colors duration-150 hover:bg-secondary/40">
              <span className={`h-9 w-[3px] shrink-0 rounded-full ${i < 2 ? "bg-destructive" : "bg-secondary-foreground/30"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold tracking-tight text-foreground">
                  {ticket.ticketId} <span className="font-medium text-secondary-foreground/80">· {ticket.department}</span>
                </p>
                <p className="mt-0.5 truncate text-[12.5px] text-secondary-foreground/80">
                  {ticket.category} · opened {ticket.openedDate}
                </p>
              </div>
              <p className={`shrink-0 text-[13px] font-semibold ${i < 2 ? "text-negative-text" : "text-secondary-foreground/80"}`}>
                {ticket.age}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
