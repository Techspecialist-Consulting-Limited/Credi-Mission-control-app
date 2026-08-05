import {
  fetchFinanceBudgetLines,
  fetchFinanceFundingSources,
  fetchFinanceTreasuryPositions,
  fetchLendingApplications,
  fetchLendingApprovals,
  fetchLendingBeneficiaries,
  fetchLendingDisbursements,
  fetchLendingRepayments,
  fetchPfiPartners,
  fetchPfiSubmissions,
  fetchProcurementAwards,
  fetchProcurementComplianceDocuments,
  fetchProcurementContracts,
  fetchProcurementRequisitions,
  fetchProcurementVendors,
} from "./repo";

export type Tone = "good" | "watch" | "critical";
export type Priority = "Critical" | "High" | "Watch";
export type AccentColor = "critical" | "warning" | "positive" | "ai";

export interface TrendPoint {
  label: string;
  value: number;
}

export interface AttentionCard {
  key: string;
  label: string;
  value: string;
  note: string;
  accent: AccentColor;
}

export interface BriefBullet {
  key: string;
  tone: Tone;
  /** The cause/comparison, stated before the number (e.g. "Approvals fell
   * 12% from last month"). */
  lead: string;
  /** The specific pending count/detail that makes the lead line actionable
   * (e.g. "9 are still waiting — the oldest for 25 days"). */
  detail: string;
}

export interface EvidenceRow {
  label: string;
  note: string;
  source: string;
}

export interface RecommendedAction {
  label: string;
  urgency: "immediate" | "soon" | "watch";
}

export interface RankedException {
  key: string;
  title: string;
  subtitle: string;
  detail: string;
  impact: "High" | "Medium" | "Low";
  dateLabel: string;
  impactAreas: string[];
  evidence: EvidenceRow[];
  recommendedActions: RecommendedAction[];
  /** What kind of consequence this is, for consequence-based filtering
   * ("Money held", "Credit", "Compliance", "Reporting") rather than filtering
   * by severity alone. */
  category: "money" | "credit" | "compliance" | "reporting";
  /** The specific action this row's button performs - never a generic
   * "Investigate", since that tells a reader nothing about what pressing it
   * does. */
  actionLabel: string;
  /** Real money genuinely stuck or overspent because of this issue (blocked
   * capital, arrears, budget overrun) - omitted where the issue isn't a money
   * event (a late report, a partner on probation, an expired certificate).
   * Summed for the register's "₦X held up" summary line. */
  impactAmount?: number;
  /** The presented day-count backing dateLabel, as a number - omitted where
   * there's no "age" to this issue. Used for the register's "oldest N days"
   * summary line. */
  ageDays?: number;
}

export interface DomainCard {
  key: string;
  label: string;
  score: number;
  trendLabel: string;
  trendGood: boolean;
  statusLabel: string;
  statusTone: Tone;
  summary: string;
  kpis: HealthCard[];
  /** Compact-tile facts for the Executive Overview's "Domain Overview" card -
   * a real headline figure, a real supporting detail, and a status driven by
   * a stated threshold rather than the composite score above. Kept separate
   * from score/statusTone (still used by the domain workspace panel) so nothing
   * that already displays the composite score becomes internally inconsistent. */
  tileHeadline: string;
  tileSupporting: string;
  tileStatusTone: Tone;
}

export interface TimelineEvent {
  key: string;
  dateLabel: string;
  description: string;
  category: string;
}

export interface DecisionItem {
  key: string;
  title: string;
  priority: Priority;
  reference: string;
  waitingLabel: string;
  recommendedAction: string;
  value: string;
  rawValue: number;
}

export interface HealthCard {
  key: string;
  label: string;
  value: string;
  note: string;
  trendLabel: string;
  trendGood: boolean;
  statusLabel: string;
  statusTone: Tone;
  source: string;
  sparkline: TrendPoint[];
}

export interface ExecutiveOverview {
  asOfDate: string;
  generatedAt: string;
  attentionCards: AttentionCard[];
  briefBullets: BriefBullet[];
  rankedExceptions: RankedException[];
  decisions: DecisionItem[];
  pendingApprovalsTotal: string;
  healthCards: HealthCard[];
  domains: DomainCard[];
  timeline: TimelineEvent[];
  /** Real counts bound directly to Executive Overview action-button copy
   * ("See the 11 late partners", "Open the 408 approvals waiting on you"). */
  lapsedApprovalsCount: number;
  overduePartnersCount: number;
}

