import { KpiRow } from "./kpi-row";
import { ChartCard } from "./chart-card";
import { PressureRanking } from "./pressure-ranking";
import { ExecutiveBriefing } from "./executive-briefing";
import { BarChart } from "@/components/charts/bar-chart";
import type { StrategyView } from "@/lib/dashboard-data";

export function StrategyOverview({ data }: { data: StrategyView }) {
  return (
    <div className="flex flex-col gap-8">
      <KpiRow kpis={data.kpis} />

      <ChartCard title="Records needing attention, by dataset" subtitle="Ranked by open volume across every connected platform">
        <BarChart
          categories={data.pressure.map((p) => p.label)}
          values={data.pressure.map((p) => p.count)}
          color="#5b7cfa"
          height={260}
          horizontal
        />
      </ChartCard>

      <ExecutiveBriefing signals={data.signals} />

      <PressureRanking items={data.pressure} />
    </div>
  );
}
