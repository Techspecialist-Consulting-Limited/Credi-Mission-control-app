"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { ActivityDay } from "@/lib/dashboard-data";

const LEVEL_CLASS = ["bg-slate-800", "bg-emerald-900", "bg-emerald-600", "bg-emerald-400", "bg-emerald-300"];

function levelFor(count: number, max: number) {
  if (count <= 0) return 0;
  if (max <= 0) return 1;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
}

type Cell = ActivityDay | null;

export function ActivityHeatmap({
  series,
  onSelectDate,
}: {
  series: ActivityDay[];
  onSelectDate?: (date: string, count: number) => void;
}) {
  const [hover, setHover] = useState<{ date: string; count: number; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const { columns, max, monthLabels } = useMemo(() => {
    if (series.length === 0) {
      return { columns: [] as Cell[][], max: 0, monthLabels: [] as { col: number; label: string }[] };
    }

    const byDate = new Map(series.map((d) => [d.date, d.count]));
    const first = new Date(`${series[0].date}T00:00:00`);
    const last = new Date(`${series[series.length - 1].date}T00:00:00`);

    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay());

    const totalDays = Math.ceil((last.getTime() - start.getTime()) / 86_400_000) + 1;
    const totalCols = Math.ceil(totalDays / 7);

    const cols: Cell[][] = [];
    const labels: { col: number; label: string }[] = [];
    let lastMonth = -1;

    for (let c = 0; c < totalCols; c += 1) {
      const col: Cell[] = [];
      for (let r = 0; r < 7; r += 1) {
        const d = new Date(start);
        d.setDate(start.getDate() + c * 7 + r);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

        if (d < first || d > last) {
          col.push(null);
        } else {
          col.push({ date: key, count: byDate.get(key) ?? 0 });
          if (r === 0 && d.getMonth() !== lastMonth) {
            lastMonth = d.getMonth();
            labels.push({ col: c, label: d.toLocaleDateString("en-US", { month: "short" }) });
          }
        }
      }
      cols.push(col);
    }

    return { columns: cols, max: Math.max(1, ...series.map((d) => d.count)), monthLabels: labels };
  }, [series]);

  if (columns.length === 0) {
    return <p className="py-10 text-center text-[13px] text-slate-500">No activity recorded in this window.</p>;
  }

  return (
    <div className="relative space-y-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-4 text-slate-300">
      <div className="relative h-3 font-mono text-[9px] text-slate-500" style={{ width: columns.length * 14, marginLeft: 20 }}>
        {monthLabels.map(({ col, label }) => (
          <span key={col} className="absolute" style={{ left: col * 14 }}>
            {label}
          </span>
        ))}
      </div>
      <div className="flex items-start gap-2">
        <div className="flex h-[89px] flex-col justify-between py-px font-mono text-[9px] text-slate-500">
          <span>Mon</span>
          <span>Wed</span>
          <span>Fri</span>
        </div>
        <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
          {columns.map((col, c) =>
            col.map((cell, r) => {
              if (!cell) return <div key={`${c}-${r}`} className="size-3" />;
              const level = levelFor(cell.count, max);
              const isSelected = selected === cell.date;
              return (
                <button
                  key={`${c}-${r}`}
                  type="button"
                  className={cn(
                    "size-3 rounded-sm transition-all duration-150 hover:z-10 hover:scale-150 hover:ring-2 hover:ring-white",
                    LEVEL_CLASS[level],
                    isSelected && "scale-125 ring-2 ring-primary"
                  )}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHover({ date: cell.date, count: cell.count, x: rect.left, y: rect.top });
                  }}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => {
                    setSelected(cell.date);
                    onSelectDate?.(cell.date, cell.count);
                  }}
                  aria-label={`${cell.date}: ${cell.count} records logged`}
                />
              );
            })
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-[10px] text-slate-500">
        <span>Hover a cell for detail · click to filter the table below</span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          {LEVEL_CLASS.map((c, i) => (
            <span key={i} className={cn("size-3 rounded-sm", c)} />
          ))}
          <span>More</span>
        </div>
      </div>

      {hover && (
        <div
          className="pointer-events-none fixed z-50 space-y-1 rounded-xl border border-slate-700 bg-slate-900 p-3 text-[11px] text-white shadow-2xl"
          style={{ left: hover.x + 16, top: hover.y - 8 }}
        >
          <p className="font-bold text-emerald-400">{hover.date}</p>
          <p>{hover.count.toLocaleString()} records logged</p>
        </div>
      )}
    </div>
  );
}
