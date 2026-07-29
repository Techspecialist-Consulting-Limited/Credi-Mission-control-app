import { backendGet, backendHealth, backendPost } from "./backend";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const nairaFull = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function formatDate(iso: string) {
  return dateFormatter.format(new Date(iso));
}

/** Compact currency for headline-sized figures: ₦251.8m, ₦1.68bn */
export function nairaCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 999_500_000) return `₦${(value / 1_000_000_000).toFixed(2)}bn`;
  if (abs >= 999_500) return `₦${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 950) return `₦${(value / 1_000).toFixed(1)}k`;
  return nairaFull.format(value);
}

function daysBetween(a: string | Date, b: string | Date) {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

// --- shared types -----------------------------------------------------------

export type Trend = {
  direction: "up" | "down" | "flat" | null;
  percentChange: number | null;
  current: number | null;
  previous: number | null;
};

export type Kpi = {
  key: string;
  label: string;
  value: string;
  sublabel: string;
  trend: Trend | null;
  trendContext: string | null;
  tone: "default" | "attention";
  icon: "clock" | "shield" | "truck" | "wallet" | "ticket" | "gauge" | "building" | "activity" | "layers" | "trending";
};

export type PressureItem = {
  key: string;
  label: string;
  count: number;
  share: number | null;
  states: { label: string; value: number }[];
};

export type PlatformMetric = { label: string; value: string; tone?: "attention" };

export type PlatformCard = {
  key: "credo" | "compliance" | "procurement";
  name: string;
  href: string;
  description: string;
  statusLabel: string;
  statusTone: "clear" | "attention";
  metrics: PlatformMetric[];
};

export type TicketRow = {
  ticketId: string;
  department: string;
  category: string;
  status: string;
  openedDate: string;
  age: string;
};

export type VendorRow = {
  vendorId: string;
  vendorName: string;
  category: string;
  state: string;
  status: string;
  registeredDate: string;
};

export type Signal = {
  tone: "watch" | "info" | "good";
  title: string;
  body: string;
  source: string;
};

export type Slice = { label: string; value: number; share: number };

export type ActivityItem = { title: string; meta: string; when: string };

export type SystemStatus = { ok: boolean; provider: string; synthetic: boolean };

export type Notification = {
  key: string;
  tone: "critical" | "warning" | "info";
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
};

export type ActivityDay = { date: string; count: number };

export type Gauge = { key: string; label: string; value: number; detail: string; tone: "default" | "attention" };

export type OpsTelemetry = {
  kpis: Kpi[];
  gauges: Gauge[];
  ticketStatus: Slice[];
  ticketTrend: TrendPoint[];
  heatmap: ActivityDay[];
  servicePressure: PressureItem[];
  activity: ActivityItem[];
};

export type ShellData = {
  status: SystemStatus;
  notifications: Notification[];
};

export type TrendPoint = { label: string; value: number };

export type CompactRow = { key: string; primary: string; secondary: string; value: string; tone: "attention" | "default" };

export type InfoCard = { title: string; viewAllHref: string; viewAllLabel: string; emptyLabel: string; rows: CompactRow[] };

export type MdView = {
  kpis: Kpi[];
  platforms: PlatformCard[];
  signals: Signal[];
  submissionTrend: TrendPoint[];
  approvedByDepartment: TrendPoint[];
  infoCards: { recentActivity: InfoCard; workflowDelays: InfoCard; complianceFlags: InfoCard; highPriority: InfoCard };
};

export type ItView = {
  kpis: Kpi[];
  oldestOpen: TicketRow[];
  byCategory: Slice[];
  byDepartment: Slice[];
  signals: Signal[];
};

export type ProcurementView = {
  kpis: Kpi[];
  byStatus: Slice[];
  byState: Slice[];
  byCategory: Slice[];
  needingReview: VendorRow[];
  signals: Signal[];
};

export type StrategyView = {
  kpis: Kpi[];
  pressure: PressureItem[];
  signals: Signal[];
  bottleneck: { label: string; detail: string } | null;
};

export type MissionControlData = {
  status: SystemStatus;
  md: MdView;
  it: ItView;
  procurement: ProcurementView;
  strategy: StrategyView;
};

// --- backend response shapes (only the fields we read) ----------------------

type CountResponse = { total: number };
type AggregateResponse = { results: Record<string, number | null> };
type GroupedAggregateResponse = { results: { group: string | null; [key: string]: number | string | null }[] };
type CompareResponse = {
  current: number | null;
  previous: number | null;
  percentChange: number | null;
  direction: "up" | "down" | "flat";
};
type BreakdownResponse = { total: number; series: { label: string; rawLabel: string | null; value: number; share: number }[] };
type MemoRecord = {
  memo_id: string;
  department: string;
  category: string;
  amount_ngn: number;
  status: string;
  submitted_date: string;
  approved_date: string | null;
};
type TicketRecord = {
  ticket_id: string;
  department: string;
  category: string;
  status: string;
  processing_time_minutes: number;
  created_date: string;
};
type VendorRecord = {
  vendor_id: string;
  vendor_name: string;
  category: string;
  state: string;
  registration_status: string;
  registered_date: string;
};
type RowsResponse<T> = { total: number; rows: T[] };
type PulseResponse = {
  headline: { financialExposure: number };
  attention: {
    dataset: string;
    label: string;
    count: number;
    share: number;
    states: { label: string; value: number }[];
  }[];
};

function trendFrom(compare: CompareResponse | null): Trend | null {
  if (!compare) return null;
  return {
    direction: compare.direction,
    percentChange: compare.percentChange,
    current: compare.current,
    previous: compare.previous,
  };
}

function toSlice(series: BreakdownResponse["series"]): Slice[] {
  return series.map((s) => ({ label: s.label, value: s.value, share: s.share }));
}

// --- MD: KPI row -------------------------------------------------------------

async function buildMdKpis(): Promise<Kpi[]> {
  const [pendingCount, pendingValue, pendingTrend, riskBreakdown, riskTrend, vendorBreakdown, vendorTrend, pulse] =
    await Promise.all([
      backendGet<CountResponse>("/metrics/credo_memos/count?status=Pending"),
      backendGet<AggregateResponse>("/metrics/credo_memos/aggregate?fn=sum&column=amount_ngn&status=Pending"),
      backendGet<CompareResponse>("/metrics/credo_memos/compare?days=30&status=Pending"),
      backendGet<BreakdownResponse>("/metrics/craig_audit_logs/breakdown?column=risk_flag"),
      backendGet<CompareResponse>("/metrics/craig_audit_logs/compare?days=30&risk_flag=High"),
      backendGet<BreakdownResponse>("/metrics/vendor_registry/breakdown?column=registration_status"),
      backendGet<CompareResponse>(
        "/metrics/vendor_registry/compare?days=30&registration_status=in:Suspended,Pending%20Review"
      ),
      backendGet<PulseResponse>("/dashboard/pulse?days=30"),
    ]);

  const highRisk = riskBreakdown.series.find((s) => s.rawLabel === "High");
  const needsReviewStates = vendorBreakdown.series.filter((s) => s.rawLabel === "Suspended" || s.rawLabel === "Pending Review");
  const needsReviewCount = needsReviewStates.reduce((sum, s) => sum + s.value, 0);

  return [
    {
      key: "pending-memos",
      label: "Memos awaiting a decision",
      value: pendingCount.total.toLocaleString(),
      sublabel: `${nairaCompact(pendingValue.results.sum_amount_ngn ?? 0)} in requested value`,
      trend: trendFrom(pendingTrend),
      trendContext: "new pending memos, 30d",
      tone: pendingCount.total > 0 ? "attention" : "default",
      icon: "clock",
    },
    {
      key: "high-risk-flags",
      label: "High-risk compliance flags",
      value: (highRisk?.value ?? 0).toLocaleString(),
      sublabel: `${highRisk?.share ?? 0}% of ${riskBreakdown.total.toLocaleString()} logged queries`,
      trend: trendFrom(riskTrend),
      trendContext: "flagged queries, 30d",
      tone: (highRisk?.value ?? 0) > 0 ? "attention" : "default",
      icon: "shield",
    },
    {
      key: "vendors-review",
      label: "Vendors needing review",
      value: needsReviewCount.toLocaleString(),
      sublabel: needsReviewStates.length
        ? needsReviewStates.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(" · ")
        : "All vendors in good standing",
      trend: trendFrom(vendorTrend),
      trendContext: "new registrations, 30d",
      tone: needsReviewCount > 0 ? "attention" : "default",
      icon: "truck",
    },
    {
      key: "value-in-motion",
      label: "Total value tracked",
      value: nairaCompact(pulse.headline.financialExposure),
      sublabel: "Combined memo and travel value across every record",
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "wallet",
    },
  ];
}

// --- cross-platform pressure (dataset-level, reused by Strategy view) -------

async function buildPressure(): Promise<PressureItem[]> {
  const [pulse, riskBreakdown] = await Promise.all([
    backendGet<PulseResponse>("/dashboard/pulse?days=30"),
    backendGet<BreakdownResponse>("/metrics/craig_audit_logs/breakdown?column=risk_flag"),
  ]);

  const items: PressureItem[] = pulse.attention.map((entry) => ({
    key: entry.dataset,
    label: entry.label,
    count: entry.count,
    share: entry.share,
    states: entry.states,
  }));

  // The generic attention scan keys off status-like column *names* and misses
  // craig_audit_logs because its column is "risk_flag", not "status" or
  // "severity" - it still represents real pressure, so it is folded in here
  // rather than left invisible because of a naming mismatch upstream.
  const highRisk = riskBreakdown.series.find((s) => s.rawLabel === "High");
  if (highRisk && highRisk.value > 0) {
    items.push({
      key: "craig_audit_logs",
      label: "Craig Audit Logs",
      count: highRisk.value,
      share: highRisk.share,
      states: [{ label: "High risk", value: highRisk.value }],
    });
  }

  return items.sort((a, b) => b.count - a.count);
}

// --- platform overview cards --------------------------------------------------

async function buildPlatforms(): Promise<PlatformCard[]> {
  const [memoPending, travelCount, travelAvgCost, ticketBreakdown, ticketAvgMinutes, riskBreakdown, logTrend, vendorBreakdown] =
    await Promise.all([
      backendGet<CountResponse>("/metrics/credo_memos/count?status=Pending"),
      backendGet<CountResponse>("/metrics/credo_travel_details/count"),
      backendGet<AggregateResponse>("/metrics/credo_travel_details/aggregate?fn=avg&column=cost_ngn"),
      backendGet<BreakdownResponse>("/metrics/credo_support_tickets/breakdown?column=status"),
      backendGet<AggregateResponse>("/metrics/credo_support_tickets/aggregate?fn=avg&column=processing_time_minutes"),
      backendGet<BreakdownResponse>("/metrics/craig_audit_logs/breakdown?column=risk_flag"),
      backendGet<CompareResponse>("/metrics/craig_audit_logs/compare?days=30"),
      backendGet<BreakdownResponse>("/metrics/vendor_registry/breakdown?column=registration_status"),
    ]);

  const open = ticketBreakdown.series.find((s) => s.rawLabel === "Open")?.value ?? 0;
  const inProgress = ticketBreakdown.series.find((s) => s.rawLabel === "In Progress")?.value ?? 0;
  const ticketsActive = open + inProgress;
  const credoAttention = memoPending.total + ticketsActive;

  const highRisk = riskBreakdown.series.find((s) => s.rawLabel === "High")?.value ?? 0;

  const suspended = vendorBreakdown.series.find((s) => s.rawLabel === "Suspended")?.value ?? 0;
  const pendingReview = vendorBreakdown.series.find((s) => s.rawLabel === "Pending Review")?.value ?? 0;
  const vendorsNeedingReview = suspended + pendingReview;

  return [
    {
      key: "credo",
      name: "Credo",
      href: "/credo",
      description: "Workflow automation · memos, travel and support",
      statusLabel: credoAttention > 0 ? `${credoAttention.toLocaleString()} need attention` : "All clear",
      statusTone: credoAttention > 0 ? "attention" : "clear",
      metrics: [
        { label: "Memos awaiting approval", value: memoPending.total.toLocaleString(), tone: memoPending.total > 0 ? "attention" : undefined },
        { label: "Support tickets active", value: ticketsActive.toLocaleString(), tone: ticketsActive > 0 ? "attention" : undefined },
        { label: "Avg. ticket handling time", value: `${Math.round(ticketAvgMinutes.results.avg_processing_time_minutes ?? 0)} min` },
        { label: "Travel requests logged", value: travelCount.total.toLocaleString() },
        { label: "Avg. travel cost", value: nairaCompact(travelAvgCost.results.avg_cost_ngn ?? 0) },
      ],
    },
    {
      key: "compliance",
      name: "Barrister Craig",
      href: "/barrister-craig",
      description: "AI compliance assistant · audit log review",
      statusLabel: highRisk > 0 ? `${highRisk.toLocaleString()} flagged high-risk` : "No high-risk flags",
      statusTone: highRisk > 0 ? "attention" : "clear",
      metrics: [
        { label: "High-risk flags", value: highRisk.toLocaleString(), tone: highRisk > 0 ? "attention" : undefined },
        { label: "Total queries logged", value: riskBreakdown.total.toLocaleString() },
        {
          label: "Queries, last 30 days",
          value:
            logTrend.current === null
              ? "—"
              : `${logTrend.current.toLocaleString()}${
                  logTrend.percentChange !== null ? ` (${logTrend.percentChange > 0 ? "+" : ""}${logTrend.percentChange}%)` : ""
                }`,
        },
      ],
    },
    {
      key: "procurement",
      name: "Procurement Portal",
      href: "/procurement",
      description: "Vendor registry and compliance status",
      statusLabel: vendorsNeedingReview > 0 ? `${vendorsNeedingReview.toLocaleString()} need review` : "All vendors in good standing",
      statusTone: vendorsNeedingReview > 0 ? "attention" : "clear",
      metrics: [
        { label: "Vendors registered", value: vendorBreakdown.total.toLocaleString() },
        { label: "Needing review", value: vendorsNeedingReview.toLocaleString(), tone: vendorsNeedingReview > 0 ? "attention" : undefined },
        { label: "Suspended", value: suspended.toLocaleString(), tone: suspended > 0 ? "attention" : undefined },
        { label: "Pending review", value: pendingReview.toLocaleString(), tone: pendingReview > 0 ? "attention" : undefined },
      ],
    },
  ];
}

// --- signals (computed, not AI-generated) ------------------------------------

async function buildSignals(): Promise<Signal[]> {
  const [ticketTrend, pendingValue, riskBreakdown, riskTrend] = await Promise.all([
    backendGet<CompareResponse>("/metrics/credo_support_tickets/compare?days=30"),
    backendGet<AggregateResponse>("/metrics/credo_memos/aggregate?fn=sum&column=amount_ngn&status=Pending"),
    backendGet<BreakdownResponse>("/metrics/craig_audit_logs/breakdown?column=risk_flag"),
    backendGet<CompareResponse>("/metrics/craig_audit_logs/compare?days=30&risk_flag=High"),
  ]);

  const signals: Signal[] = [];

  if (ticketTrend.current !== null && ticketTrend.previous !== null && ticketTrend.percentChange !== null) {
    signals.push({
      tone: "watch",
      title: ticketTrend.direction === "down" ? "New support tickets have slowed sharply" : "Support ticket volume is shifting",
      body: `${ticketTrend.current.toLocaleString()} tickets were opened in the last 30 days, against ${ticketTrend.previous.toLocaleString()} the period before (${ticketTrend.percentChange > 0 ? "+" : ""}${ticketTrend.percentChange}%). Older tickets already in the queue are tracked separately below.`,
      source: "credo_support_tickets",
    });
  }

  const highRisk = riskBreakdown.series.find((s) => s.rawLabel === "High");
  if (highRisk) {
    signals.push({
      tone: highRisk.value > 0 ? "watch" : "good",
      title: `${highRisk.value.toLocaleString()} compliance ${highRisk.value === 1 ? "query flagged" : "queries flagged"} high-risk`,
      body: `That's ${highRisk.share}% of the ${riskBreakdown.total.toLocaleString()} logged queries on record${
        riskTrend.percentChange !== null
          ? `, with high-risk volume ${riskTrend.direction === "down" ? "down" : riskTrend.direction === "up" ? "up" : "flat"} ${Math.abs(riskTrend.percentChange)}% over the last 30 days`
          : ""
      }.`,
      source: "craig_audit_logs",
    });
  }

  signals.push({
    tone: "info",
    title: `${nairaCompact(pendingValue.results.sum_amount_ngn ?? 0)} sits in memos awaiting a decision`,
    body: "This is requested value across every memo currently in the Pending state, before any approval or rejection.",
    source: "credo_memos",
  });

  return signals;
}

// --- IT Head view --------------------------------------------------------------

async function buildItView(): Promise<ItView> {
  const [statusBreakdown, avgMinutes, oldest, byCategory, byDepartment, trend] = await Promise.all([
    backendGet<BreakdownResponse>("/metrics/credo_support_tickets/breakdown?column=status"),
    backendGet<AggregateResponse>("/metrics/credo_support_tickets/aggregate?fn=avg&column=processing_time_minutes"),
    backendGet<RowsResponse<TicketRecord>>("/data/credo_support_tickets?status=Open&sort=created_date&order=asc&pageSize=4"),
    backendGet<BreakdownResponse>("/metrics/credo_support_tickets/breakdown?column=category"),
    backendGet<BreakdownResponse>("/metrics/credo_support_tickets/breakdown?column=department&limit=8"),
    backendGet<CompareResponse>("/metrics/credo_support_tickets/compare?days=30"),
  ]);

  const open = statusBreakdown.series.find((s) => s.rawLabel === "Open")?.value ?? 0;
  const inProgress = statusBreakdown.series.find((s) => s.rawLabel === "In Progress")?.value ?? 0;
  const resolved = statusBreakdown.series.find((s) => s.rawLabel === "Resolved")?.value ?? 0;

  const oldestTicket = oldest.rows[0];
  const oldestAgeDays = oldestTicket ? daysBetween(oldestTicket.created_date, new Date()) : null;

  const kpis: Kpi[] = [
    {
      key: "tickets-open",
      label: "Tickets open",
      value: open.toLocaleString(),
      sublabel: `${inProgress.toLocaleString()} more in progress`,
      trend: trendFrom(trend),
      trendContext: "new tickets, 30d",
      tone: open > 0 ? "attention" : "default",
      icon: "ticket",
    },
    {
      key: "tickets-in-progress",
      label: "Tickets in progress",
      value: inProgress.toLocaleString(),
      sublabel: `${resolved.toLocaleString()} resolved on record`,
      trend: null,
      trendContext: null,
      tone: inProgress > 0 ? "attention" : "default",
      icon: "activity",
    },
    {
      key: "avg-handling",
      label: "Avg. handling time",
      value: `${Math.round(avgMinutes.results.avg_processing_time_minutes ?? 0)} min`,
      sublabel: "Across every logged ticket",
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "gauge",
    },
    {
      key: "oldest-ticket",
      label: "Oldest open ticket",
      value: oldestAgeDays !== null ? `${oldestAgeDays}d` : "—",
      sublabel: oldestTicket ? `${oldestTicket.ticket_id} · ${oldestTicket.department}` : "Nothing open",
      trend: null,
      trendContext: null,
      tone: oldestAgeDays !== null && oldestAgeDays > 60 ? "attention" : "default",
      icon: "clock",
    },
  ];

  const busiestCategory = [...byCategory.series].sort((a, b) => b.value - a.value)[0];
  const signals: Signal[] = [
    {
      tone: open + inProgress > resolved * 0.3 ? "watch" : "good",
      title: `${(open + inProgress).toLocaleString()} tickets currently need handling`,
      body: `${open.toLocaleString()} not yet started, ${inProgress.toLocaleString()} in progress, against ${resolved.toLocaleString()} resolved on record.`,
      source: "credo_support_tickets",
    },
    ...(oldestAgeDays !== null
      ? [
          {
            tone: (oldestAgeDays > 60 ? "watch" : "info") as Signal["tone"],
            title: `Oldest open ticket has waited ${oldestAgeDays} days`,
            body: `${oldestTicket.ticket_id} in ${oldestTicket.department} — ${oldestTicket.category}.`,
            source: "credo_support_tickets",
          },
        ]
      : []),
    ...(busiestCategory
      ? [
          {
            tone: "info" as const,
            title: `${busiestCategory.label} is the most common ticket category`,
            body: `${busiestCategory.value.toLocaleString()} tickets (${busiestCategory.share}% of all logged tickets).`,
            source: "credo_support_tickets",
          },
        ]
      : []),
  ];

  return {
    kpis,
    oldestOpen: oldest.rows.map((row) => ({
      ticketId: row.ticket_id,
      department: row.department,
      category: row.category,
      status: row.status,
      openedDate: formatDate(row.created_date),
      age: `${daysBetween(row.created_date, new Date())}d open`,
    })),
    byCategory: toSlice(byCategory.series),
    byDepartment: toSlice(byDepartment.series),
    signals,
  };
}

// --- Procurement Head view -------------------------------------------------------

async function buildProcurementView(): Promise<ProcurementView> {
  const [statusBreakdown, byState, byCategory, needingReview] = await Promise.all([
    backendGet<BreakdownResponse>("/metrics/vendor_registry/breakdown?column=registration_status"),
    backendGet<BreakdownResponse>("/metrics/vendor_registry/breakdown?column=state"),
    backendGet<BreakdownResponse>("/metrics/vendor_registry/breakdown?column=category"),
    backendGet<RowsResponse<VendorRecord>>(
      "/data/vendor_registry?registration_status=in:Suspended,Pending%20Review&sort=registered_date&order=desc&pageSize=4"
    ),
  ]);

  const suspended = statusBreakdown.series.find((s) => s.rawLabel === "Suspended")?.value ?? 0;
  const pendingReview = statusBreakdown.series.find((s) => s.rawLabel === "Pending Review")?.value ?? 0;
  const active = statusBreakdown.series.find((s) => s.rawLabel === "Active")?.value ?? 0;

  const kpis: Kpi[] = [
    {
      key: "vendors-registered",
      label: "Vendors registered",
      value: statusBreakdown.total.toLocaleString(),
      sublabel: `${active.toLocaleString()} active in good standing`,
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "building",
    },
    {
      key: "needing-review",
      label: "Needing review",
      value: (suspended + pendingReview).toLocaleString(),
      sublabel: `${suspended} suspended · ${pendingReview} pending review`,
      trend: null,
      trendContext: null,
      tone: suspended + pendingReview > 0 ? "attention" : "default",
      icon: "shield",
    },
    {
      key: "suspended",
      label: "Suspended",
      value: suspended.toLocaleString(),
      sublabel: "Registration currently inactive",
      trend: null,
      trendContext: null,
      tone: suspended > 0 ? "attention" : "default",
      icon: "truck",
    },
    {
      key: "pending-review",
      label: "Pending review",
      value: pendingReview.toLocaleString(),
      sublabel: "Awaiting compliance sign-off",
      trend: null,
      trendContext: null,
      tone: pendingReview > 0 ? "attention" : "default",
      icon: "clock",
    },
  ];

  const topCategory = [...byCategory.series].sort((a, b) => b.value - a.value)[0];
  const signals: Signal[] = [
    {
      tone: suspended + pendingReview > 0 ? "watch" : "good",
      title:
        suspended + pendingReview > 0
          ? `${(suspended + pendingReview).toLocaleString()} vendors need compliance attention`
          : "Every registered vendor is in good standing",
      body:
        suspended + pendingReview > 0
          ? `${suspended.toLocaleString()} suspended, ${pendingReview.toLocaleString()} pending review, out of ${statusBreakdown.total.toLocaleString()} registered vendors.`
          : `All ${statusBreakdown.total.toLocaleString()} registered vendors are active with no outstanding compliance action.`,
      source: "vendor_registry",
    },
    {
      tone: "info",
      title: `${active.toLocaleString()} of ${statusBreakdown.total.toLocaleString()} vendors are active`,
      body: `That's ${statusBreakdown.total ? Math.round((active / statusBreakdown.total) * 1000) / 10 : 0}% of the registry in good standing.`,
      source: "vendor_registry",
    },
    ...(topCategory
      ? [
          {
            tone: "info" as const,
            title: `${topCategory.label} is the largest vendor category`,
            body: `${topCategory.value.toLocaleString()} vendors (${topCategory.share}% of the registry) across ${byState.series.length} states.`,
            source: "vendor_registry",
          },
        ]
      : []),
  ];

  return {
    kpis,
    byStatus: toSlice(statusBreakdown.series),
    byState: toSlice(byState.series),
    byCategory: toSlice(byCategory.series),
    needingReview: needingReview.rows.map((row) => ({
      vendorId: row.vendor_id,
      vendorName: row.vendor_name,
      category: row.category,
      state: row.state,
      status: row.registration_status,
      registeredDate: formatDate(row.registered_date),
    })),
    signals,
  };
}

