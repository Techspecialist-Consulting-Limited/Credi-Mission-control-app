import { KpiRow } from "./kpi-row";
import { TicketRanking } from "./ticket-ranking";
import { ChartCard } from "./chart-card";
import { ExecutiveBriefing } from "./executive-briefing";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarChart } from "@/components/charts/bar-chart";
import type { ItView } from "@/lib/dashboard-data";

export function ItOverview({ data }: { data: ItView }) {
  return (
    <div className="flex flex-col gap-8">
      <KpiRow kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChartCard title="Tickets by department" subtitle="All logged tickets, any status" badge={`${data.byDepartment.length} departments`}>
            <BarChart
              categories={data.byDepartment.map((s) => s.label)}
              values={data.byDepartment.map((s) => s.value)}
              color="#5b7cfa"
              height={280}
              horizontal
            />
          </ChartCard>
        </div>
        <div className="lg:col-span-2">
          <ChartCard title="Tickets by category" subtitle="All logged tickets, any status">
            <DonutChart labels={data.byCategory.map((s) => s.label)} values={data.byCategory.map((s) => s.value)} />
          </ChartCard>
        </div>
      </div>

      <ExecutiveBriefing signals={data.signals} />

      <TicketRanking tickets={data.oldestOpen} />
    </div>
  );
}
