import { KpiRow } from "./kpi-row";
import { ChartCard } from "./chart-card";
import { RecordsTable, type RecordColumn } from "./records-table";
import { StatusPill } from "./status-pill";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { colorsFor } from "@/lib/status-colors";
import type { BarristerCraigData } from "@/lib/platform-data";

const columns: RecordColumn<BarristerCraigData["recentHighRisk"][number]>[] = [
  {
    key: "queryText",
    label: "Query",
    render: (row) => <span className="font-semibold text-foreground">{row.queryText}</span>,
  },
  { key: "sourceReference", label: "Source", render: (row) => row.sourceReference },
  { key: "riskFlag", label: "Risk", render: (row) => <StatusPill status={row.riskFlag} /> },
  { key: "loggedDate", label: "Logged", render: (row) => <span className="text-secondary-foreground/70">{row.loggedDate}</span> },
];

export function BarristerCraigDetail({ data }: { data: BarristerCraigData }) {
  return (
    <div className="flex flex-col gap-8">
      <KpiRow kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ChartCard title="Queries by risk level" subtitle="Every logged audit entry">
            <DonutChart
              labels={data.riskBreakdown.map((s) => s.label)}
              values={data.riskBreakdown.map((s) => s.value)}
              colors={colorsFor(data.riskBreakdown.map((s) => s.label))}
            />
          </ChartCard>
        </div>
        <div className="lg:col-span-3">
          <ChartCard title="Most referenced regulatory sources" subtitle="By logged audit entries" badge={`${data.sourceBreakdown.length} sources`}>
            <BarChart
              categories={data.sourceBreakdown.map((s) => s.label)}
              values={data.sourceBreakdown.map((s) => s.value)}
              horizontal
              height={280}
              color="#5b7cfa"
            />
          </ChartCard>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">Recent high-risk queries</h2>
        <p className="mt-0.5 text-[13px] text-secondary-foreground/80">Most recent first, every claim traceable to its source document</p>
        <div className="mt-3">
          <RecordsTable
            columns={columns}
            rows={data.recentHighRisk}
            rowKey={(row) => row.queryId}
            total={data.recentHighRiskTotal}
            emptyLabel="No high-risk queries logged."
          />
        </div>
      </section>
    </div>
  );
}