// --- Innovation & Strategy Head view ---------------------------------------------

async function buildStrategyView(): Promise<StrategyView> {
  const [pulse, pressure, signals] = await Promise.all([
    backendGet<PulseResponse>("/dashboard/pulse?days=30"),
    buildPressure(),
    buildSignals(),
  ]);

  const top = pressure[0] ?? null;
  const totalRecords = pressure.reduce((sum, item) => sum + item.count, 0);

  const kpis: Kpi[] = [
    {
      key: "needs-attention",
      label: "Records needing attention",
      value: totalRecords.toLocaleString(),
      sublabel: `Across ${pressure.length} datasets`,
      trend: null,
      trendContext: null,
      tone: totalRecords > 0 ? "attention" : "default",
      icon: "layers",
    },
    {
      key: "value-tracked",
      label: "Total value tracked",
      value: nairaCompact(pulse.headline.financialExposure),
      sublabel: "Combined memo and travel value",
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "wallet",
    },
    {
      key: "top-bottleneck",
      label: "Top bottleneck",
      value: top?.label ?? "None",
      sublabel: top ? `${top.count.toLocaleString()} records need attention` : "Nothing outstanding",
      trend: null,
      trendContext: null,
      tone: top ? "attention" : "default",
      icon: "trending",
    },
    {
      key: "signal-count",
      label: "Signals surfaced",
      value: signals.length.toLocaleString(),
      sublabel: "Computed from live data this session",
      trend: null,
      trendContext: null,
      tone: "default",
      icon: "activity",
    },
  ];

  const strategySignals: Signal[] = top
    ? [
        {
          tone: "watch",
          title: `${top.label} is where pressure is concentrated`,
          body: `${top.count.toLocaleString()} records (${top.share}% of that dataset) need attention — ${top.states
            .map((s) => `${s.value.toLocaleString()} ${s.label.toLowerCase()}`)
            .join(", ")}.`,
          source: top.key,
        },
        ...signals,
      ]
    : signals;

  return {
    kpis,
    pressure,
    signals: strategySignals,
    bottleneck: top
      ? {
          label: top.label,
          detail: `${top.count.toLocaleString()} records (${top.share}% of that dataset) — ${top.states
            .map((s) => `${s.value.toLocaleString()} ${s.label.toLowerCase()}`)
            .join(", ")}`,
        }
      : null,
  };
}

