"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Gauge as GaugeData } from "@/lib/dashboard-data";

const BAR_TONE = { default: "bg-primary", attention: "bg-warning" } as const;
const VALUE_TONE = { default: "text-positive-text", attention: "text-caution-text" } as const;

export function Gauge({ label, value, detail, tone }: GaugeData) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="text-secondary-foreground/80">{label}</span>
        <span className={cn("font-bold tabular-nums", VALUE_TONE[tone])}>{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <motion.div
          className={cn("h-full rounded-full", BAR_TONE[tone])}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-secondary-foreground/70">{detail}</p>
    </div>
  );
}
