import { KpiRow } from "./kpi-row";
import { ChartCard } from "./chart-card";
import { ExecutiveBriefing } from "./executive-briefing";
import { PlatformCards } from "./platform-cards";
import { ExecutiveInfoGrid } from "./executive-info-grid";
import { LineChart } from "@/components/charts/line-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { nairaCompact } from "@/lib/dashboard-data";
import type { MdView } from "@/lib/dashboard-data";

export function MdOverview({ data }: { data: MdView }) {
  return (
    <div className="flex flex-col gap-8">
      <KpiRow kpis={data.kpis} />

      <div className="flex flex-col gap-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/80">Platform overview</h2>
        <PlatformCards platforms={data.platforms} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChartCard title="Memos submitted, last 4 months" subtitle="Weekly volume across every department">
            <LineChart
              categories={data.submissionTrend.map((p) =>
                new Date(p.label).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
              )}
              values={data.submissionTrend.map((p) => p.value)}
              height={230}
            />
          </ChartCard>
        </div>
        <div className="lg:col-span-2">
          <ChartCard title="Approved value by department" subtitle="Sum of approved memos">
            <BarChart
              categories={data.approvedByDepartment.map((p) => p.label)}
              values={data.approvedByDepartment.map((p) => p.value)}
              height={230}
              horizontal
              valueFormatter={nairaCompact}
            />
          </ChartCard>
        </div>
      </div>

      <ExecutiveBriefing signals={data.signals} />

      <div className="flex flex-col gap-4 pb-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/80">
          At a glance
        </h2>
        <ExecutiveInfoGrid
          cards={[data.infoCards.recentActivity, data.infoCards.workflowDelays, data.infoCards.complianceFlags, data.infoCards.highPriority]}
        />
      </div>
    </div>
  );
}