// --- activity + status --------------------------------------------------------

type AuditLogRecord = {
  query_id: string;
  query_text: string;
  source_reference: string;
  risk_flag: string;
  log_timestamp: string;
};

/** Latest records across every connected dataset, interleaved by real timestamp. */
async function crossPlatformActivity(limit = 8): Promise<ActivityItem[]> {
  const [memos, tickets, vendors, audit] = await Promise.all([
    backendGet<RowsResponse<MemoRecord>>(`/data/credo_memos?sort=submitted_date&order=desc&pageSize=${limit}`),
    backendGet<RowsResponse<TicketRecord>>(`/data/credo_support_tickets?sort=created_date&order=desc&pageSize=${limit}`),
    backendGet<RowsResponse<VendorRecord>>(`/data/vendor_registry?sort=registered_date&order=desc&pageSize=${limit}`),
    backendGet<RowsResponse<AuditLogRecord>>(`/data/craig_audit_logs?sort=log_timestamp&order=desc&pageSize=${limit}`),
  ]);

  const items = [
    ...memos.rows.map((row) => ({
      title: `Memo ${row.status.toLowerCase()} — ${row.department}`,
      meta: `Credo · ${row.memo_id} · ${nairaFull.format(row.amount_ngn)}`,
      when: formatDate(row.submitted_date),
      ts: new Date(row.submitted_date).getTime(),
    })),
    ...tickets.rows.map((row) => ({
      title: `Support ticket logged — ${row.department}`,
      meta: `Credo · ${row.ticket_id} · ${row.category}`,
      when: formatDate(row.created_date),
      ts: new Date(row.created_date).getTime(),
    })),
    ...vendors.rows.map((row) => ({
      title: `Vendor registered — ${row.vendor_name}`,
      meta: `Procurement · ${row.vendor_id} · ${row.category}`,
      when: formatDate(row.registered_date),
      ts: new Date(row.registered_date).getTime(),
    })),
    ...audit.rows.map((row) => ({
      title: `Compliance query logged — ${row.risk_flag} risk`,
      meta: `Barrister Craig · ${row.source_reference}`,
      when: formatDate(row.log_timestamp),
      ts: new Date(row.log_timestamp).getTime(),
    })),
  ];

  return items
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit)
    .map((entry) => ({ title: entry.title, meta: entry.meta, when: entry.when }));
}

