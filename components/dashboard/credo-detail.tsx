"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Filter } from "lucide-react";
import { KpiRow } from "./kpi-row";
import { ChartCard } from "./chart-card";
import { RecordsTable, type RecordColumn } from "./records-table";
import { StatusPill } from "./status-pill";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { StackedBarChart } from "@/components/charts/stacked-bar-chart";
import { ScatterChart } from "@/components/charts/scatter-chart";
import { cn } from "@/lib/utils";
import { nairaCompact } from "@/lib/dashboard-data";
import type { CredoData } from "@/lib/platform-data";

const TABS = [
  { key: "memos", label: "Memos & Approvals" },
  { key: "travel", label: "Travel & Regional" },
  { key: "support", label: "Support & System Logs" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function FilterSelect({ param, label, options }: { param: string; label: string; options: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(param) ?? "";

  return (
    <select
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(searchParams.toString());
        if (e.target.value) next.set(param, e.target.value);
        else next.delete(param);
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      }}
      className="rounded-lg border border-border bg-secondary/60 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors duration-150 focus:border-primary focus:outline-none"
    >
      <option value="">{label}: All</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function ResetFiltersButton({ params }: { params: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasAny = params.some((p) => searchParams.get(p));
  if (!hasAny) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const next = new URLSearchParams(searchParams.toString());
        params.forEach((p) => next.delete(p));
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      }}
      className="ml-1 text-[11px] font-medium text-secondary-foreground/70 underline hover:text-secondary-foreground"
    >
      Reset
    </button>
  );
}

export function CredoDetail({ data }: { data: CredoData }) {
  const [active, setActive] = useState<TabKey>("memos");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex w-fit gap-1 rounded-xl border border-border bg-secondary/40 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={cn(
              "relative rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors duration-200 ease-out",
              active === tab.key ? "text-white" : "text-secondary-foreground/80 hover:text-foreground"
            )}
          >
            {active === tab.key && (
              <motion.span
                layoutId="credo-tab-pill"
                className="absolute inset-0 rounded-lg bg-sidebar shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{tab.label}</span>
          </button>
        ))}
      </div>

      {active === "memos" && <MemosTab data={data.memos} />}
      {active === "travel" && <TravelTab data={data.travel} />}
      {active === "support" && <SupportTab data={data.support} />}
    </div>
  );
}

function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card p-3.5 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-secondary-foreground/80">
        <Filter className="size-3.5" />
        Filters:
      </div>
      {children}
    </div>
  );
}

const memoColumns: RecordColumn<CredoData["memos"]["recent"][number]>[] = [
  { key: "memoId", label: "Memo ID", render: (row) => <span className="font-semibold text-foreground">{row.memoId}</span> },
  { key: "department", label: "Department", render: (row) => row.department },
  { key: "category", label: "Category", render: (row) => row.category },
  { key: "amount", label: "Amount", align: "right", render: (row) => <span className="font-semibold text-foreground">{row.amount}</span> },
  { key: "status", label: "Status", render: (row) => <StatusPill status={row.status} /> },
  { key: "date", label: "Submitted", render: (row) => <span className="text-secondary-foreground/70">{row.date}</span> },
];

