import { Activity } from "lucide-react";
import type { ActivityItem } from "@/lib/dashboard-data";

export function ActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-secondary-foreground/80">No recent activity.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item, i) => (
        <li key={i} className="-mx-2 first:-mt-0">
          <div className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors duration-150 hover:bg-secondary/40">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground/70">
              <Activity className="size-3.5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-foreground">{item.title}</p>
              <p className="truncate text-[12px] text-secondary-foreground/80">{item.meta}</p>
            </div>
            <span className="shrink-0 text-[11.5px] font-medium text-secondary-foreground/70">{item.when}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