// --- Overview: compact executive info cards -----------------------------------
//
// The Overview page is a summary, not a report: each card below surfaces the
// top 4 real records for one executive question, with a link to the full
// picture on the relevant platform page. Full detail lives there, not here.

async function buildRecentActivityCard(): Promise<InfoCard> {
  const items = await crossPlatformActivity(4);
  return {
    title: "Recent Activity",
    viewAllHref: "/mission-control",
    viewAllLabel: "View all activity",
    emptyLabel: "No recent activity.",
    rows: items.map((item, i) => ({
      key: `${i}-${item.title}`,
      primary: item.title,
      secondary: item.meta,
      value: item.when,
      tone: "default",
    })),
  };
}

async function buildWorkflowDelaysCard(): Promise<InfoCard> {
  const result = await backendGet<RowsResponse<MemoRecord>>(
    "/data/credo_memos?status=Pending&sort=submitted_date&order=asc&pageSize=4"
  );
  return {
    title: "Workflow Delays",
    viewAllHref: "/credo",
    viewAllLabel: "View all in Credo",
    emptyLabel: "No memos are waiting on a decision.",
    rows: result.rows.map((row) => {
      const waiting = daysBetween(row.submitted_date, new Date());
      return {
        key: row.memo_id,
        primary: `${row.memo_id} · ${row.department}`,
        secondary: `${waiting}d waiting`,
        value: nairaCompact(row.amount_ngn),
        tone: waiting >= 30 ? "attention" : "default",
      };
    }),
  };
}

