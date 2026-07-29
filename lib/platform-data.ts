import { backendGet } from "./backend";
import { nairaCompact, type Kpi, type Slice } from "./dashboard-data";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const nairaFull = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

function formatDate(iso: string) {
  return dateFormatter.format(new Date(iso));
}

function toSlice(series: { label: string; value: number; share: number }[]): Slice[] {
  return series.map((s) => ({ label: s.label, value: s.value, share: s.share }));
}

/** Appends non-empty filter values as query params - mirrors the backend's own
 * `column=value` filter grammar, so a UI dropdown maps straight onto a real filter. */
function withParams(path: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path;
}

type CountResponse = { total: number };
type AggregateResponse = { results: Record<string, number | null> };
type GroupedAggregateResponse = { results: { group: string | null; [key: string]: number | string | null }[] };
type BreakdownResponse = { total: number; series: { label: string; rawLabel: string | null; value: number; share: number }[] };
type RowsResponse<T> = { total: number; rows: T[] };
type DistinctValuesResponse = { values: { value: string; count: number }[] };

async function distinctValues(table: string, column: string): Promise<string[]> {
  const result = await backendGet<DistinctValuesResponse>(`/schema/${table}/values?column=${column}`);
  return result.values.map((v) => v.value).filter(Boolean);
}

type MemoRecord = {
  memo_id: string;
  department: string;
  category: string;
  amount_ngn: number;
  status: string;
  submitted_date: string;
  approved_date: string | null;
};
type TravelRecord = {
  travel_id: string;
  memo_id: string;
  destination_state: string;
  geopolitical_zone: string;
  purpose: string;
  duration_days: number;
  cost_ngn: number;
};
type TicketRecord = {
  ticket_id: string;
  department: string;
  category: string;
  status: string;
  processing_time_minutes: number;
  created_date: string;
};

export type MemoRow = {
  memoId: string;
  department: string;
  category: string;
  amount: string;
  date: string;
  status: string;
};

export type TravelRow = {
  travelId: string;
  memoId: string;
  destination: string;
  zone: string;
  purpose: string;
  duration: string;
  cost: string;
};

export type PlatformTicketRow = {
  ticketId: string;
  department: string;
  category: string;
  status: string;
  createdDate: string;
  handlingTime: string;
  slaBreached: boolean;
};

export type CredoFilters = {
  memoDepartment?: string;
  memoStatus?: string;
  memoCategory?: string;
  travelZone?: string;
  travelPurpose?: string;
  ticketCategory?: string;
  ticketStatus?: string;
};

const SLA_MINUTES = 60;

export type CredoData = {
  memos: {
    kpis: Kpi[];
    statusBreakdown: Slice[];
    departmentBreakdown: Slice[];
    departmentValueByStatus: { department: string; approved: number; pending: number; rejected: number }[];
    categoryBreakdown: Slice[];
    recent: MemoRow[];
    recentTotal: number;
    filterOptions: { departments: string[]; statuses: string[]; categories: string[] };
  };
  travel: {
    kpis: Kpi[];
    zoneBreakdown: Slice[];
    purposeBreakdown: Slice[];
    scatter: { travelId: string; duration: number; cost: number; outlier: boolean }[];
    recent: TravelRow[];
    recentTotal: number;
    filterOptions: { zones: string[]; purposes: string[] };
  };
  support: {
    kpis: Kpi[];
    categoryBreakdown: Slice[];
    slaByCategory: { category: string; withinSla: number; breached: number }[];
    recent: PlatformTicketRow[];
    recentTotal: number;
    filterOptions: { categories: string[]; statuses: string[] };
  };
};