function MemosTab({ data }: { data: CredoData["memos"] }) {
  const stackedSeries = [
    { name: "Approved", data: data.departmentValueByStatus.map((d) => d.approved), color: "#27ae60" },
    { name: "Pending", data: data.departmentValueByStatus.map((d) => d.pending), color: "#f59e0b" },
    { name: "Rejected", data: data.departmentValueByStatus.map((d) => d.rejected), color: "#ef4444" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <FilterBar>
        <FilterSelect param="memoDepartment" label="Department" options={data.filterOptions.departments} />
        <FilterSelect param="memoStatus" label="Status" options={data.filterOptions.statuses} />
        <FilterSelect param="memoCategory" label="Category" options={data.filterOptions.categories} />
        <ResetFiltersButton params={["memoDepartment", "memoStatus", "memoCategory"]} />
      </FilterBar>

      <KpiRow kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChartCard title="Departmental value by decision" subtitle="Approved / pending / rejected value by department">
            <StackedBarChart
              categories={data.departmentValueByStatus.map((d) => d.department)}
              series={stackedSeries}
              horizontal
              height={280}
              valueFormatter={nairaCompact}
            />
          </ChartCard>
        </div>
        <div className="lg:col-span-2">
          <ChartCard title="Memos by category" subtitle="Every memo in this view">
            <DonutChart labels={data.categoryBreakdown.map((s) => s.label)} values={data.categoryBreakdown.map((s) => s.value)} />
          </ChartCard>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">Recent memos</h2>
        <div className="mt-3">
          <RecordsTable
            columns={memoColumns}
            rows={data.recent}
            rowKey={(row) => row.memoId}
            total={data.recentTotal}
            emptyLabel="No memos match these filters."
          />
        </div>
      </section>
    </div>
  );
}

const travelColumns: RecordColumn<CredoData["travel"]["recent"][number]>[] = [
  { key: "travelId", label: "Travel ID", render: (row) => <span className="font-semibold text-foreground">{row.travelId}</span> },
  { key: "destination", label: "Destination", render: (row) => row.destination },
  { key: "zone", label: "Zone", render: (row) => row.zone },
  { key: "purpose", label: "Purpose", render: (row) => row.purpose },
  { key: "duration", label: "Duration", render: (row) => row.duration },
  { key: "cost", label: "Cost", align: "right", render: (row) => <span className="font-semibold text-foreground">{row.cost}</span> },
];

function TravelTab({ data }: { data: CredoData["travel"] }) {
  const outlierCount = data.scatter.filter((p) => p.outlier).length;

  return (
    <div className="flex flex-col gap-8">
      <FilterBar>
        <FilterSelect param="travelZone" label="Zone" options={data.filterOptions.zones} />
        <FilterSelect param="travelPurpose" label="Purpose" options={data.filterOptions.purposes} />
        <ResetFiltersButton params={["travelZone", "travelPurpose"]} />
      </FilterBar>

      <KpiRow kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ChartCard title="Regional travel allocation" subtitle="Total cost by geopolitical zone">
            <BarChart
              categories={data.zoneBreakdown.map((s) => s.label)}
              values={data.zoneBreakdown.map((s) => s.value)}
              color="#5b7cfa"
              height={280}
            />
          </ChartCard>
        </div>
        <div className="lg:col-span-3">
          <ChartCard
            title="Duration vs cost"
            subtitle="Detecting anomalies with Q3 + 1.5·IQR on cost"
            badge={outlierCount > 0 ? `${outlierCount} outlier${outlierCount === 1 ? "" : "s"}` : undefined}
          >
            <ScatterChart
              points={data.scatter.map((p) => ({ x: p.duration, y: p.cost, outlier: p.outlier }))}
              xLabel="Duration (days)"
              yFormatter={nairaCompact}
              height={280}
            />
          </ChartCard>
        </div>
      </div>

      <ChartCard title="Travel by purpose" subtitle="Every trip in this view">
        <DonutChart labels={data.purposeBreakdown.map((s) => s.label)} values={data.purposeBreakdown.map((s) => s.value)} />
      </ChartCard>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">Recent travel requests</h2>
        <div className="mt-3">
          <RecordsTable
            columns={travelColumns}
            rows={data.recent}
            rowKey={(row) => row.travelId}
            total={data.recentTotal}
            emptyLabel="No travel requests match these filters."
          />
        </div>
      </section>
    </div>
  );
}

const ticketColumns: RecordColumn<CredoData["support"]["recent"][number]>[] = [
  { key: "ticketId", label: "Ticket ID", render: (row) => <span className="font-semibold text-foreground">{row.ticketId}</span> },
  { key: "department", label: "Department", render: (row) => row.department },
  { key: "category", label: "Category", render: (row) => row.category },
  { key: "status", label: "Status", render: (row) => <StatusPill status={row.status} /> },
  {
    key: "handlingTime",
    label: "Handling time",
    align: "right",
    render: (row) => (
      <span className={row.slaBreached ? "font-semibold text-negative-text" : "font-semibold text-foreground"}>
        {row.handlingTime}
        {row.slaBreached ? " (SLA breached)" : ""}
      </span>
    ),
  },
  { key: "createdDate", label: "Opened", render: (row) => <span className="text-secondary-foreground/70">{row.createdDate}</span> },
];

function SupportTab({ data }: { data: CredoData["support"] }) {
  const slaSeries = [
    { name: "Within SLA", data: data.slaByCategory.map((d) => d.withinSla), color: "#0F172A" },
    { name: "SLA breached", data: data.slaByCategory.map((d) => d.breached), color: "#ef4444" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <FilterBar>
        <FilterSelect param="ticketCategory" label="Category" options={data.filterOptions.categories} />
        <FilterSelect param="ticketStatus" label="Status" options={data.filterOptions.statuses} />
        <ResetFiltersButton params={["ticketCategory", "ticketStatus"]} />
      </FilterBar>

      <KpiRow kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChartCard title="Category & SLA breach matrix" subtitle={`Tickets handled within vs beyond ${60} minutes, by category`}>
            <StackedBarChart categories={data.slaByCategory.map((d) => d.category)} series={slaSeries} horizontal height={300} />
          </ChartCard>
        </div>
        <div className="lg:col-span-2">
          <ChartCard title="Tickets by category" subtitle="Every ticket in this view">
            <DonutChart labels={data.categoryBreakdown.map((s) => s.label)} values={data.categoryBreakdown.map((s) => s.value)} />
          </ChartCard>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">Recent tickets</h2>
        <div className="mt-3">
          <RecordsTable
            columns={ticketColumns}
            rows={data.recent}
            rowKey={(row) => row.ticketId}
            total={data.recentTotal}
            emptyLabel="No tickets match these filters."
          />
        </div>
      </section>
    </div>
  );
}