async function buildHighPriorityCard(): Promise<InfoCard> {
  const result = await backendGet<RowsResponse<MemoRecord>>(
    "/data/credo_memos?status=Pending&sort=amount_ngn&order=desc&pageSize=4"
  );
  return {
    title: "High Priority Items",
    viewAllHref: "/credo",
    viewAllLabel: "View all in Credo",
    emptyLabel: "No high-value memos are pending.",
    rows: result.rows.map((row) => ({
      key: row.memo_id,
      primary: `${row.memo_id} · ${row.department}`,
      secondary: row.category,
      value: nairaCompact(row.amount_ngn),
      tone: "attention",
    })),
  };
}

async function buildComplianceFlagsCard(): Promise<InfoCard> {
  const result = await backendGet<RowsResponse<AuditLogRecord>>(
    "/data/craig_audit_logs?risk_flag=High&sort=log_timestamp&order=desc&pageSize=4"
  );
  return {
    title: "Compliance Flags",
    viewAllHref: "/barrister-craig",
    viewAllLabel: "View all in Barrister Craig",
    emptyLabel: "No high-risk queries logged.",
    rows: result.rows.map((row) => ({
      key: row.query_id,
      primary: row.query_text.length > 50 ? `${row.query_text.slice(0, 50)}…` : row.query_text,
      secondary: formatDate(row.log_timestamp),
      value: "High risk",
      tone: "attention",
    })),
  };
}