async function getMemosSection(filters: CredoFilters): Promise<CredoData["memos"]> {
  const memoFilter = { department: filters.memoDepartment, status: filters.memoStatus, category: filters.memoCategory };

  const [
    statusBreakdown,
    departmentBreakdown,
    categoryBreakdown,
    pendingValue,
    recent,
    approvedForTurnaround,
    approvedByDept,
    pendingByDept,
    rejectedByDept,
    departments,
    categories,
  ] = await Promise.all([
    backendGet<BreakdownResponse>(withParams("/metrics/credo_memos/breakdown?column=status", memoFilter)),
    backendGet<BreakdownResponse>(withParams("/metrics/credo_memos/breakdown?column=department", memoFilter)),
    backendGet<BreakdownResponse>(withParams("/metrics/credo_memos/breakdown?column=category", memoFilter)),
    backendGet<AggregateResponse>(withParams("/metrics/credo_memos/aggregate?fn=sum&column=amount_ngn&status=Pending", memoFilter)),
    backendGet<RowsResponse<MemoRecord>>(withParams("/data/credo_memos?sort=submitted_date&order=desc&pageSize=5", memoFilter)),
    backendGet<RowsResponse<MemoRecord>>(
      withParams("/data/credo_memos?status=Approved&sort=submitted_date&order=desc&pageSize=500", {
        department: filters.memoDepartment,
        category: filters.memoCategory,
      })
    ),
    backendGet<GroupedAggregateResponse>(
      withParams("/metrics/credo_memos/aggregate?fn=sum&column=amount_ngn&groupBy=department&status=Approved&limit=10", {
        category: filters.memoCategory,
      })
    ),
    backendGet<GroupedAggregateResponse>(
      withParams("/metrics/credo_memos/aggregate?fn=sum&column=amount_ngn&groupBy=department&status=Pending&limit=10", {
        category: filters.memoCategory,
      })
    ),
    backendGet<GroupedAggregateResponse>(
      withParams("/metrics/credo_memos/aggregate?fn=sum&column=amount_ngn&groupBy=department&status=Rejected&limit=10", {
        category: filters.memoCategory,
      })
    ),
    distinctValues("credo_memos", "department"),
    distinctValues("credo_memos", "category"),
  ]);

  const pending = statusBreakdown.series.find((s) => s.rawLabel === "Pending")?.value ?? 0;
  const approved = statusBreakdown.series.find((s) => s.rawLabel === "Approved")?.value ?? 0;
  const rejected = statusBreakdown.series.find((s) => s.rawLabel === "Rejected")?.value ?? 0;

  const turnaroundDays = approvedForTurnaround.rows
    .filter((r) => r.approved_date)
    .map((r) => Math.max(0, (new Date(r.approved_date!).getTime() - new Date(r.submitted_date).getTime()) / 86_400_000));
  const avgTurnaround = turnaroundDays.length ? turnaroundDays.reduce((a, b) => a + b, 0) / turnaroundDays.length : null;

  const byDept = new Map<string, { approved: number; pending: number; rejected: number }>();
  const fold = (rows: GroupedAggregateResponse["results"], key: "approved" | "pending" | "rejected") => {
    for (const row of rows) {
      const dept = String(row.group ?? "(not set)");
      const entry = byDept.get(dept) ?? { approved: 0, pending: 0, rejected: 0 };
      entry[key] = Number(row.sum_amount_ngn ?? 0);
      byDept.set(dept, entry);
    }
  };
  fold(approvedByDept.results, "approved");
  fold(pendingByDept.results, "pending");
  fold(rejectedByDept.results, "rejected");

  const kpis: Kpi[] = [
    {
      key: "total-memos",
      label: "Total memos",
      value: statusBreakdown.total.toLocaleString(),
      sublabel: `${pending} pending · ${approved} approved · ${rejected} rejected`,
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "layers",
    },
    {
      key: "pending-value",
      label: "Pending value",
      value: nairaCompact(pendingValue.results.sum_amount_ngn ?? 0),
      sublabel: `${pending} memos awaiting a decision`,
      trend: null,
      trendContext: null,
      tone: pending > 0 ? "attention" : "default",
      icon: "clock",
    },
    {
      key: "approval-rate",
      label: "Approval rate",
      value: `${statusBreakdown.total ? Math.round((approved / statusBreakdown.total) * 1000) / 10 : 0}%`,
      sublabel: `${approved} of ${statusBreakdown.total} memos approved`,
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "gauge",
    },
    {
      key: "avg-turnaround",
      label: "Avg. turnaround",
      value: avgTurnaround !== null ? `${avgTurnaround.toFixed(1)}d` : "—",
      sublabel: "Submitted to approved, this window",
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "clock",
    },
  ];

  return {
    kpis,
    statusBreakdown: toSlice(statusBreakdown.series),
    departmentBreakdown: toSlice(departmentBreakdown.series),
    departmentValueByStatus: [...byDept.entries()]
      .map(([department, v]) => ({ department, ...v }))
      .sort((a, b) => b.approved + b.pending + b.rejected - (a.approved + a.pending + a.rejected)),
    categoryBreakdown: toSlice(categoryBreakdown.series),
    recent: recent.rows.map((row) => ({
      memoId: row.memo_id,
      department: row.department,
      category: row.category,
      amount: nairaFull.format(row.amount_ngn),
      date: formatDate(row.submitted_date),
      status: row.status,
    })),
    recentTotal: statusBreakdown.total,
    filterOptions: { departments, statuses: ["Approved", "Pending", "Rejected"], categories },
  };
}

