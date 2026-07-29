import { KpiRow } from "./kpi-row";
import { VendorList } from "./vendor-list";
import { ChartCard } from "./chart-card";
import { ExecutiveBriefing } from "./executive-briefing";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarChart } from "@/components/charts/bar-chart";
import type { ProcurementView } from "@/lib/dashboard-data";

const STATUS_COLORS = ["#27ae60", "#ef4444", "#f59e0b"];

export function ProcurementOverview({ data }: { data: ProcurementView }) {
  return (
    <div className="flex flex-col gap-8">
      <KpiRow kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChartCard title="Vendors by state" subtitle="Every registered vendor, by Nigerian state" badge={`${data.byState.length} states`}>
            <BarChart
              categories={data.byState.map((s) => s.label)}
              values={data.byState.map((s) => s.value)}
              color="#f59e0b"
              height={280}
              horizontal
            />
          </ChartCard>
        </div>
        <div className="lg:col-span-2">
          <ChartCard title="Vendors by status" subtitle="Every registered vendor">
            <DonutChart
              labels={data.byStatus.map((s) => s.label)}
              values={data.byStatus.map((s) => s.value)}
              colors={STATUS_COLORS}
            />
          </ChartCard>
        </div>
      </div>

      <ExecutiveBriefing signals={data.signals} />

      <VendorList vendors={data.needingReview} />
    </div>
  );
}
