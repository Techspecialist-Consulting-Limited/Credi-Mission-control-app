"use client";

import { useState } from "react";
import { KpiRow } from "./kpi-row";
import { ChartCard } from "./chart-card";
import { PressureRanking } from "./pressure-ranking";
import { ActivityList } from "./activity-list";
import { Gauge } from "./gauge";
import { ActivityHeatmap } from "./activity-heatmap";
import { DonutChart } from "@/components/charts/donut-chart";
import { LineChart } from "@/components/charts/line-chart";
import { colorsFor } from "@/lib/status-colors";
import type { OpsTelemetry } from "@/lib/dashboard-data";

export function MissionControlDetail({ data }: { data: OpsTelemetry }) {
  const [selectedDay, setSelectedDay] = useState<{ date: string; count: number } | null>(null);
  const allClear = data.servicePressure.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-secondary-foreground/80">
          Real-time operational telemetry across Credo, Barrister Craig and the Procurement Portal.
        </p>
        <span
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
            allClear ? "border-primary/20 bg-primary/10 text-positive-text" : "border-warning/20 bg-warning/10 text-caution-text"
          }`}
        >
          <span className={`size-2 rounded-full ${allClear ? "animate-pulse bg-primary" : "bg-warning"}`} />
          {allClear ? "All datasets clear" : `${data.servicePressure.length} dataset${data.servicePressure.length === 1 ? "" : "s"} need attention`}
        </span>
      </div>

      <KpiRow kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h4 className="mb-4 text-sm font-bold text-foreground">Support Quality Scores</h4>
          <div className="space-y-4">
            {data.gauges.map((g) => (
              <Gauge key={g.key} label={g.label} value={g.value} detail={g.detail} tone={g.tone} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h4 className="mb-1 text-sm font-bold text-foreground">Ticket Volume Trend</h4>
          <p className="mb-3 text-[11px] text-secondary-foreground/80">Tickets logged per week, last 4 months</p>
          <LineChart
            categories={data.ticketTrend.map((p) => new Date(p.label).toLocaleDateString("en-GB", { day: "numeric", month: "short" }))}
            values={data.ticketTrend.map((p) => p.value)}
            height={176}
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h4 className="mb-1 text-sm font-bold text-foreground">Ticket Status Breakdown</h4>
          <p className="mb-3 text-[11px] text-secondary-foreground/80">Every logged ticket</p>
          <DonutChart
            labels={data.ticketStatus.map((s) => s.label)}
            values={data.ticketStatus.map((s) => s.value)}
            colors={colorsFor(data.ticketStatus.map((s) => s.label))}
            height={176}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PressureRanking items={data.servicePressure} />
        </div>
        <div className="lg:col-span-2">
          <ChartCard title="12-Month Activity Heatmap" subtitle="Records logged per day, across every connected dataset">
            {selectedDay && (
              <div className="mb-3 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[11.5px]">
                <span className="font-semibold text-positive-text">
                  {selectedDay.date} — {selectedDay.count.toLocaleString()} records
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="text-[10.5px] font-semibold text-secondary-foreground/70 hover:text-secondary-foreground"
                >
                  Clear
                </button>
              </div>
            )}
            <ActivityHeatmap series={data.heatmap} onSelectDate={(date, count) => setSelectedDay({ date, count })} />
          </ChartCard>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">Recent cross-platform activity</h2>
        <p className="mt-0.5 text-[13px] text-secondary-foreground/80">Latest records across every connected dataset</p>
        <div className="mt-3">
          <ActivityList items={data.activity} />
        </div>
      </section>
    </div>
  );
}