async function getTravelSection(filters: CredoFilters): Promise<CredoData["travel"]> {
  const travelFilter = { geopolitical_zone: filters.travelZone, purpose: filters.travelPurpose };

  const [count, avg, zoneBreakdown, purposeBreakdown, recent, allRows, zones, purposes] = await Promise.all([
    backendGet<CountResponse>(withParams("/metrics/credo_travel_details/count", travelFilter)),
    backendGet<AggregateResponse>(
      withParams("/metrics/credo_travel_details/aggregate?metrics=sum:cost_ngn,avg:cost_ngn,avg:duration_days", travelFilter)
    ),
    backendGet<BreakdownResponse>(withParams("/metrics/credo_travel_details/breakdown?column=geopolitical_zone", travelFilter)),
    backendGet<BreakdownResponse>(withParams("/metrics/credo_travel_details/breakdown?column=purpose", travelFilter)),
    backendGet<RowsResponse<TravelRecord>>(withParams("/data/credo_travel_details?sort=travel_id&order=desc&pageSize=5", travelFilter)),
    backendGet<RowsResponse<TravelRecord>>(withParams("/data/credo_travel_details?sort=travel_id&order=desc&pageSize=250", travelFilter)),
    distinctValues("credo_travel_details", "geopolitical_zone"),
    distinctValues("credo_travel_details", "purpose"),
  ]);

  const costs = allRows.rows.map((r) => r.cost_ngn).sort((a, b) => a - b);
  const quantile = (q: number) => {
    if (costs.length === 0) return 0;
    const pos = (costs.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    return costs[base + 1] !== undefined ? costs[base] + rest * (costs[base + 1] - costs[base]) : costs[base];
  };
  const q1 = quantile(0.25);
  const q3 = quantile(0.75);
  const outlierThreshold = q3 + 1.5 * (q3 - q1);

  const kpis: Kpi[] = [
    {
      key: "total-travel",
      label: "Travel requests",
      value: count.total.toLocaleString(),
      sublabel: "Logged across every zone",
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "layers",
    },
    {
      key: "total-spend",
      label: "Total travel spend",
      value: nairaCompact(avg.results.sum_cost_ngn ?? 0),
      sublabel: "Combined cost across every trip",
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "wallet",
    },
    {
      key: "avg-cost",
      label: "Average cost per trip",
      value: nairaCompact(avg.results.avg_cost_ngn ?? 0),
      sublabel: "Per logged travel request",
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "gauge",
    },
    {
      key: "avg-duration",
      label: "Average duration",
      value: `${(avg.results.avg_duration_days ?? 0).toFixed(1)} days`,
      sublabel: "Per logged travel request",
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "clock",
    },
  ];

  return {
    kpis,
    zoneBreakdown: toSlice(zoneBreakdown.series),
    purposeBreakdown: toSlice(purposeBreakdown.series),
    scatter: allRows.rows.map((row) => ({
      travelId: row.travel_id,
      duration: row.duration_days,
      cost: row.cost_ngn,
      outlier: row.cost_ngn > outlierThreshold,
    })),
    recent: recent.rows.map((row) => ({
      travelId: row.travel_id,
      memoId: row.memo_id,
      destination: row.destination_state,
      zone: row.geopolitical_zone,
      purpose: row.purpose,
      duration: `${row.duration_days}d`,
      cost: nairaFull.format(row.cost_ngn),
    })),
    recentTotal: count.total,
    filterOptions: { zones, purposes },
  };
}

async function getSupportSection(filters: CredoFilters): Promise<CredoData["support"]> {
  const ticketFilter = { category: filters.ticketCategory, status: filters.ticketStatus };

  const [statusBreakdown, categoryBreakdown, recent, allRows, categories] = await Promise.all([
    backendGet<BreakdownResponse>(withParams("/metrics/credo_support_tickets/breakdown?column=status", ticketFilter)),
    backendGet<BreakdownResponse>(withParams("/metrics/credo_support_tickets/breakdown?column=category", ticketFilter)),
    backendGet<RowsResponse<TicketRecord>>(withParams("/data/credo_support_tickets?sort=created_date&order=desc&pageSize=5", ticketFilter)),
    backendGet<RowsResponse<TicketRecord>>(withParams("/data/credo_support_tickets?sort=created_date&order=desc&pageSize=600", ticketFilter)),
    distinctValues("credo_support_tickets", "category"),
  ]);

  const open = statusBreakdown.series.find((s) => s.rawLabel === "Open")?.value ?? 0;
  const inProgress = statusBreakdown.series.find((s) => s.rawLabel === "In Progress")?.value ?? 0;
  const resolved = statusBreakdown.series.find((s) => s.rawLabel === "Resolved")?.value ?? 0;
  const withinSla = allRows.rows.filter((r) => r.processing_time_minutes <= SLA_MINUTES).length;

  const slaByCategory = new Map<string, { withinSla: number; breached: number }>();
  for (const row of allRows.rows) {
    const entry = slaByCategory.get(row.category) ?? { withinSla: 0, breached: 0 };
    if (row.processing_time_minutes <= SLA_MINUTES) entry.withinSla += 1;
    else entry.breached += 1;
    slaByCategory.set(row.category, entry);
  }

  const kpis: Kpi[] = [
    {
      key: "total-tickets",
      label: "Total tickets",
      value: statusBreakdown.total.toLocaleString(),
      sublabel: `${resolved} resolved on record`,
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "ticket",
    },
    {
      key: "open-tickets",
      label: "Open",
      value: open.toLocaleString(),
      sublabel: "Not yet started",
      trend: null,
      trendContext: null,
      tone: open > 0 ? "attention" : "default",
      icon: "activity",
    },
    {
      key: "in-progress-tickets",
      label: "In progress",
      value: inProgress.toLocaleString(),
      sublabel: "Currently being worked",
      trend: null,
      trendContext: null,
      tone: inProgress > 0 ? "attention" : "default",
      icon: "gauge",
    },
    {
      key: "sla-rate",
      label: `Handled within ${SLA_MINUTES} min`,
      value: `${allRows.rows.length ? Math.round((withinSla / allRows.rows.length) * 1000) / 10 : 0}%`,
      sublabel: `${withinSla.toLocaleString()} of ${allRows.rows.length.toLocaleString()} tickets`,
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "clock",
    },
  ];

  return {
    kpis,
    categoryBreakdown: toSlice(categoryBreakdown.series),
    slaByCategory: [...slaByCategory.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.withinSla + b.breached - (a.withinSla + a.breached)),
    recent: recent.rows.map((row) => ({
      ticketId: row.ticket_id,
      department: row.department,
      category: row.category,
      status: row.status,
      createdDate: formatDate(row.created_date),
      handlingTime: `${Math.round(row.processing_time_minutes)} min`,
      slaBreached: row.processing_time_minutes > SLA_MINUTES,
    })),
    recentTotal: statusBreakdown.total,
    filterOptions: { categories, statuses: ["Open", "In Progress", "Resolved"] },
  };
}

export async function getCredoData(filters: CredoFilters = {}): Promise<CredoData> {
  const [memos, travel, support] = await Promise.all([
    getMemosSection(filters),
    getTravelSection(filters),
    getSupportSection(filters),
  ]);
  return { memos, travel, support };
}

// --- Barrister Craig -----------------------------------------------------------

type AuditRecord = {
  query_id: string;
  query_text: string;
  source_reference: string;
  risk_flag: string;
  log_timestamp: string;
};

export type AuditRow = {
  queryId: string;
  queryText: string;
  sourceReference: string;
  riskFlag: string;
  loggedDate: string;
};

export type BarristerCraigData = {
  kpis: Kpi[];
  riskBreakdown: Slice[];
  sourceBreakdown: Slice[];
  recentHighRisk: AuditRow[];
  recentHighRiskTotal: number;
};

export async function getBarristerCraigData(): Promise<BarristerCraigData> {
  const [riskBreakdown, sourceBreakdown, trend, highRiskTrend, recentHighRisk] = await Promise.all([
    backendGet<BreakdownResponse>("/metrics/craig_audit_logs/breakdown?column=risk_flag"),
    backendGet<BreakdownResponse>("/metrics/craig_audit_logs/breakdown?column=source_reference&limit=8"),
    backendGet<{ current: number | null; previous: number | null; percentChange: number | null; direction: "up" | "down" | "flat" }>(
      "/metrics/craig_audit_logs/compare?days=30"
    ),
    backendGet<{ current: number | null; previous: number | null; percentChange: number | null; direction: "up" | "down" | "flat" }>(
      "/metrics/craig_audit_logs/compare?days=30&risk_flag=High"
    ),
    backendGet<RowsResponse<AuditRecord>>("/data/craig_audit_logs?risk_flag=High&sort=log_timestamp&order=desc&pageSize=5"),
  ]);

  const high = riskBreakdown.series.find((s) => s.rawLabel === "High")?.value ?? 0;
  const medium = riskBreakdown.series.find((s) => s.rawLabel === "Medium")?.value ?? 0;
  const low = riskBreakdown.series.find((s) => s.rawLabel === "Low")?.value ?? 0;

  const kpis: Kpi[] = [
    {
      key: "total-logged",
      label: "Queries logged",
      value: riskBreakdown.total.toLocaleString(),
      sublabel: `${low} low · ${medium} medium · ${high} high risk`,
      trend: trend.current !== null ? { direction: trend.direction, percentChange: trend.percentChange, current: trend.current, previous: trend.previous } : null,
      trendContext: "queries, 30d",
      tone: "default",
      icon: "activity",
    },
    {
      key: "high-risk",
      label: "High-risk flags",
      value: high.toLocaleString(),
      sublabel: `${riskBreakdown.total ? Math.round((high / riskBreakdown.total) * 1000) / 10 : 0}% of all queries`,
      trend:
        highRiskTrend.current !== null
          ? { direction: highRiskTrend.direction, percentChange: highRiskTrend.percentChange, current: highRiskTrend.current, previous: highRiskTrend.previous }
          : null,
      trendContext: "high-risk, 30d",
      tone: high > 0 ? "attention" : "default",
      icon: "shield",
    },
    {
      key: "sources",
      label: "Regulatory sources cited",
      value: sourceBreakdown.total > 0 ? sourceBreakdown.series.length.toLocaleString() : "0",
      sublabel: "Distinct documents referenced",
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "layers",
    },
  ];

  return {
    kpis,
    riskBreakdown: toSlice(riskBreakdown.series),
    sourceBreakdown: toSlice(sourceBreakdown.series),
    recentHighRisk: recentHighRisk.rows.map((row) => ({
      queryId: row.query_id,
      queryText: row.query_text,
      sourceReference: row.source_reference,
      riskFlag: row.risk_flag,
      loggedDate: formatDate(row.log_timestamp),
    })),
    recentHighRiskTotal: high,
  };
}

// --- Procurement Portal ----------------------------------------------------------

type VendorRecord = {
  vendor_id: string;
  vendor_name: string;
  category: string;
  state: string;
  registration_status: string;
  registered_date: string;
};

export type ProcurementVendorRow = {
  vendorId: string;
  vendorName: string;
  category: string;
  state: string;
  status: string;
  registeredDate: string;
};

export type ProcurementDetailData = {
  kpis: Kpi[];
  statusBreakdown: Slice[];
  stateBreakdown: Slice[];
  categoryBreakdown: Slice[];
  vendors: ProcurementVendorRow[];
  vendorsTotal: number;
};

export async function getProcurementDetailData(): Promise<ProcurementDetailData> {
  const [statusBreakdown, stateBreakdown, categoryBreakdown, vendors] = await Promise.all([
    backendGet<BreakdownResponse>("/metrics/vendor_registry/breakdown?column=registration_status"),
    backendGet<BreakdownResponse>("/metrics/vendor_registry/breakdown?column=state"),
    backendGet<BreakdownResponse>("/metrics/vendor_registry/breakdown?column=category"),
    backendGet<RowsResponse<VendorRecord>>("/data/vendor_registry?sort=registered_date&order=desc&pageSize=5"),
  ]);

  const active = statusBreakdown.series.find((s) => s.rawLabel === "Active")?.value ?? 0;
  const suspended = statusBreakdown.series.find((s) => s.rawLabel === "Suspended")?.value ?? 0;
  const pendingReview = statusBreakdown.series.find((s) => s.rawLabel === "Pending Review")?.value ?? 0;

  const kpis: Kpi[] = [
    {
      key: "total-vendors",
      label: "Vendors registered",
      value: statusBreakdown.total.toLocaleString(),
      sublabel: `Across ${stateBreakdown.series.length} states`,
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "building",
    },
    {
      key: "active-vendors",
      label: "Active",
      value: active.toLocaleString(),
      sublabel: "In good standing",
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "layers",
    },
    {
      key: "suspended-vendors",
      label: "Suspended",
      value: suspended.toLocaleString(),
      sublabel: "Registration inactive",
      trend: null,
      trendContext: null,
      tone: suspended > 0 ? "attention" : "default",
      icon: "shield",
    },
    {
      key: "pending-vendors",
      label: "Pending review",
      value: pendingReview.toLocaleString(),
      sublabel: "Awaiting compliance sign-off",
      trend: null,
      trendContext: null,
      tone: pendingReview > 0 ? "attention" : "default",
      icon: "clock",
    },
  ];

  return {
    kpis,
    statusBreakdown: toSlice(statusBreakdown.series),
    stateBreakdown: toSlice(stateBreakdown.series),
    categoryBreakdown: toSlice(categoryBreakdown.series),
    vendors: vendors.rows.map((row) => ({
      vendorId: row.vendor_id,
      vendorName: row.vendor_name,
      category: row.category,
      state: row.state,
      status: row.registration_status,
      registeredDate: formatDate(row.registered_date),
    })),
    vendorsTotal: statusBreakdown.total,
  };
}
