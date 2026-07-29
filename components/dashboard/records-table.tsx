import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type RecordColumn<T> = {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
};

/** A compact, scannable table for a "recent N of TOTAL" preview - real column
 * headers instead of a stacked list, so structured records (a memo, a ticket,
 * a query) read at a glance instead of needing to be parsed out of one line
 * of prose per row. */
export function RecordsTable<T>({
  columns,
  rows,
  rowKey,
  total,
  emptyLabel,
}: {
  columns: RecordColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  total?: number;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-[13.5px] text-secondary-foreground/80">{emptyLabel}</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "whitespace-nowrap pb-2.5 pr-5 text-[10.5px] font-bold uppercase tracking-wide text-secondary-foreground/60 last:pr-0",
                    col.align === "right" ? "text-right" : "text-left"
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="transition-colors duration-150 hover:bg-secondary/40">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("py-3 pr-5 align-middle last:pr-0", col.align === "right" ? "text-right" : "text-left")}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {typeof total === "number" && total > rows.length && (
        <p className="mt-3 text-[11.5px] text-secondary-foreground/60">
          Showing the latest {rows.length} of {total.toLocaleString()}.
        </p>
      )}
    </div>
  );
}
