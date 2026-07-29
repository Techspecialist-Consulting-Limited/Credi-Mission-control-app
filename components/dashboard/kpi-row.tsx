"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  FileClock,
  ShieldAlert,
  Truck,
  Wallet,
  Ticket,
  Gauge,
  Building2,
  Activity,
  Layers,
  TrendingUp,
} from "lucide-react";
import type { Kpi } from "@/lib/dashboard-data";

const ICON = {
  clock: FileClock,
  shield: ShieldAlert,
  truck: Truck,
  wallet: Wallet,
  ticket: Ticket,
  gauge: Gauge,
  building: Building2,
  activity: Activity,
  layers: Layers,
  trending: TrendingUp,
} as const;

function TrendBadge({ trend, context }: { trend: Kpi["trend"]; context: string | null }) {
  if (!trend) return null;

  if (trend.current === 0 && trend.previous === 0) {
    return <p className="mt-3 text-[13px] font-medium text-secondary-foreground/80">No change in the last 30 days</p>;
  }

  const Icon = trend.direction === "up" ? ArrowUpRight : trend.direction === "down" ? ArrowDownRight : Minus;
  const colorClass =
    trend.direction === "down"
      ? "text-positive-text"
      : trend.direction === "up"
        ? "text-negative-text"
        : "text-secondary-foreground/80";

  return (
    <p className={`mt-3 flex items-center gap-1 text-[13px] font-medium ${colorClass}`}>
      <Icon className="size-3.5 shrink-0" strokeWidth={2.5} />
      {trend.percentChange !== null ? (
        <span>
          {Math.abs(trend.percentChange)}% {context}
        </span>
      ) : (
        <span>
          {trend.current} {context} (from {trend.previous})
        </span>
      )}
    </p>
  );
}

/** Animates a plain integer (e.g. "48", "1,432") from 0 on first view. Anything with
 * currency symbols, percent signs, or units is rendered statically - counting up a
 * formatted string like "₦251.8m" would require re-deriving the raw number and risks
 * showing a wrong intermediate value. */
function useCountUpText(value: string, ref: React.RefObject<HTMLElement | null>): string {
  const isPlainInteger = /^-?[\d,]+$/.test(value);
  const target = isPlainInteger ? Number(value.replace(/,/g, "")) : null;
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const [display, setDisplay] = useState(isPlainInteger ? "0" : value);

  useEffect(() => {
    if (target === null) return;
    if (!inView) return;

    const duration = 700;
    const start = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(eased * target).toLocaleString());
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, target]);

  return target === null ? value : display;
}

function KpiValue({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const display = useCountUpText(value, ref);
  return (
    <span ref={ref} className="tabular-nums">
      {display}
    </span>
  );
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export function KpiRow({ kpis }: { kpis: Kpi[] }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px" }}
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
    >
      {kpis.map((kpi) => {
        const Icon = ICON[kpi.icon];
        return (
          <motion.div
            key={kpi.key}
            variants={item}
            className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2.5">
              <p className="text-[13px] font-semibold leading-snug text-secondary-foreground/80">{kpi.label}</p>
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                  kpi.tone === "attention" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                }`}
              >
                <Icon className="size-4" strokeWidth={2} />
              </span>
            </div>

            <p className="mt-4 text-[32px] font-bold leading-none tracking-tight text-foreground">
              <KpiValue value={kpi.value} />
            </p>
            <p className="mt-2 text-[13px] font-medium text-secondary-foreground/80">{kpi.sublabel}</p>

            <TrendBadge trend={kpi.trend} context={kpi.trendContext} />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