async function buildMdInfoCards(): Promise<MdView["infoCards"]> {
  const [recentActivityCard, workflowDelays, complianceFlags, highPriority] = await Promise.all([
    buildRecentActivityCard(),
    buildWorkflowDelaysCard(),
    buildComplianceFlagsCard(),
    buildHighPriorityCard(),
  ]);
  return { recentActivity: recentActivityCard, workflowDelays, complianceFlags, highPriority };
}

// --- notifications (computed, real - not AI-generated) -----------------------

async function buildNotifications(): Promise<Notification[]> {
  const [pendingMemos, pendingValue, riskBreakdown, vendorBreakdown, ticketBreakdown] = await Promise.all([
    backendGet<CountResponse>("/metrics/credo_memos/count?status=Pending"),
    backendGet<AggregateResponse>("/metrics/credo_memos/aggregate?fn=sum&column=amount_ngn&status=Pending"),
    backendGet<BreakdownResponse>("/metrics/craig_audit_logs/breakdown?column=risk_flag"),
    backendGet<BreakdownResponse>("/metrics/vendor_registry/breakdown?column=registration_status"),
    backendGet<BreakdownResponse>("/metrics/credo_support_tickets/breakdown?column=status"),
  ]);

  const notifications: Notification[] = [];

  if (pendingMemos.total > 0) {
    notifications.push({
      key: "pending-memos",
      tone: "warning",
      title: `${pendingMemos.total.toLocaleString()} ${pendingMemos.total === 1 ? "memo" : "memos"} awaiting a decision`,
      body: `${nairaCompact(pendingValue.results.sum_amount_ngn ?? 0)} in requested value is sitting in Pending memos.`,
      actionLabel: "Review memos",
      actionHref: "/credo",
    });
  }

  const highRisk = riskBreakdown.series.find((s) => s.rawLabel === "High")?.value ?? 0;
  if (highRisk > 0) {
    notifications.push({
      key: "high-risk-queries",
      tone: "critical",
      title: `${highRisk.toLocaleString()} high-risk ${highRisk === 1 ? "query" : "queries"} logged`,
      body: `Barrister Craig has flagged ${highRisk.toLocaleString()} of ${riskBreakdown.total.toLocaleString()} logged queries as high risk.`,
      actionLabel: "Review queries",
      actionHref: "/barrister-craig",
    });
  }

  const suspended = vendorBreakdown.series.find((s) => s.rawLabel === "Suspended")?.value ?? 0;
  const pendingReview = vendorBreakdown.series.find((s) => s.rawLabel === "Pending Review")?.value ?? 0;
  const needsReview = suspended + pendingReview;
  if (needsReview > 0) {
    notifications.push({
      key: "vendors-review",
      tone: "warning",
      title: `${needsReview.toLocaleString()} ${needsReview === 1 ? "vendor needs" : "vendors need"} review`,
      body: `${suspended.toLocaleString()} suspended · ${pendingReview.toLocaleString()} pending review in the Procurement Portal registry.`,
      actionLabel: "Review vendors",
      actionHref: "/procurement",
    });
  }

  const open = ticketBreakdown.series.find((s) => s.rawLabel === "Open")?.value ?? 0;
  if (open > 0) {
    notifications.push({
      key: "open-tickets",
      tone: "info",
      title: `${open.toLocaleString()} support ${open === 1 ? "ticket hasn't" : "tickets haven't"} been started`,
      body: `Out of ${ticketBreakdown.total.toLocaleString()} logged tickets across Credo.`,
      actionLabel: "Open Mission Control",
      actionHref: "/mission-control",
    });
  }

  return notifications;
}