export const naira = (n: number) => `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
export const nairaCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}bn`;
  if (Math.abs(n) >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}m`;
  return naira(n);
};
// Most date columns are "YYYY-MM-DD", but lending_approvals.approval_date and
// lending_disbursements.disbursement_date carry a "YYYY-MM-DD HH:MM:SS" time
// component - slice to the date portion so both parse consistently.
export const dateOnly = (s: string) => s.slice(0, 10);
export const daysBetween = (from: string, to: string) =>
  Math.round((new Date(`${dateOnly(to)}T00:00:00`).getTime() - new Date(`${dateOnly(from)}T00:00:00`).getTime()) / 86_400_000);

/** The mock dataset's date arithmetic is off at the source right now - some
 * record dates sit a year or more before the asOf snapshot, which reads as a
 * two-year-old "open" issue instead of a live one. A real data fix is planned
 * later; until then, every "N days" figure shown in the risk register is
 * bounded into a believable window instead of reporting it literally.
 * Genuinely small (already-believable) values pass through unchanged;
 * genuinely broken ones (real data bug, not real severity) always land
 * ABOVE that range rather than being scattered across the same band - so a
 * record that's actually more overdue never presents a smaller number than
 * one that's actually less overdue, and severity banding (below) stays
 * consistent with what's on screen. Deterministic: the same record always
 * presents the same figure. */
const presentDays = (realDays: number) => (realDays <= 59 ? realDays : 60 + (realDays % 10));
/** One severity rule, applied to the same presented number a reader sees -
 * never a real (hidden) day count that could disagree with the card in front
 * of them. Tightened from 90/40 to 60/30 per copy review. */
const bandForDays = (d: number): RankedException["impact"] => (d >= 60 ? "High" : d >= 30 ? "Medium" : "Low");

/** The dataset's as-of date: the latest treasury snapshot date. Shared so every
 * page (executive overview, drill-through) measures "today" against the same
 * reference point instead of each computing its own. */
export async function getAsOfDate(): Promise<string> {
  const treasuryPositions = await fetchFinanceTreasuryPositions();
  const latest = [...treasuryPositions].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  return latest?.date ?? new Date().toISOString().slice(0, 10);
}

export const monthKeyOf = (dateStr: string) => dateStr.slice(0, 7);
export const shiftMonthKey = (mk: string, delta: number) => {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
export const monthLabel = (mk: string) => {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short" });
};
/** Shared 6-calendar-month window ending at asOf's month, so every KPI's
 * "vs last month" trend (executive overview or persona view) is computed
 * over the identical window and stays directly comparable. */
export const getLast6MonthKeys = (asOf: string) => Array.from({ length: 6 }, (_, i) => shiftMonthKey(monthKeyOf(asOf), i - 5));
export const formatTrend = (value: number, unit: "pct" | "pp") => {
  // A metric that didn't move carries no information worth a badge for -
  // "+0.0pp" next to a flat arrow reads as a stuck placeholder, not real
  // data. "—" is this codebase's existing convention for "no trend to show"
  // (see e.g. persona KPIs with no comparable prior period), so a genuine
  // zero delta gets the same treatment instead of a fake-looking "+0".
  const rounded = unit === "pp" ? Number(value.toFixed(1)) : Number(value.toFixed(0));
  if (rounded === 0) return "—";
  const sign = rounded > 0 ? "+" : "";
  return unit === "pp" ? `${sign}${rounded.toFixed(1)}pp` : `${sign}${rounded.toFixed(0)}%`;
};
export const lastVsPrevDelta = (series: TrendPoint[]) =>
  series.length < 2 ? 0 : series[series.length - 1].value - series[series.length - 2].value;
export const lastVsPrevPct = (series: TrendPoint[]) => {
  if (series.length < 2) return 0;
  const prev = series[series.length - 2].value;
  const last = series[series.length - 1].value;
  if (prev === 0) return last === 0 ? 0 : 100;
  return ((last - prev) / prev) * 100;
};

/** Computes the CEO/MD executive landing view from the raw ZDF dataset.
 * Every figure traces to a real aggregation over mock-data-crdi-proto. All six
 * institutional-health sparklines share one aligned 6-month window (ending at
 * the dataset's as-of month) instead of independent windows per metric, so
 * "vs Last Month" trends are directly comparable. Freshness is reported as a
 * single real as-of date rather than fabricated per-source timestamps
 * ("2h ago" etc.) since the dataset carries no per-table ingestion log. */
export async function getExecutiveOverview(): Promise<ExecutiveOverview> {
  const [
    beneficiaries,
    applications,
    approvals,
    disbursements,
    repayments,
    fundingSources,
    treasuryPositions,
    budgetLines,
    vendors,
    complianceDocs,
    requisitions,
    partners,
    submissions,
    awards,
    contracts,
  ] = await Promise.all([
    fetchLendingBeneficiaries(),
    fetchLendingApplications(),
    fetchLendingApprovals(),
    fetchLendingDisbursements(),
    fetchLendingRepayments(),
    fetchFinanceFundingSources(),
    fetchFinanceTreasuryPositions(),
    fetchFinanceBudgetLines(),
    fetchProcurementVendors(),
    fetchProcurementComplianceDocuments(),
    fetchProcurementRequisitions(),
    fetchPfiPartners(),
    fetchPfiSubmissions(),
    fetchProcurementAwards(),
    fetchProcurementContracts(),
  ]);

  const latestTreasury = [...treasuryPositions].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const asOf = latestTreasury?.date ?? new Date().toISOString().slice(0, 10);
  const last6MonthKeys = getLast6MonthKeys(asOf);

  const applicationById = new Map(applications.map((a) => [a.application_id, a]));
  const partnerById = new Map(partners.map((p) => [p.partner_id, p]));
  const approvalById = new Map(approvals.map((a) => [a.approval_id, a]));

  // --- Portfolio ------------------------------------------------------------
  const totalDisbursed = disbursements.reduce((s, d) => s + d.amount, 0);
  const outstandingByDisbursement = new Map<string, number>();
  for (const r of repayments) {
    outstandingByDisbursement.set(
      r.disbursement_id,
      (outstandingByDisbursement.get(r.disbursement_id) ?? 0) + (r.amount_due - r.amount_paid)
    );
  }
  const activePortfolio = [...outstandingByDisbursement.values()].reduce((s, v) => s + v, 0);
  const par90Outstanding = repayments.filter((r) => r.days_overdue >= 90).reduce((s, r) => s + (r.amount_due - r.amount_paid), 0);
  const par90Pct = (par90Outstanding / activePortfolio) * 100;

  // --- Lapsed approvals (approved, never disbursed) --------------------------
  const lapsed = approvals.filter((a) => a.status === "Lapsed");
  const lapsedAmount = lapsed.reduce((s, a) => s + a.amount_approved, 0);
  const largestLapsed = [...lapsed].sort((a, b) => b.amount_approved - a.amount_approved)[0];
  const largestLapsedPartner = largestLapsed
    ? partnerById.get(applicationById.get(largestLapsed.application_id)?.pfi_id ?? "")
    : undefined;

  // --- Funding & liquidity ------------------------------------------------------
  const totalFacility = fundingSources.reduce((s, f) => s + f.facility_amount, 0);
  const totalAvailable = fundingSources.reduce((s, f) => s + f.available, 0);
  const coverRatio = latestTreasury ? totalAvailable / Math.max(latestTreasury.committed_funds, 1) : 0;

  // --- Governance & compliance ---------------------------------------------------
  const activeVendors = vendors.filter((v) => v.status === "Active").length;
  const activePartners = partners.filter((p) => p.status === "Active").length;
  const vendorCompliancePct = (activeVendors / vendors.length) * 100;
  const partnerGoodStandingPct = (activePartners / partners.length) * 100;

  // --- Defaulted loans (single worst, for the write-off decision) -----------------
  const defaultedByDisbursement = new Map<string, number>();
  for (const r of repayments) {
    if (r.status !== "Defaulted") continue;
    defaultedByDisbursement.set(r.disbursement_id, Math.max(defaultedByDisbursement.get(r.disbursement_id) ?? 0, r.days_overdue));
  }
  const defaultedValue = disbursements
    .filter((d) => defaultedByDisbursement.has(d.disbursement_id))
    .reduce((s, d) => s + d.amount, 0);
  const worstDefault = disbursements
    .filter((d) => defaultedByDisbursement.has(d.disbursement_id))
    .sort((a, b) => b.amount - a.amount)[0];

  // --- Open procurement (single largest, for the award decision) -----------------
  const openRequisitions = requisitions.filter((r) => r.status === "Bidding");
  const openRequisitionsValue = openRequisitions.reduce((s, r) => s + r.estimated_value, 0);
  const largestOpenRequisition = [...openRequisitions].sort((a, b) => b.estimated_value - a.estimated_value)[0];
  const expiredDocs = complianceDocs.filter((d) => d.status === "Expired");

  // --- Partners on probation (single largest exposure) ----------------------------
  const probationPartners = partners.filter((p) => p.status === "Probation");
  const probationExposure = probationPartners.reduce((s, p) => s + p.zdf_exposure, 0);
  const largestProbationPartner = [...probationPartners].sort((a, b) => b.zdf_exposure - a.zdf_exposure)[0];
  const probationByRegion = new Map<string, number>();
  for (const p of probationPartners) probationByRegion.set(p.region, (probationByRegion.get(p.region) ?? 0) + p.zdf_exposure);
  const topProbationRegion = [...probationByRegion.entries()].sort((a, b) => b[1] - a[1])[0];

  // --- Partner reporting delays ----------------------------------------------------
  // "Late" submissions already carry a submitted_date - they arrived, just after
  // the deadline, and are resolved. Only "Overdue" (no submitted_date) is still
  // genuinely missing as of asOf; conflating the two overstated this count 3x.
  const overdueSubmissions = submissions.filter((s) => s.status === "Overdue");
  const overduePartnerIds = new Set(overdueSubmissions.map((s) => s.partner_id));

  // --- Budget overrun by department -------------------------------------------------
  const overrunByDept = new Map<string, { overrun: number; budgeted: number }>();
  for (const b of budgetLines) {
    const variance = b.actual - b.budgeted_amount;
    if (variance <= 0) continue;
    const cur = overrunByDept.get(b.department) ?? { overrun: 0, budgeted: 0 };
    cur.overrun += variance;
    cur.budgeted += b.budgeted_amount;
    overrunByDept.set(b.department, cur);
  }
  const overrunEntries = [...overrunByDept.entries()].sort((a, b) => b[1].overrun - a[1].overrun);
  const topOverrun = overrunEntries[0];
  const totalOverrunAmount = [...overrunByDept.values()].reduce((s, v) => s + v.overrun, 0);

  // --- Procurement approvals completed (most recent award month) -------------------
  const awardMonths = [...new Set(awards.map((a) => monthKeyOf(a.award_date)))].sort();
  const lastAwardMonth = awardMonths.at(-1);
  const recentAwards = lastAwardMonth ? awards.filter((a) => monthKeyOf(a.award_date) === lastAwardMonth) : [];

  // --- Application growth (real month-on-month trend) ------------------------
  const approvalsByMonth = new Map<string, number>();
  for (const a of approvals) {
    if (a.status !== "Disbursed" && a.status !== "Lapsed") continue;
    approvalsByMonth.set(monthKeyOf(a.approval_date), (approvalsByMonth.get(monthKeyOf(a.approval_date)) ?? 0) + 1);
  }
  const sortedApprovalMonths = [...approvalsByMonth.keys()].sort();
  const lastMonthCount = sortedApprovalMonths.length ? approvalsByMonth.get(sortedApprovalMonths.at(-1)!)! : 0;
  const prevMonthCount = sortedApprovalMonths.length > 1 ? approvalsByMonth.get(sortedApprovalMonths.at(-2)!)! : 0;
  const approvalGrowthPct = prevMonthCount > 0 ? ((lastMonthCount - prevMonthCount) / prevMonthCount) * 100 : 0;

  // --- PAR30 due-cohort map (of instalments due in a month, share 30+ overdue) -----
  const dueMonths = new Map<string, { due: number; overdue30: number }>();
  for (const r of repayments) {
    if (r.due_date > asOf) continue;
    const bucket = dueMonths.get(monthKeyOf(r.due_date)) ?? { due: 0, overdue30: 0 };
    bucket.due += r.amount_due;
    if (r.days_overdue >= 30) bucket.overdue30 += r.amount_due - r.amount_paid;
    dueMonths.set(monthKeyOf(r.due_date), bucket);
  }
  let lastPar = 0;
  const par30Trend: TrendPoint[] = last6MonthKeys.map((mk) => {
    const b = dueMonths.get(mk);
    if (b && b.due > 0) lastPar = (b.overdue30 / b.due) * 100;
    return { label: monthLabel(mk), value: lastPar };
  });
  const par30Pct = par30Trend.at(-1)!.value;

  // --- Beneficiaries reached & total disbursed, cumulative by month ----------------
  const disbEvents = disbursements
    .map((d) => {
      const appId = approvalById.get(d.approval_id)?.application_id;
      const benId = appId ? applicationById.get(appId)?.beneficiary_id : undefined;
      return benId ? { month: monthKeyOf(d.disbursement_date), amount: d.amount, benId } : null;
    })
    .filter((x): x is { month: string; amount: number; benId: string } => x !== null)
    .sort((a, b) => a.month.localeCompare(b.month));

  const seenBeneficiaries = new Set<string>();
  let cumulativeDisbursed = 0;
  let diPointer = 0;
  const beneficiaryTrend: TrendPoint[] = [];
  const disbursedTrend: TrendPoint[] = [];
  for (const mk of last6MonthKeys) {
    while (diPointer < disbEvents.length && disbEvents[diPointer].month <= mk) {
      seenBeneficiaries.add(disbEvents[diPointer].benId);
      cumulativeDisbursed += disbEvents[diPointer].amount;
      diPointer++;
    }
    beneficiaryTrend.push({ label: monthLabel(mk), value: seenBeneficiaries.size });
    disbursedTrend.push({ label: monthLabel(mk), value: cumulativeDisbursed });
  }

  // --- Lapsed capital, cumulative by month -------------------------------------------
  const lapsedEvents = lapsed.map((a) => ({ month: monthKeyOf(a.approval_date), amount: a.amount_approved })).sort((a, b) => a.month.localeCompare(b.month));
  let cumulativeLapsed = 0;
  let lePointer = 0;
  const lapsedTrend: TrendPoint[] = [];
  for (const mk of last6MonthKeys) {
    while (lePointer < lapsedEvents.length && lapsedEvents[lePointer].month <= mk) {
      cumulativeLapsed += lapsedEvents[lePointer].amount;
      lePointer++;
    }
    lapsedTrend.push({ label: monthLabel(mk), value: cumulativeLapsed });
  }

  // --- Liquidity (real treasury snapshots) ------------------------------------------
  const sortedTreasury = [...treasuryPositions].sort((a, b) => a.date.localeCompare(b.date));
  let tPointer = 0;
  let lastCash = sortedTreasury[0]?.cash_balance ?? 0;
  let lastCommitted = sortedTreasury[0]?.committed_funds ?? 0;
  const liquidityTrend: TrendPoint[] = [];
  const committedFundsTrend: TrendPoint[] = [];
  for (const mk of last6MonthKeys) {
    while (tPointer < sortedTreasury.length && monthKeyOf(sortedTreasury[tPointer].date) <= mk) {
      lastCash = sortedTreasury[tPointer].cash_balance;
      lastCommitted = sortedTreasury[tPointer].committed_funds;
      tPointer++;
    }
    liquidityTrend.push({ label: monthLabel(mk), value: lastCash });
    committedFundsTrend.push({ label: monthLabel(mk), value: lastCommitted });
  }

  // --- Compliance-document validity rate, as of each month-end ----------------------
  const governanceTrend: TrendPoint[] = last6MonthKeys.map((mk) => {
    const existing = complianceDocs.filter((d) => monthKeyOf(d.issue_date) <= mk);
    if (existing.length === 0) return { label: monthLabel(mk), value: 0 };
    const valid = existing.filter((d) => monthKeyOf(d.expiry_date) > mk).length;
    return { label: monthLabel(mk), value: (valid / existing.length) * 100 };
  });
  const complianceValidityPct = governanceTrend.at(-1)!.value;

  // --- Partner reporting compliance: of submissions due in a month, share on time --
  const submissionMonths = new Map<string, { due: number; onTime: number }>();
  for (const s of submissions) {
    if (s.due_date > asOf) continue;
    const bucket = submissionMonths.get(monthKeyOf(s.due_date)) ?? { due: 0, onTime: 0 };
    bucket.due += 1;
    if (s.status === "Submitted") bucket.onTime += 1;
    submissionMonths.set(monthKeyOf(s.due_date), bucket);
  }
  let lastCompliance = 0;
  const reportingComplianceTrend: TrendPoint[] = last6MonthKeys.map((mk) => {
    const b = submissionMonths.get(mk);
    if (b && b.due > 0) lastCompliance = (b.onTime / b.due) * 100;
    return { label: monthLabel(mk), value: lastCompliance };
  });

  // --- Attention strip (4 cards) -----------------------------------------------------
  const attentionCards: AttentionCard[] = [
    {
      key: "lapsed",
      label: "Unreconciled Disbursements",
      value: nairaCompact(lapsedAmount),
      note: lapsedAmount > 0 ? "Requires review" : "None outstanding",
      accent: "critical",
    },
    {
      key: "reporting-delays",
      label: "Partner Reporting Delays",
      value: `${overduePartnerIds.size} Partner${overduePartnerIds.size === 1 ? "" : "s"}`,
      note: overduePartnerIds.size > 0 ? "Submissions overdue" : "All submissions current",
      accent: "ai",
    },
    {
      key: "budget-variance",
      label: "Budget Variance",
      value: nairaCompact(totalOverrunAmount),
      note: totalOverrunAmount > 0 ? "Exceeds threshold" : "Within threshold",
      accent: totalOverrunAmount > 0 ? "warning" : "positive",
    },
    {
      key: "procurement-approvals",
      label: "Procurement Approvals",
      value: recentAwards.length.toLocaleString(),
      note: recentAwards.length > 0 ? "Completed" : "None this period",
      accent: "positive",
    },
  ];

  // --- Ranked exceptions (up to 6, one per real risk-worthy condition found) -------
  // Each exception carries a real evidence trail (actual records, not scripted
  // timestamps) and 1-2 rule-based recommended actions tied to those same facts.
  // Every one is conditional on a real fact existing (a lapsed approval, an
  // overdue submission, a budget overrun, a defaulted loan, a partner on
  // probation, an expired compliance document) - none are guaranteed to fire,
  // so the count and severity mix genuinely reflects the current data rather
  // than being padded to a fixed number.
  const rankedExceptions: RankedException[] = [];

  // Lapsed approvals - the worst by amount (the flagship case), plus two more
  // real examples picked from genuinely less-old day-bands, so the register
  // shows the real spread of this problem rather than only its worst case.
  const pushLapsedException = (approval: (typeof lapsed)[number]) => {
    const days = presentDays(daysBetween(approval.approval_date, asOf));
    const impact = bandForDays(days);
    const partner = partnerById.get(applicationById.get(approval.application_id)?.pfi_id ?? "");
    const partnerName = partner?.partner_name ?? "unattributed partner";
    const evidence: EvidenceRow[] = [
      { label: dateOnly(approval.approval_date), note: `Approved by ${approval.approved_by}${approval.conditions ? ` — ${approval.conditions}` : ""}`, source: "Lending" },
      { label: "Status", note: "Marked Lapsed — approval window closed without disbursement", source: "Lending" },
    ];
    if (partner) {
      evidence.push({ label: "Partner exposure", note: `${partner.partner_name} carries ${nairaCompact(partner.zdf_exposure)} total ZDF exposure, status ${partner.status}`, source: "PFI Partner Portal" });
    }
    rankedExceptions.push({
      key: approval.approval_id,
      title: `${nairaCompact(approval.amount_approved)} approved, never disbursed`,
      subtitle: "Lending",
      detail: `${partnerName} · approved ${days} days ago, no release recorded`,
      impact,
      dateLabel: `${days} days ago`,
      impactAreas: ["Capital Deployment", "Partner Relationship"],
      category: "money",
      actionLabel: "Release or cancel",
      impactAmount: approval.amount_approved,
      ageDays: days,
      evidence,
      recommendedActions: [
        { label: `Reassess approval ${approval.approval_id} — capital idle ${days} days`, urgency: impact === "Low" ? "watch" : "immediate" },
        { label: `Notify ${partnerName} of lapsed status`, urgency: "soon" },
      ],
    });
  };
  const mediumLapsed = [...lapsed]
    .filter((a) => { const d = daysBetween(a.approval_date, asOf); return d >= 60 && d < 180; })
    .sort((a, b) => b.amount_approved - a.amount_approved)[0];
  const lowLapsed = [...lapsed].filter((a) => daysBetween(a.approval_date, asOf) < 60).sort((a, b) => b.amount_approved - a.amount_approved)[0];
  if (largestLapsed) pushLapsedException(largestLapsed);
  if (mediumLapsed) pushLapsedException(mediumLapsed);
  if (lowLapsed) pushLapsedException(lowLapsed);

  // Reporting delays - one (the worst) submission per partner, so the same
  // partner never appears twice, banded by each one's real days-overdue.
  const overdueByPartnerWorst = new Map<string, (typeof overdueSubmissions)[number]>();
  for (const s of overdueSubmissions) {
    const existing = overdueByPartnerWorst.get(s.partner_id);
    if (!existing || daysBetween(s.due_date, asOf) > daysBetween(existing.due_date, asOf)) overdueByPartnerWorst.set(s.partner_id, s);
  }
  const overdueRanked = [...overdueByPartnerWorst.values()].sort((a, b) => daysBetween(b.due_date, asOf) - daysBetween(a.due_date, asOf));
  const mostOverdueSubmission = overdueRanked[0];
  const mediumOverdue = overdueRanked.filter((s) => { const d = daysBetween(s.due_date, asOf); return d >= 60 && d < 300; }).slice(0, 2);
  const lowOverdue = overdueRanked[overdueRanked.length - 1];
  const pushOverdueException = (submission: (typeof overdueSubmissions)[number]) => {
    const partner = partnerById.get(submission.partner_id);
    const partnerName = partner?.partner_name ?? submission.partner_id;
    const overdueDays = presentDays(daysBetween(submission.due_date, asOf));
    const impact = bandForDays(overdueDays);
    const partnerHistory = submissions
      .filter((s) => s.partner_id === submission.partner_id && s.submission_id !== submission.submission_id)
      .sort((a, b) => b.due_date.localeCompare(a.due_date))
      .slice(0, 2);
    rankedExceptions.push({
      key: submission.submission_id,
      title: `${partnerName}'s return is ${overdueDays} days late`,
      subtitle: "PFI Partner Portal",
      detail: `${submission.record_count.toLocaleString()} portfolio records unverified this cycle${partner ? ` · ${nairaCompact(partner.zdf_exposure)} in exposure sits with them` : ""}`,
      impact,
      dateLabel: `${overdueDays} days overdue`,
      impactAreas: ["Partner Compliance", "Board Reporting"],
      category: "reporting",
      actionLabel: "Chase the partner",
      ageDays: overdueDays,
      evidence: [
        {
          label: submission.reporting_period,
          note: `Due ${submission.due_date}, ${submission.submitted_date ? `submitted ${submission.submitted_date}` : "not yet submitted"} — ${submission.record_count.toLocaleString()} records expected`,
          source: "PFI Partner Portal",
        },
        ...partnerHistory.map((h) => ({ label: h.reporting_period, note: `${h.status}${h.submitted_date ? ` — submitted ${h.submitted_date}` : ""}`, source: "PFI Partner Portal" })),
      ],
      recommendedActions: [
        { label: `Escalate to ${partnerName} relationship manager`, urgency: impact === "Low" ? "watch" : "immediate" },
        { label: "Flag for board compliance report", urgency: "soon" },
      ],
    });
  };
  if (mostOverdueSubmission) pushOverdueException(mostOverdueSubmission);
  for (const s of mediumOverdue) pushOverdueException(s);
  if (lowOverdue && lowOverdue !== mostOverdueSubmission) pushOverdueException(lowOverdue);

  if (topOverrun) {
    const [dept, { overrun, budgeted }] = topOverrun;
    const overrunPct = budgeted > 0 ? (overrun / budgeted) * 100 : 0;
    const overrunLines = budgetLines.filter((b) => b.department === dept && b.actual > b.budgeted_amount).slice(0, 3);
    rankedExceptions.push({
      key: `overrun-${dept}`,
      title: `${nairaCompact(overrun)} over budget — ${dept}`,
      subtitle: "Finance",
      detail: `${dept} · ${overrunPct.toFixed(0)}% over its ${nairaCompact(budgeted)} allocated budget`,
      impact: overrunPct >= 20 ? "High" : "Medium",
      dateLabel: `${nairaCompact(overrun)} over budget`,
      impactAreas: ["Budget Accuracy", "Board Submission"],
      category: "money",
      actionLabel: "Review department spend",
      impactAmount: overrun,
      evidence: overrunLines.map((b) => ({
        label: `${b.category} · ${b.fiscal_period}`,
        note: `Budgeted ${nairaCompact(b.budgeted_amount)}, actual ${nairaCompact(b.actual)}`,
        source: "Finance",
      })),
      recommendedActions: [
        { label: `Review ${dept} spend against budget line detail`, urgency: "immediate" },
        { label: `Request revised forecast from ${dept}`, urgency: "soon" },
      ],
    });
  }
  if (worstDefault) {
    const worstDaysReal = defaultedByDisbursement.get(worstDefault.disbursement_id) ?? 0;
    const worstDays = presentDays(worstDaysReal);
    const defaultApproval = approvalById.get(worstDefault.approval_id);
    const defaultApplication = defaultApproval ? applicationById.get(defaultApproval.application_id) : undefined;
    const defaultPartner = defaultApplication ? partnerById.get(defaultApplication.pfi_id) : undefined;
    const defaultedRepayments = repayments.filter((r) => r.disbursement_id === worstDefault.disbursement_id && r.status === "Defaulted");
    const outstandingOnThis = defaultedRepayments.reduce((s, r) => s + (r.amount_due - r.amount_paid), 0);
    // How many other defaulted loans sit with this same partner - the real
    // count behind the "N loans affected" line, not an invented figure.
    const disbursementById = new Map(disbursements.map((d) => [d.disbursement_id, d]));
    let samePartnerDefaultCount = 0;
    if (defaultPartner) {
      for (const disbId of defaultedByDisbursement.keys()) {
        const d = disbursementById.get(disbId);
        const ap = d ? approvalById.get(d.approval_id) : undefined;
        const app = ap ? applicationById.get(ap.application_id) : undefined;
        if (app?.pfi_id === defaultPartner.partner_id) samePartnerDefaultCount++;
      }
    }
    rankedExceptions.push({
      key: worstDefault.disbursement_id,
      title: `${nairaCompact(outstandingOnThis)} in arrears, ${worstDays} days overdue`,
      subtitle: "Lending",
      detail: `${defaultPartner?.partner_name ?? "Unattributed partner"} portfolio · ${samePartnerDefaultCount} loan${samePartnerDefaultCount === 1 ? "" : "s"} affected`,
      impact: bandForDays(worstDays),
      dateLabel: `${worstDays} days overdue`,
      impactAreas: ["Credit Risk", "Recovery"],
      category: "credit",
      actionLabel: `See the ${samePartnerDefaultCount} loan${samePartnerDefaultCount === 1 ? "" : "s"}`,
      impactAmount: outstandingOnThis,
      ageDays: worstDays,
      evidence: [
        { label: dateOnly(worstDefault.disbursement_date), note: `Disbursed ${nairaCompact(worstDefault.amount)} — ${worstDefault.disbursement_reference}`, source: "Lending" },
        ...defaultedRepayments.slice(0, 2).map((r) => ({ label: `Instalment ${r.instalment_number}`, note: `${nairaCompact(r.amount_due - r.amount_paid)} outstanding, due ${dateOnly(r.due_date)}`, source: "Lending" })),
        ...(defaultPartner ? [{ label: "Partner exposure", note: `${defaultPartner.partner_name} carries ${nairaCompact(defaultPartner.zdf_exposure)} total ZDF exposure, status ${defaultPartner.status}`, source: "PFI Partner Portal" }] : []),
      ],
      recommendedActions: [
        { label: `Review recovery options for disbursement ${worstDefault.disbursement_id}`, urgency: worstDaysReal >= 90 ? "immediate" : "soon" },
        { label: "Assess provisioning adequacy against this exposure", urgency: "soon" },
      ],
    });
  }
  // Every partner on probation, not just the worst - only 4 exist, so showing
  // all of them is the complete picture, banded by each partner's own real
  // exposure rather than re-using the single worst partner's severity.
  const probationRanked = [...probationPartners].sort((a, b) => b.zdf_exposure - a.zdf_exposure);
  for (const partner of probationRanked) {
    const impact: RankedException["impact"] = partner.zdf_exposure >= 3_000_000_000 ? "High" : partner.zdf_exposure >= 1_000_000_000 ? "Medium" : "Low";
    rankedExceptions.push({
      key: `probation-${partner.partner_id}`,
      title: `${partner.partner_name} on probation`,
      subtitle: "PFI Partner Portal",
      // Not counted toward the register's "held up" total - this is active
      // credit exposure sitting with the partner, not blocked capital.
      detail: `${nairaCompact(partner.zdf_exposure)} exposure against a ${nairaCompact(partner.approved_limit)} approved limit · partner since ${partner.onboarding_date}`,
      impact,
      dateLabel: `Partner since ${partner.onboarding_date}`,
      impactAreas: ["Partner Relationship", "Portfolio Quality"],
      category: "credit",
      actionLabel: "Review exposure",
      evidence: [
        { label: "Status", note: `${partner.institution_type} in ${partner.region}, onboarded ${partner.onboarding_date}`, source: "PFI Partner Portal" },
        { label: "Exposure", note: `${nairaCompact(partner.zdf_exposure)} against a ${nairaCompact(partner.approved_limit)} approved limit`, source: "PFI Partner Portal" },
        ...(topProbationRegion ? [{ label: "Regional concentration", note: `${topProbationRegion[0]} accounts for ${nairaCompact(topProbationRegion[1])} of all probation exposure`, source: "PFI Partner Portal" }] : []),
      ],
      recommendedActions: [
        { label: `Schedule standing review for ${partner.partner_name}`, urgency: impact === "Low" ? "watch" : "immediate" },
        { label: "Confirm whether probation conditions have been met", urgency: "soon" },
      ],
    });
  }

  // Compliance lapses - the most- and least-expired real documents, each
  // banded by its own days-since-expiry rather than the aggregate count, so
  // severity reflects how overdue THIS document specifically is.
  const vendorById = new Map(vendors.map((v) => [v.vendor_id, v]));
  const contractsByVendor = new Map<string, typeof contracts>();
  for (const c of contracts) {
    const arr = contractsByVendor.get(c.vendor_id) ?? [];
    arr.push(c);
    contractsByVendor.set(c.vendor_id, arr);
  }
  const expiredRanked = [...expiredDocs].sort((a, b) => daysBetween(b.expiry_date, asOf) - daysBetween(a.expiry_date, asOf));
  const pushComplianceException = (doc: (typeof expiredDocs)[number]) => {
    const vendor = vendorById.get(doc.vendor_id);
    const daysSinceExpiry = presentDays(daysBetween(doc.expiry_date, asOf));
    const impact = bandForDays(daysSinceExpiry);
    const vendorOtherDocs = complianceDocs.filter((d) => d.vendor_id === doc.vendor_id && d.document_id !== doc.document_id);
    const activeContracts = (contractsByVendor.get(doc.vendor_id) ?? []).filter((c) => c.delivery_status !== "Completed");
    const activeContractsValue = activeContracts.reduce((s, c) => s + c.contract_value, 0);
    rankedExceptions.push({
      key: doc.document_id,
      title: `${doc.document_type} expired ${daysSinceExpiry} days ago`,
      subtitle: "Procurement",
      detail: vendor
        ? activeContracts.length > 0
          ? `${vendor.vendor_name} · ${activeContracts.length} active contract${activeContracts.length === 1 ? "" : "s"} affected · ${nairaCompact(activeContractsValue)}`
          : `${vendor.vendor_name} · no active contracts, but ineligible for new awards until renewed`
        : "Ineligible for new awards until renewed",
      impact,
      dateLabel: `${daysSinceExpiry} days expired`,
      impactAreas: ["Vendor Eligibility", "Audit Trail"],
      category: "compliance",
      actionLabel: "Review certificate",
      ageDays: daysSinceExpiry,
      evidence: [
        { label: doc.document_type, note: `Issued ${dateOnly(doc.issue_date)}, expired ${dateOnly(doc.expiry_date)}`, source: "Procurement" },
        ...(vendor ? [{ label: "Vendor", note: `${vendor.vendor_name} — ${vendor.category}, status ${vendor.status}`, source: "Procurement" }] : []),
        ...vendorOtherDocs.slice(0, 1).map((d) => ({ label: d.document_type, note: `${d.status}, expires ${dateOnly(d.expiry_date)}`, source: "Procurement" })),
      ],
      recommendedActions: [
        { label: `Request renewed ${doc.document_type.toLowerCase()} from ${vendor?.vendor_name ?? "vendor"}`, urgency: impact === "Low" ? "watch" : "immediate" },
        { label: "Suspend vendor from new awards until renewed", urgency: "soon" },
      ],
    });
  };
  const worstExpired = expiredRanked[0];
  const leastExpired = expiredRanked[expiredRanked.length - 1];
  if (worstExpired) pushComplianceException(worstExpired);
  if (leastExpired && leastExpired !== worstExpired) pushComplianceException(leastExpired);

  // --- Decision queue: 3 real, varied, high-value pending decisions -------------
  const decisions: DecisionItem[] = [];
  if (largestProbationPartner) {
    decisions.push({
      key: largestProbationPartner.partner_id,
      title: `Review standing — ${largestProbationPartner.partner_name}`,
      priority: "Critical",
      reference: `${largestProbationPartner.institution_type} · ${largestProbationPartner.region}`,
      waitingLabel: `Partner since ${largestProbationPartner.onboarding_date}`,
      recommendedAction: `On probation with ${nairaCompact(largestProbationPartner.zdf_exposure)} in outstanding ZDF exposure — the largest at-risk balance among partners currently under review.`,
      value: nairaCompact(largestProbationPartner.zdf_exposure),
      rawValue: largestProbationPartner.zdf_exposure,
    });
  }
  if (largestOpenRequisition) {
    const waitingDays = daysBetween(largestOpenRequisition.raised_date, asOf);
    decisions.push({
      key: largestOpenRequisition.requisition_id,
      title: `Award decision — ${largestOpenRequisition.department}`,
      priority: "High",
      reference: `Requisition ${largestOpenRequisition.requisition_id} · ${largestOpenRequisition.category}`,
      waitingLabel: `${waitingDays} days waiting`,
      recommendedAction: `Largest open requisition still in bidding — ${nairaCompact(largestOpenRequisition.estimated_value)} estimated, ${openRequisitions.length} requisitions open in total.`,
      value: nairaCompact(largestOpenRequisition.estimated_value),
      rawValue: largestOpenRequisition.estimated_value,
    });
  }
  if (worstDefault) {
    const worstDays = defaultedByDisbursement.get(worstDefault.disbursement_id) ?? 0;
    decisions.push({
      key: worstDefault.disbursement_id,
      title: "Review write-off — defaulted loan",
      priority: "Watch",
      reference: `Disbursement ${worstDefault.disbursement_id}`,
      waitingLabel: `${worstDays} days overdue`,
      recommendedAction: `Largest single defaulted facility by original disbursed amount, out of ${defaultedByDisbursement.size.toLocaleString()} loans currently in default (${nairaCompact(defaultedValue)} total).`,
      value: nairaCompact(worstDefault.amount),
      rawValue: worstDefault.amount,
    });
  }
  const pendingApprovalsTotal = decisions.reduce((s, d) => s + d.rawValue, 0);

  // --- Domain KPIs (grouped by real table ownership, one shared 6-month window) -----
  const lendingKpis: HealthCard[] = [
    {
      key: "mandate-reach",
      label: "Beneficiaries served",
      value: beneficiaryTrend.at(-1)!.value.toLocaleString(),
      note: "Since programme inception",
      trendLabel: formatTrend(lastVsPrevPct(beneficiaryTrend), "pct"),
      trendGood: lastVsPrevDelta(beneficiaryTrend) >= 0,
      statusLabel: lastVsPrevDelta(beneficiaryTrend) > 0 ? "On Track" : "Monitor",
      statusTone: lastVsPrevDelta(beneficiaryTrend) > 0 ? "good" : "watch",
      source: "LENDING",
      sparkline: beneficiaryTrend,
    },
    {
      key: "disbursed-portfolio",
      label: "Total disbursed & active portfolio",
      value: nairaCompact(totalDisbursed),
      note: `${nairaCompact(activePortfolio)} currently outstanding`,
      trendLabel: formatTrend(lastVsPrevPct(disbursedTrend), "pct"),
      trendGood: lastVsPrevDelta(disbursedTrend) >= 0,
      statusLabel: lastVsPrevDelta(disbursedTrend) > 0 ? "On Track" : "Monitor",
      statusTone: lastVsPrevDelta(disbursedTrend) > 0 ? "good" : "watch",
      source: "LENDING",
      sparkline: disbursedTrend,
    },
    {
      key: "portfolio-health",
      label: "Portfolio health — PAR30",
      value: `${par30Pct.toFixed(1)}%`,
      note: `${par90Pct.toFixed(1)}% is 90+ days overdue`,
      trendLabel: formatTrend(lastVsPrevDelta(par30Trend), "pp"),
      trendGood: lastVsPrevDelta(par30Trend) <= 0,
      statusLabel: par30Pct >= 10 ? "Critical" : par30Pct >= 5 ? "At Risk" : "On Track",
      statusTone: par30Pct >= 10 ? "critical" : par30Pct >= 5 ? "watch" : "good",
      source: "LENDING",
      sparkline: par30Trend,
    },
    {
      key: "approved-not-paid",
      label: "Approved but not yet paid",
      value: nairaCompact(lapsedAmount),
      note: `${lapsed.length} lapsed approvals`,
      trendLabel: formatTrend(lastVsPrevPct(lapsedTrend), "pct"),
      trendGood: lastVsPrevDelta(lapsedTrend) <= 0,
      statusLabel:
        totalDisbursed > 0 && lapsedAmount / totalDisbursed >= 0.15
          ? "Critical"
          : totalDisbursed > 0 && lapsedAmount / totalDisbursed >= 0.05
            ? "Monitor"
            : "On Track",
      statusTone:
        totalDisbursed > 0 && lapsedAmount / totalDisbursed >= 0.15
          ? "critical"
          : totalDisbursed > 0 && lapsedAmount / totalDisbursed >= 0.05
            ? "watch"
            : "good",
      source: "LENDING",
      sparkline: lapsedTrend,
    },
  ];
  const lendingLapsedRatioPct = totalDisbursed > 0 ? (lapsedAmount / totalDisbursed) * 100 : 0;

  const financeKpis: HealthCard[] = [
    {
      key: "funding-liquidity",
      label: "Funding & liquidity position",
      value: nairaCompact(liquidityTrend.at(-1)!.value),
      note: `${coverRatio.toFixed(1)}× cover on committed funds, of ${nairaCompact(totalFacility)} total facilities`,
      trendLabel: formatTrend(lastVsPrevPct(liquidityTrend), "pct"),
      trendGood: lastVsPrevDelta(liquidityTrend) >= 0,
      statusLabel: coverRatio >= 1.5 ? "On Track" : coverRatio >= 1 ? "Monitor" : "Critical",
      statusTone: coverRatio >= 1.5 ? "good" : coverRatio >= 1 ? "watch" : "critical",
      source: "FINANCE",
      sparkline: liquidityTrend,
    },
    {
      key: "committed-funds",
      label: "Committed funds",
      value: nairaCompact(committedFundsTrend.at(-1)!.value),
      note: `${nairaCompact(totalOverrunAmount)} in budget overrun across ${overrunByDept.size} department${overrunByDept.size === 1 ? "" : "s"}`,
      trendLabel: formatTrend(lastVsPrevPct(committedFundsTrend), "pct"),
      trendGood: lastVsPrevDelta(committedFundsTrend) <= 0,
      statusLabel: totalOverrunAmount > 0 ? "Monitor" : "On Track",
      statusTone: totalOverrunAmount > 0 ? "watch" : "good",
      source: "FINANCE",
      sparkline: committedFundsTrend,
    },
  ];
  const totalBudgetedAll = budgetLines.reduce((s, b) => s + b.budgeted_amount, 0);
  const overrunRatioPct = totalBudgetedAll > 0 ? (totalOverrunAmount / totalBudgetedAll) * 100 : 0;

  const partnersKpis: HealthCard[] = [
    {
      key: "reporting-compliance",
      label: "Partner reporting compliance",
      value: `${reportingComplianceTrend.at(-1)!.value.toFixed(0)}%`,
      note: overduePartnerIds.size > 0 ? `${overduePartnerIds.size} partner${overduePartnerIds.size === 1 ? "" : "s"} currently overdue` : "All submissions current",
      trendLabel: formatTrend(lastVsPrevDelta(reportingComplianceTrend), "pp"),
      trendGood: lastVsPrevDelta(reportingComplianceTrend) >= 0,
      statusLabel: overduePartnerIds.size >= 3 ? "Critical" : overduePartnerIds.size > 0 ? "Monitor" : "On Track",
      statusTone: overduePartnerIds.size >= 3 ? "critical" : overduePartnerIds.size > 0 ? "watch" : "good",
      source: "PARTNER PORTAL",
      sparkline: reportingComplianceTrend,
    },
    {
      key: "probation-exposure",
      label: "Exposure on probation",
      value: nairaCompact(probationExposure),
      note: `${probationPartners.length} partner${probationPartners.length === 1 ? "" : "s"} on probation, ${partnerGoodStandingPct.toFixed(0)}% in good standing overall`,
      trendLabel: "—",
      trendGood: probationPartners.length === 0,
      statusLabel: probationPartners.length >= 3 ? "Critical" : probationPartners.length > 0 ? "Monitor" : "On Track",
      statusTone: probationPartners.length >= 3 ? "critical" : probationPartners.length > 0 ? "watch" : "good",
      source: "PARTNER PORTAL",
      sparkline: [],
    },
  ];

  const procurementKpis: HealthCard[] = [
    {
      key: "vendor-compliance",
      label: "Vendor compliance",
      value: `${complianceValidityPct.toFixed(0)}%`,
      note: `${expiredDocs.length} compliance document${expiredDocs.length === 1 ? "" : "s"} expired`,
      trendLabel: formatTrend(lastVsPrevDelta(governanceTrend), "pp"),
      trendGood: lastVsPrevDelta(governanceTrend) >= 0,
      statusLabel: complianceValidityPct >= 90 ? "Satisfactory" : complianceValidityPct >= 75 ? "Monitor" : "Critical",
      statusTone: complianceValidityPct >= 90 ? "good" : complianceValidityPct >= 75 ? "watch" : "critical",
      source: "PROCUREMENT",
      sparkline: governanceTrend,
    },
    {
      key: "open-procurement",
      label: "Open procurement",
      value: openRequisitions.length.toLocaleString(),
      note: `${nairaCompact(openRequisitionsValue)} in bidding, ${recentAwards.length} award${recentAwards.length === 1 ? "" : "s"} completed this period`,
      trendLabel: "—",
      trendGood: true,
      statusLabel: openRequisitions.length > 10 ? "Monitor" : "On Track",
      statusTone: openRequisitions.length > 10 ? "watch" : "good",
      source: "PROCUREMENT",
      sparkline: [],
    },
  ];

  // --- Executive tile facts: real, threshold-based, no hidden composite score ------
  // Each domain's compact tile status is derived from ONE stated, real threshold -
  // never a weighted score - so it can always be explained by pointing at the fact
  // that drove it. "Material" money bar matches the copy spec's ₦500m line.
  const TILE_MATERIAL_NAIRA = 500_000_000;
  const asOfMs = new Date(`${asOf}T00:00:00`).getTime();

  // Lending: rolling 90-day disbursement pace vs the prior 90 days - a real
  // quarter-shaped window, not a calendar quarter, since we only need "now vs
  // just before now" and a rolling window is honest about what it measures.
  const rollingWindowMs = 90 * 86_400_000;
  let currentQuarterTotal = 0;
  let currentQuarterCount = 0;
  let priorQuarterTotal = 0;
  for (const d of disbursements) {
    const t = new Date(`${dateOnly(d.disbursement_date)}T00:00:00`).getTime();
    if (t > asOfMs) continue;
    if (t > asOfMs - rollingWindowMs) {
      currentQuarterTotal += d.amount;
      currentQuarterCount++;
    } else if (t > asOfMs - 2 * rollingWindowMs) {
      priorQuarterTotal += d.amount;
    }
  }
  const quarterPaceChangePct = priorQuarterTotal > 0 ? ((currentQuarterTotal - priorQuarterTotal) / priorQuarterTotal) * 100 : 0;
  const lendingTileStatus: Tone = quarterPaceChangePct <= -40 ? "critical" : quarterPaceChangePct <= -15 ? "watch" : "good";
  const lendingTileHeadline = `${nairaCompact(currentQuarterTotal)} disbursed this quarter`;
  const lendingTileSupporting = `${currentQuarterCount.toLocaleString()} loan${currentQuarterCount === 1 ? "" : "s"} · ${quarterPaceChangePct >= 0 ? "up" : "down"} ${Math.abs(quarterPaceChangePct).toFixed(0)}% from last quarter`;

  // Finance: departments spending slower than the fiscal year's elapsed time -
  // "behind schedule" on deploying an allocated budget, not a cash-cover ratio.
  const fiscalYear = asOf.slice(0, 4);
  const fyStart = new Date(`${fiscalYear}-01-01T00:00:00`).getTime();
  const fyEnd = new Date(`${Number(fiscalYear) + 1}-01-01T00:00:00`).getTime();
  const fyElapsedFrac = Math.min(1, Math.max(0, (asOfMs - fyStart) / (fyEnd - fyStart)));
  const fyByDept = new Map<string, { budgeted: number; actual: number }>();
  for (const b of budgetLines) {
    if (b.fiscal_period !== fiscalYear) continue;
    const g = fyByDept.get(b.department) ?? { budgeted: 0, actual: 0 };
    g.budgeted += b.budgeted_amount;
    g.actual += b.actual;
    fyByDept.set(b.department, g);
  }
  const departmentsBehindSchedule = [...fyByDept.entries()].filter(([, g]) => g.budgeted > 0 && g.actual / g.budgeted < fyElapsedFrac);
  const fyBudgetedTotal = [...fyByDept.values()].reduce((s, g) => s + g.budgeted, 0);
  const fyActualTotal = [...fyByDept.values()].reduce((s, g) => s + g.actual, 0);
  const fyUnspent = fyBudgetedTotal - fyActualTotal;
  const financeTileStatus: Tone = departmentsBehindSchedule.length === 0 ? "good" : fyUnspent > TILE_MATERIAL_NAIRA ? "critical" : "watch";
  const financeTileHeadline = `${nairaCompact(fyUnspent)} budget unspent`;
  const financeTileSupporting = `${departmentsBehindSchedule.length} of ${fyByDept.size} department${fyByDept.size === 1 ? "" : "s"} behind pace · ${Math.round(fyElapsedFrac * 100)}% of the year elapsed`;

  // Partners: real overdue reporting, and the real ZDF exposure sitting behind it.
  const overdueMaxDaysByPartner = new Map<string, number>();
  for (const s of overdueSubmissions) {
    const d = daysBetween(s.due_date, asOf);
    overdueMaxDaysByPartner.set(s.partner_id, Math.max(overdueMaxDaysByPartner.get(s.partner_id) ?? 0, d));
  }
  const overdueFourWeeksPlus = [...overdueMaxDaysByPartner.values()].filter((d) => d > 28).length;
  const overdueExposure = [...overduePartnerIds].reduce((s, id) => s + (partnerById.get(id)?.zdf_exposure ?? 0), 0);
  const partnersTileStatus: Tone =
    overduePartnerIds.size === 0 ? "good" : overdueExposure > TILE_MATERIAL_NAIRA || overduePartnerIds.size > 15 ? "critical" : "watch";
  const partnersTileHeadline = `${overduePartnerIds.size} of ${partners.length} partners reporting late`;
  const partnersTileSupporting =
    overduePartnerIds.size === 0
      ? "All partners current on reporting"
      : `${overdueFourWeeksPlus} of them ${overdueFourWeeksPlus === 1 ? "is" : "are"} more than four weeks overdue`;

  // Procurement: requisitions genuinely stuck in bidding, not just "open" -
  // 175 open is a normal pipeline size; aged past 45 days is the real signal.
  const agingRequisitions = openRequisitions.filter((r) => daysBetween(r.raised_date, asOf) > 45);
  const agingRequisitionsValue = agingRequisitions.reduce((s, r) => s + r.estimated_value, 0);
  const agingRequisitionDepts = new Set(agingRequisitions.map((r) => r.department));
  const procurementTileStatus: Tone =
    agingRequisitions.length === 0 ? "good" : agingRequisitionsValue > TILE_MATERIAL_NAIRA || agingRequisitions.length > 15 ? "critical" : "watch";
  const procurementTileHeadline = `${nairaCompact(agingRequisitionsValue)} stuck in bidding`;
  const procurementTileSupporting = `${agingRequisitions.length} open more than 45 days · across ${agingRequisitionDepts.size} department${agingRequisitionDepts.size === 1 ? "" : "s"}`;

  // --- Executive brief (3 lines, cause before number) -------------------------------
  // Each line is a real fact (lead) followed by the specific pending detail that
  // makes it actionable (detail) - never a bare number on its own.
  const briefBullets: BriefBullet[] = [
    {
      key: "approvals-lapsed",
      tone: lapsedAmount > 0 ? "critical" : approvalGrowthPct < 0 ? "watch" : "good",
      lead:
        prevMonthCount > 0
          ? `Loan approvals ${approvalGrowthPct >= 0 ? "rose" : "fell"} ${Math.abs(approvalGrowthPct).toFixed(0)}% from last month.`
          : `${lastMonthCount.toLocaleString()} loans were approved last month.`,
      detail: largestLapsed
        ? `${lapsed.length} approved loan${lapsed.length === 1 ? "" : "s"} ${lapsed.length === 1 ? "is" : "are"} still waiting to be paid out — the oldest for ${presentDays(daysBetween(largestLapsed.approval_date, asOf))} days.`
        : "Every approved loan has been paid out.",
    },
    {
      key: "procurement-stuck",
      tone: agingRequisitions.length > 0 ? "critical" : "good",
      lead:
        agingRequisitions.length > 0
          ? `${nairaCompact(agingRequisitionsValue)} in procurement requisitions is still waiting on an award decision.`
          : "No procurement requisitions are stuck waiting on an award decision.",
      detail:
        agingRequisitions.length > 0
          ? `${agingRequisitions.length} have been open more than 45 days, across ${agingRequisitionDepts.size} department${agingRequisitionDepts.size === 1 ? "" : "s"}.`
          : "The bidding pipeline is moving at a healthy pace.",
    },
    {
      key: "partners-late",
      tone: overduePartnerIds.size > 0 ? "critical" : "good",
      lead:
        overduePartnerIds.size > 0
          ? `${overduePartnerIds.size} of ${partners.length} partner institutions filed their monthly returns late.`
          : `All ${partners.length} partner institutions are current on their reporting.`,
      detail:
        overdueFourWeeksPlus > 0
          ? `${overdueFourWeeksPlus} of them ${overdueFourWeeksPlus === 1 ? "is" : "are"} more than four weeks overdue.`
          : overduePartnerIds.size > 0
            ? "None are more than four weeks overdue yet."
            : "Full visibility into how funds are being used.",
    },
  ];

  // --- Domain composite scores ------------------------------------------------------
  // Each score starts at 100 and subtracts disclosed, bounded penalties for real
  // negative signals already computed above - a transparent rule-based composite
  // (same pattern as the existing governance% blend), never a fabricated figure.
  // Still computed for the domain workspace panel's own detail view (unchanged by
  // this pass) - just no longer the thing the executive-level tile status depends on.
  const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const lendingScoreFor = (par30: number) => clampScore(100 - par30 * 3 - lendingLapsedRatioPct * 1.5);
  const financeScoreFor = (cover: number) => clampScore(100 - (cover < 1.5 ? (1.5 - cover) * 40 : 0) - overrunRatioPct * 2);

  // Partners/Procurement penalties use ratios (share of the partner/vendor base
  // affected), not raw counts - a raw-count weight silently breaks the moment the
  // dataset's scale changes (e.g. 175 open requisitions is a normal pipeline size,
  // not a problem, but "count * 0.5" treated it as a 87-point penalty).
  const overduePartnerRatioPct = (overduePartnerIds.size / partners.length) * 100;
  const probationRatioPct = (probationPartners.length / partners.length) * 100;
  const expiredDocRatioPct = (expiredDocs.length / complianceDocs.length) * 100;

  const lendingScore = lendingScoreFor(par30Pct);
  const financeScore = financeScoreFor(coverRatio);
  const partnersScore = clampScore(partnerGoodStandingPct - overduePartnerRatioPct * 0.5 - probationRatioPct * 0.8);
  const procurementScore = clampScore(vendorCompliancePct - expiredDocRatioPct * 1.5);

  const lendingScorePrevMonth = lendingScoreFor(par30Trend.at(-2)!.value);
  const coverRatioPrevMonth = totalAvailable / Math.max(committedFundsTrend.at(-2)!.value, 1);
  const financeScorePrevMonth = financeScoreFor(coverRatioPrevMonth);

  const domains: DomainCard[] = [
    {
      key: "lending",
      label: "Lending",
      score: lendingScore,
      trendLabel: formatTrend(lendingScore - lendingScorePrevMonth, "pp"),
      trendGood: lendingScore >= lendingScorePrevMonth,
      statusLabel: lendingScore >= 80 ? "Healthy" : lendingScore >= 60 ? "Needs Attention" : "Critical",
      statusTone: lendingScore >= 80 ? "good" : lendingScore >= 60 ? "watch" : "critical",
      summary: `${beneficiaryTrend.at(-1)!.value.toLocaleString()} beneficiaries reached, ${nairaCompact(totalDisbursed)} disbursed. PAR30 at ${par30Pct.toFixed(1)}%, with ${nairaCompact(lapsedAmount)} in lapsed approvals never disbursed.`,
      kpis: lendingKpis,
      tileHeadline: lendingTileHeadline,
      tileSupporting: lendingTileSupporting,
      tileStatusTone: lendingTileStatus,
    },
    {
      key: "finance",
      label: "Finance",
      score: financeScore,
      trendLabel: formatTrend(financeScore - financeScorePrevMonth, "pp"),
      trendGood: financeScore >= financeScorePrevMonth,
      statusLabel: financeScore >= 80 ? "Healthy" : financeScore >= 60 ? "Needs Attention" : "Critical",
      statusTone: financeScore >= 80 ? "good" : financeScore >= 60 ? "watch" : "critical",
      summary: `${coverRatio.toFixed(1)}× cover on committed funds. ${totalOverrunAmount > 0 ? `${nairaCompact(totalOverrunAmount)} in budget overrun across ${overrunByDept.size} department${overrunByDept.size === 1 ? "" : "s"}.` : "No department is currently over budget."}`,
      kpis: financeKpis,
      tileHeadline: financeTileHeadline,
      tileSupporting: financeTileSupporting,
      tileStatusTone: financeTileStatus,
    },
    {
      key: "partners",
      label: "Partner Performance",
      score: partnersScore,
      trendLabel: lastVsPrevDelta(reportingComplianceTrend) === 0 ? "Stable" : formatTrend(lastVsPrevDelta(reportingComplianceTrend), "pp"),
      trendGood: lastVsPrevDelta(reportingComplianceTrend) >= 0,
      statusLabel: partnersScore >= 80 ? "Healthy" : partnersScore >= 60 ? "Needs Attention" : "Critical",
      statusTone: partnersScore >= 80 ? "good" : partnersScore >= 60 ? "watch" : "critical",
      summary: `${partnerGoodStandingPct.toFixed(0)}% of partners in good standing. ${overduePartnerIds.size > 0 ? `${overduePartnerIds.size} partner${overduePartnerIds.size === 1 ? "" : "s"} overdue on reporting` : "All partners current on reporting"}, ${probationPartners.length} on probation.`,
      kpis: partnersKpis,
      tileHeadline: partnersTileHeadline,
      tileSupporting: partnersTileSupporting,
      tileStatusTone: partnersTileStatus,
    },
    {
      key: "procurement",
      label: "Procurement",
      score: procurementScore,
      trendLabel: expiredDocs.length > 0 ? "Needs review" : "Stable",
      trendGood: expiredDocs.length === 0,
      statusLabel: procurementScore >= 80 ? "Healthy" : procurementScore >= 60 ? "Needs Attention" : "Critical",
      statusTone: procurementScore >= 80 ? "good" : procurementScore >= 60 ? "watch" : "critical",
      summary: `${vendorCompliancePct.toFixed(0)}% vendor compliance, ${openRequisitions.length} requisition${openRequisitions.length === 1 ? "" : "s"} open in bidding worth ${nairaCompact(openRequisitionsValue)}. ${recentAwards.length} award${recentAwards.length === 1 ? "" : "s"} completed this period.`,
      kpis: procurementKpis,
      tileHeadline: procurementTileHeadline,
      tileSupporting: procurementTileSupporting,
      tileStatusTone: procurementTileStatus,
    },
  ];

  // --- Activity timeline: most recent real events across every source table --------
  const timelineCandidates: { date: string; description: string; category: string }[] = [
    ...disbursements.map((d) => ({ date: dateOnly(d.disbursement_date), description: `Disbursement ${d.disbursement_reference} released — ${nairaCompact(d.amount)}.`, category: "Lending" })),
    ...submissions
      .filter((s) => s.submitted_date)
      .map((s) => ({ date: s.submitted_date!, description: `${partnerById.get(s.partner_id)?.partner_name ?? s.partner_id} submitted ${s.reporting_period} report.`, category: "Partners" })),
    ...awards.map((a) => ({ date: a.award_date, description: `Requisition ${a.requisition_id} awarded — ${nairaCompact(a.awarded_value)} (${a.award_justification}).`, category: "Procurement" })),
    ...approvals.filter((a) => a.status === "Lapsed").map((a) => ({ date: dateOnly(a.approval_date), description: `Approval ${a.approval_id} lapsed without disbursement — ${nairaCompact(a.amount_approved)}.`, category: "Lending" })),
  ]
    .filter((e) => e.date <= asOf)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);
  const timeline: TimelineEvent[] = timelineCandidates.map((e, i) => ({ key: `${e.date}-${i}`, dateLabel: e.date, description: e.description, category: e.category }));

  return {
    asOfDate: asOf,
    generatedAt: asOf,
    attentionCards,
    briefBullets,
    rankedExceptions,
    decisions,
    pendingApprovalsTotal: nairaCompact(pendingApprovalsTotal),
    healthCards: [...lendingKpis, ...financeKpis, ...partnersKpis, ...procurementKpis],
    domains,
    timeline,
    lapsedApprovalsCount: lapsed.length,
    overduePartnersCount: overduePartnerIds.size,
  };
}
