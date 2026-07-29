import { KpiRow } from "./kpi-row";
import { ChartCard } from "./chart-card";
import { RecordsTable, type RecordColumn } from "./records-table";
import { StatusPill } from "./status-pill";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { colorsFor } from "@/lib/status-colors";
import type { ProcurementDetailData } from "@/lib/platform-data";

const columns: RecordColumn<ProcurementDetailData["vendors"][number]>[] = [
  { key: "vendorName", label: "Vendor", render: (row) => <span className="font-semibold text-foreground">{row.vendorName}</span> },
  { key: "category", label: "Category", render: (row) => row.category },
  { key: "state", label: "State", render: (row) => row.state },
  { key: "status", label: "Status", render: (row) => <StatusPill status={row.status} /> },
  { key: "registeredDate", label: "Registered", render: (row) => <span className="text-secondary-foreground/70">{row.registeredDate}</span> },
];

export function ProcurementDetail({ data }: { data: ProcurementDetailData }) {
  return (
    <div className="flex flex-col gap-8">
      <KpiRow kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ChartCard title="Vendors by status" subtitle="Every registered vendor">
            <DonutChart
              labels={data.statusBreakdown.map((s) => s.label)}
              values={data.statusBreakdown.map((s) => s.value)}
              colors={colorsFor(data.statusBreakdown.map((s) => s.label))}
            />
          </ChartCard>
        </div>
        <div className="lg:col-span-3">
          <ChartCard title="Vendors by state" subtitle="Every registered vendor" badge={`${data.stateBreakdown.length} states`}>
            <BarChart
              categories={data.stateBreakdown.map((s) => s.label)}
              values={data.stateBreakdown.map((s) => s.value)}
              horizontal
              height={280}
              color="#f59e0b"
            />
          </ChartCard>
        </div>
      </div>

      <ChartCard title="Vendors by category" subtitle="Every registered vendor" badge={`${data.categoryBreakdown.length} categories`}>
        <BarChart
          categories={data.categoryBreakdown.map((s) => s.label)}
          values={data.categoryBreakdown.map((s) => s.value)}
          horizontal
          height={280}
          color="#27ae60"
        />
      </ChartCard>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">Vendor registry</h2>
        <p className="mt-0.5 text-[13px] text-secondary-foreground/80">Most recently registered first</p>
        <div className="mt-3">
          <RecordsTable
            columns={columns}
            rows={data.vendors}
            rowKey={(row) => row.vendorId}
            total={data.vendorsTotal}
            emptyLabel="No vendors registered."
          />
        </div>
      </section>
    </div>
  );
}