export async function getShellData(): Promise<ShellData> {
  const [rawHealth, notifications] = await Promise.all([backendHealth(), buildNotifications()]);

  return {
    status: {
      ok: rawHealth.ok,
      provider: rawHealth.dataSource?.provider ?? "unknown",
      synthetic: Boolean(rawHealth.dataSource?.synthetic),
    },
    notifications,
  };
}

// --- Mission Control (IT operations telemetry) --------------------------------

async function buildActivityHeatmap(days = 371): Promise<ActivityDay[]> {
  const result = await backendGet<{ windowDays: number; datasets: number; series: ActivityDay[] }>(
    `/dashboard/activity?days=${days}`
  );
  return result.series;
}

/** Real derived quality rates from credo_support_tickets - no fabricated telemetry. */
async function buildOpsGauges(statusBreakdown: BreakdownResponse): Promise<Gauge[]> {
  const underSla = await backendGet<CountResponse>("/metrics/credo_support_tickets/count?processing_time_minutes=lte:60");

  const total = statusBreakdown.total || 1;
  const resolved = statusBreakdown.series.find((s) => s.rawLabel === "Resolved")?.value ?? 0;
  const outstanding = total - resolved;

  const resolutionRate = Math.round((resolved / total) * 1000) / 10;
  const slaRate = Math.round((underSla.total / total) * 1000) / 10;
  const backlogShare = Math.round((outstanding / total) * 1000) / 10;

  return [
    {
      key: "resolution-rate",
      label: "Tickets resolved",
      value: resolutionRate,
      detail: `${resolved.toLocaleString()} of ${total.toLocaleString()} logged tickets`,
      tone: resolutionRate < 60 ? "attention" : "default",
    },
    {
      key: "sla-speed",
      label: "Handled within 1 hour",
      value: slaRate,
      detail: `${underSla.total.toLocaleString()} tickets processed in under 60 minutes`,
      tone: slaRate < 60 ? "attention" : "default",
    },
    {
      key: "backlog-share",
      label: "Still in the queue",
      value: backlogShare,
      detail: `${outstanding.toLocaleString()} open or in progress right now`,
      tone: backlogShare > 40 ? "attention" : "default",
    },
  ];
}

export async function getOpsTelemetry(): Promise<OpsTelemetry> {
  const [itView, statusBreakdown, ticketTrendRaw, heatmap, servicePressure, activity] = await Promise.all([
    buildItView(),
    backendGet<BreakdownResponse>("/metrics/credo_support_tickets/breakdown?column=status"),
    backendGet<{ series: { bucket: string; value: number }[] }>(
      `/metrics/credo_support_tickets/timeseries?bucket=week&days=${TREND_WINDOW_DAYS}`
    ),
    buildActivityHeatmap(),
    buildPressure(),
    crossPlatformActivity(5),
  ]);

  const gauges = await buildOpsGauges(statusBreakdown);

  return {
    kpis: itView.kpis,
    gauges,
    ticketStatus: toSlice(statusBreakdown.series),
    ticketTrend: ticketTrendRaw.series.map((p) => ({ label: p.bucket, value: p.value })),
    heatmap,
    servicePressure,
    activity,
  };
}

// A bare trailing 7-14 day daily window is frequently empty for this dataset -
// submissions cluster on specific dates rather than spreading evenly across
// recent calendar days. Weekly buckets over ~4 months give a real, honest
// trend line instead of one isolated point on an otherwise flat chart.
const TREND_WINDOW_DAYS = 120;

async function buildMdCharts(): Promise<{ submissionTrend: TrendPoint[]; approvedByDepartment: TrendPoint[] }> {
  const [trend, approvedByDept] = await Promise.all([
    backendGet<{ series: { bucket: string; value: number }[] }>(
      `/metrics/credo_memos/timeseries?bucket=week&days=${TREND_WINDOW_DAYS}`
    ),
    backendGet<GroupedAggregateResponse>(
      "/metrics/credo_memos/aggregate?fn=sum&column=amount_ngn&groupBy=department&status=Approved&limit=10"
    ),
  ]);

  return {
    submissionTrend: trend.series.map((p) => ({ label: p.bucket, value: p.value })),
    approvedByDepartment: approvedByDept.results
      .map((row) => ({ label: String(row.group ?? "(not set)"), value: Number(row.sum_amount_ngn ?? 0) }))
      .sort((a, b) => b.value - a.value),
  };
}

// --- top-level composition ----------------------------------------------------

export async function getMissionControlData(): Promise<MissionControlData> {
  const [rawHealth, mdKpis, platforms, mdSignals, mdCharts, infoCards, it, procurement, strategy] = await Promise.all([
    backendHealth(),
    buildMdKpis(),
    buildPlatforms(),
    buildSignals(),
    buildMdCharts(),
    buildMdInfoCards(),
    buildItView(),
    buildProcurementView(),
    buildStrategyView(),
  ]);

  return {
    status: {
      ok: rawHealth.ok,
      provider: rawHealth.dataSource?.provider ?? "unknown",
      synthetic: Boolean(rawHealth.dataSource?.synthetic),
    },
    md: { kpis: mdKpis, platforms, signals: mdSignals, ...mdCharts, infoCards },
    it,
    procurement,
    strategy,
  };
}

export type AiMessage = { role: "user" | "assistant"; content: string };

export type AiFinding = {
  severity: "critical" | "watch" | "good";
  title: string;
  detail: string;
  recommendation?: string;
};

export type AiFindings = { summary: string; priorities: AiFinding[] };

export type AiEvidence = { sources: string[]; recordsAnalyzed: number; generatedAt: string };

type AskResponse = {
  answer: string | null;
  findings: AiFindings | null;
  evidence: AiEvidence;
};

export async function askAssistant(
  question: string,
  history: AiMessage[] = []
): Promise<{ answer: string | null; findings: AiFindings | null; evidence: AiEvidence }> {
  const result = await backendPost<AskResponse>("/ai/ask", { question, history });
  return { answer: result.answer, findings: result.findings, evidence: result.evidence };
}
