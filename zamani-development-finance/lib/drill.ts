import { dateOnly, daysBetween, getAsOfDate, nairaCompact } from "./kpis";
import {
  fetchFinanceBudgetLines,
  fetchFinanceDrawdowns,
  fetchFinanceFundingSources,
  fetchFinancePayments,
  fetchFinanceTreasuryPositions,
  fetchLendingApplications,
  fetchLendingApprovals,
  fetchLendingBeneficiaries,
  fetchLendingDisbursements,
  fetchLendingRepayments,
  fetchPfiBorrowers,
  fetchPfiPartners,
  fetchPfiPortfolioRecords,
  fetchPfiSubmissions,
  fetchProcurementAwards,
  fetchProcurementBids,
  fetchProcurementComplianceDocuments,
  fetchProcurementContractVariations,
  fetchProcurementContracts,
  fetchProcurementInvoices,
  fetchProcurementRequisitions,
  fetchProcurementVendors,
} from "./repo";

// ─── Shared: resolve a partner (pfi_id) and product/state for any Lending ──────
// record via approval_id -> application_id, since neither repayments nor
// disbursements carry partner attribution directly.

async function loadLendingContext() {
  const [approvals, applications, partners] = await Promise.all([
    fetchLendingApprovals(),
    fetchLendingApplications(),
    fetchPfiPartners(),
  ]);
  const approvalById = new Map(approvals.map((a) => [a.approval_id, a]));
  const applicationById = new Map(applications.map((a) => [a.application_id, a]));
  const partnerById = new Map(partners.map((p) => [p.partner_id, p]));
  return { approvals, applications, partners, approvalById, applicationById, partnerById };
}

export interface PartnerGroup {
  partnerId: string;
  partnerName: string;
  institutionType: string;
  count: number;
  totalAmount: string;
  rawTotal: number;
}

// ─── KPI 1: Approved but not yet paid (lapsed approvals) ──────────────────────

export interface LapsedApprovalRecord {
  approvalId: string;
  applicationId: string;
  amount: string;
  approvalDate: string;
  approvedBy: string;
  conditions: string | null;
  daysLapsed: number;
  product: string;
  state: string;
}

export async function getLapsedApprovalsByPartner(): Promise<{
  asOf: string;
  totalCount: number;
  totalAmount: string;
  groups: PartnerGroup[];
}> {
  const [{ approvals, applications, partnerById }, asOf] = await Promise.all([loadLendingContext(), getAsOfDate()]);
  const appById = new Map(applications.map((a) => [a.application_id, a]));
  const lapsed = approvals.filter((a) => a.status === "Lapsed");

  const groups = new Map<string, { count: number; total: number }>();
  for (const a of lapsed) {
    const pfiId = appById.get(a.application_id)?.pfi_id ?? "unattributed";
    const g = groups.get(pfiId) ?? { count: 0, total: 0 };
    g.count += 1;
    g.total += a.amount_approved;
    groups.set(pfiId, g);
  }

  const groupList: PartnerGroup[] = [...groups.entries()]
    .map(([pfiId, g]) => {
      const partner = partnerById.get(pfiId);
      return {
        partnerId: pfiId,
        partnerName: partner?.partner_name ?? "Unattributed",
        institutionType: partner?.institution_type ?? "—",
        count: g.count,
        totalAmount: nairaCompact(g.total),
        rawTotal: g.total,
      };
    })
    .sort((a, b) => b.rawTotal - a.rawTotal);

  return {
    asOf,
    totalCount: lapsed.length,
    totalAmount: nairaCompact(lapsed.reduce((s, a) => s + a.amount_approved, 0)),
    groups: groupList,
  };
}

export async function getLapsedApprovalsForPartner(
  partnerId: string
): Promise<{ partnerName: string; records: LapsedApprovalRecord[] }> {
  const [{ approvals, applications, partnerById }, asOf] = await Promise.all([loadLendingContext(), getAsOfDate()]);
  const appById = new Map(applications.map((a) => [a.application_id, a]));

  const records: LapsedApprovalRecord[] = approvals
    .filter((a) => a.status === "Lapsed")
    .map((a) => {
      const app = appById.get(a.application_id);
      if (!app || app.pfi_id !== partnerId) return null;
      return {
        approvalId: a.approval_id,
        applicationId: a.application_id,
        amount: nairaCompact(a.amount_approved),
        approvalDate: dateOnly(a.approval_date),
        approvedBy: a.approved_by,
        conditions: a.conditions,
        daysLapsed: daysBetween(a.approval_date, asOf),
        product: app.product,
        state: app.state,
      };
    })
    .filter((r): r is LapsedApprovalRecord => r !== null)
    .sort((a, b) => b.daysLapsed - a.daysLapsed);

  return { partnerName: partnerById.get(partnerId)?.partner_name ?? partnerId, records };
}

// ─── KPI 2: Portfolio health — PAR30 (arrears) ─────────────────────────────────

export interface ArrearsRecord {
  repaymentId: string;
  disbursementId: string;
  amountOutstanding: string;
  dueDate: string;
  daysOverdue: number;
  product: string;
  state: string;
  status: string;
}

async function loadArrearsContext() {
  const [repayments, disbursements, ctx] = await Promise.all([
    fetchLendingRepayments(),
    fetchLendingDisbursements(),
    loadLendingContext(),
  ]);
  const disbById = new Map(disbursements.map((d) => [d.disbursement_id, d]));
  const arrears = repayments.filter((r) => r.days_overdue >= 30 && r.amount_due > r.amount_paid);

  const resolve = (disbursementId: string) => {
    const disb = disbById.get(disbursementId);
    const approval = disb ? ctx.approvalById.get(disb.approval_id) : undefined;
    const app = approval ? ctx.applicationById.get(approval.application_id) : undefined;
    return app ? { pfiId: app.pfi_id, product: app.product, state: app.state } : undefined;
  };

  return { arrears, resolve, partnerById: ctx.partnerById };
}

export async function getArrearsByPartner(): Promise<{
  totalCount: number;
  totalOutstanding: string;
  groups: PartnerGroup[];
}> {
  const { arrears, resolve, partnerById } = await loadArrearsContext();

  const groups = new Map<string, { count: number; total: number }>();
  let totalOutstanding = 0;
  for (const r of arrears) {
    const outstanding = r.amount_due - r.amount_paid;
    totalOutstanding += outstanding;
    const attribution = resolve(r.disbursement_id);
    const pfiId = attribution?.pfiId ?? "unattributed";
    const g = groups.get(pfiId) ?? { count: 0, total: 0 };
    g.count += 1;
    g.total += outstanding;
    groups.set(pfiId, g);
  }

  const groupList: PartnerGroup[] = [...groups.entries()]
    .map(([pfiId, g]) => {
      const partner = partnerById.get(pfiId);
      return {
        partnerId: pfiId,
        partnerName: partner?.partner_name ?? "Unattributed",
        institutionType: partner?.institution_type ?? "—",
        count: g.count,
        totalAmount: nairaCompact(g.total),
        rawTotal: g.total,
      };
    })
    .sort((a, b) => b.rawTotal - a.rawTotal);

  return { totalCount: arrears.length, totalOutstanding: nairaCompact(totalOutstanding), groups: groupList };
}

export async function getArrearsForPartner(partnerId: string): Promise<{ partnerName: string; records: ArrearsRecord[] }> {
  const { arrears, resolve, partnerById } = await loadArrearsContext();

  const records: ArrearsRecord[] = arrears
    .map((r) => {
      const attribution = resolve(r.disbursement_id);
      if (!attribution || attribution.pfiId !== partnerId) return null;
      return {
        repaymentId: r.repayment_id,
        disbursementId: r.disbursement_id,
        amountOutstanding: nairaCompact(r.amount_due - r.amount_paid),
        dueDate: r.due_date,
        daysOverdue: r.days_overdue,
        product: attribution.product,
        state: attribution.state,
        status: r.status,
      };
    })
    .filter((r): r is ArrearsRecord => r !== null)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  return { partnerName: partnerById.get(partnerId)?.partner_name ?? partnerId, records };
}

// ─── KPI 3: Mandate reach — beneficiaries served ───────────────────────────────

export interface StateGroup {
  state: string;
  count: number;
}

export interface SectorSegment {
  sector: string;
  count: number;
  firstTimeBorrowerCount: number;
}

async function loadReachedBeneficiaries() {
  const [beneficiaries, applications, approvals, disbursements] = await Promise.all([
    fetchLendingBeneficiaries(),
    fetchLendingApplications(),
    fetchLendingApprovals(),
    fetchLendingDisbursements(),
  ]);
  const appById = new Map(applications.map((a) => [a.application_id, a]));
  const approvalById = new Map(approvals.map((a) => [a.approval_id, a]));

  // "Reached" = has at least one real disbursement, same definition kpis.ts
  // uses for the mandate-reach headline figure - keep both in sync.
  const reachedIds = new Set<string>();
  const firstTimeIds = new Set<string>();
  for (const d of disbursements) {
    const app = approvalById.get(d.approval_id);
    const application = app ? appById.get(app.application_id) : undefined;
    if (!application) continue;
    reachedIds.add(application.beneficiary_id);
    if (application.first_time_borrower_flag) firstTimeIds.add(application.beneficiary_id);
  }

  return { beneficiaries: beneficiaries.filter((b) => reachedIds.has(b.beneficiary_id)), firstTimeIds };
}

export async function getMandateReachByState(): Promise<{ totalCount: number; groups: StateGroup[] }> {
  const { beneficiaries } = await loadReachedBeneficiaries();
  const byState = new Map<string, number>();
  for (const b of beneficiaries) byState.set(b.state, (byState.get(b.state) ?? 0) + 1);
  const groups = [...byState.entries()].map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count);
  return { totalCount: beneficiaries.length, groups };
}

export async function getMandateReachSegments(state: string): Promise<{ state: string; totalCount: number; segments: SectorSegment[] }> {
  const { beneficiaries, firstTimeIds } = await loadReachedBeneficiaries();
  const inState = beneficiaries.filter((b) => b.state === state);
  const bySector = new Map<string, { count: number; firstTime: number }>();
  for (const b of inState) {
    const g = bySector.get(b.sector) ?? { count: 0, firstTime: 0 };
    g.count += 1;
    if (firstTimeIds.has(b.beneficiary_id)) g.firstTime += 1;
    bySector.set(b.sector, g);
  }
  const segments: SectorSegment[] = [...bySector.entries()]
    .map(([sector, g]) => ({ sector, count: g.count, firstTimeBorrowerCount: g.firstTime }))
    .sort((a, b) => b.count - a.count);
  return { state, totalCount: inState.length, segments };
}

// ─── CFO drill: Budget vs actual, by department ────────────────────────────────

export interface BudgetDeptGroup {
  department: string;
  budgeted: string;
  actual: string;
  variance: string;
  rawVariance: number;
  utilisationPct: number;
}

export async function getBudgetOverrunByDepartment(): Promise<{ totalBudgeted: string; totalActual: string; groups: BudgetDeptGroup[] }> {
  const lines = await fetchFinanceBudgetLines();
  const byDept = new Map<string, { budgeted: number; actual: number }>();
  for (const b of lines) {
    const g = byDept.get(b.department) ?? { budgeted: 0, actual: 0 };
    g.budgeted += b.budgeted_amount;
    g.actual += b.actual;
    byDept.set(b.department, g);
  }
  const groups: BudgetDeptGroup[] = [...byDept.entries()]
    .map(([department, g]) => ({
      department,
      budgeted: nairaCompact(g.budgeted),
      actual: nairaCompact(g.actual),
      variance: nairaCompact(Math.abs(g.actual - g.budgeted)),
      rawVariance: g.actual - g.budgeted,
      utilisationPct: g.budgeted > 0 ? (g.actual / g.budgeted) * 100 : 0,
    }))
    .sort((a, b) => b.rawVariance - a.rawVariance);
  return {
    totalBudgeted: nairaCompact(lines.reduce((s, b) => s + b.budgeted_amount, 0)),
    totalActual: nairaCompact(lines.reduce((s, b) => s + b.actual, 0)),
    groups,
  };
}

export interface BudgetLineRecord {
  budgetId: string;
  category: string;
  fiscalPeriod: string;
  budgeted: string;
  committed: string;
  actual: string;
  utilisationPct: number;
  overBudget: boolean;
}

export async function getBudgetLinesForDepartment(department: string): Promise<{ department: string; records: BudgetLineRecord[] }> {
  const lines = await fetchFinanceBudgetLines();
  const records: BudgetLineRecord[] = lines
    .filter((b) => b.department === department)
    .map((b) => ({
      budgetId: b.budget_id,
      category: b.category,
      fiscalPeriod: b.fiscal_period,
      budgeted: nairaCompact(b.budgeted_amount),
      committed: nairaCompact(b.committed),
      actual: nairaCompact(b.actual),
      utilisationPct: b.utilisation_pct,
      overBudget: b.actual > b.budgeted_amount,
    }))
    .sort((a, b) => Number(b.overBudget) - Number(a.overBudget));
  return { department, records };
}

// ─── Procurement drill: Open pipeline, by department ───────────────────────────

export interface RequisitionDeptGroup {
  department: string;
  count: number;
  totalValue: string;
  rawTotal: number;
}

export async function getOpenRequisitionsByDepartment(): Promise<{ totalCount: number; totalValue: string; groups: RequisitionDeptGroup[] }> {
  const requisitions = await fetchProcurementRequisitions();
  const open = requisitions.filter((r) => r.status === "Bidding");
  const byDept = new Map<string, { count: number; total: number }>();
  for (const r of open) {
    const g = byDept.get(r.department) ?? { count: 0, total: 0 };
    g.count += 1;
    g.total += r.estimated_value;
    byDept.set(r.department, g);
  }
  const groups: RequisitionDeptGroup[] = [...byDept.entries()]
    .map(([department, g]) => ({ department, count: g.count, totalValue: nairaCompact(g.total), rawTotal: g.total }))
    .sort((a, b) => b.rawTotal - a.rawTotal);
  return { totalCount: open.length, totalValue: nairaCompact(open.reduce((s, r) => s + r.estimated_value, 0)), groups };
}

export interface OpenRequisitionRecord {
  requisitionId: string;
  category: string;
  estimatedValue: string;
  raisedDate: string;
  daysOpen: number;
  bidCount: number;
}

export async function getOpenRequisitionsForDepartment(department: string): Promise<{ department: string; records: OpenRequisitionRecord[] }> {
  const [requisitions, bids, asOf] = await Promise.all([fetchProcurementRequisitions(), fetchProcurementBids(), getAsOfDate()]);
  const bidCountByReq = new Map<string, number>();
  for (const b of bids) bidCountByReq.set(b.requisition_id, (bidCountByReq.get(b.requisition_id) ?? 0) + 1);
  const records: OpenRequisitionRecord[] = requisitions
    .filter((r) => r.status === "Bidding" && r.department === department)
    .map((r) => ({
      requisitionId: r.requisition_id,
      category: r.category,
      estimatedValue: nairaCompact(r.estimated_value),
      raisedDate: dateOnly(r.raised_date),
      daysOpen: daysBetween(r.raised_date, asOf),
      bidCount: bidCountByReq.get(r.requisition_id) ?? 0,
    }))
    .sort((a, b) => b.daysOpen - a.daysOpen);
  return { department, records };
}

// ─── ICT drill: connected source systems, real table/row counts ───────────────
// No platform telemetry exists to drill into (see lib/personas.ts's
// getIctOverview note) - this instead surfaces exactly what's genuinely
// verifiable: real row counts, live-computed, across all 22 source tables.

export interface DataSourceTable {
  table: string;
  rows: number;
}

export interface DataSourceSystem {
  system: string;
  tables: DataSourceTable[];
  totalRows: number;
}

export async function getDataSourceOverview(): Promise<{ asOf: string; systems: DataSourceSystem[] }> {
  const [
    beneficiaries, applications, approvals, disbursements, repayments,
    partners, submissions, borrowers, portfolioRecords,
    fundingSources, drawdowns, budgetLines, payments, treasuryPositions,
    vendors, complianceDocs, requisitions, bids, awards, contracts, variations, invoices,
    asOf,
  ] = await Promise.all([
    fetchLendingBeneficiaries(), fetchLendingApplications(), fetchLendingApprovals(), fetchLendingDisbursements(), fetchLendingRepayments(),
    fetchPfiPartners(), fetchPfiSubmissions(), fetchPfiBorrowers(), fetchPfiPortfolioRecords(),
    fetchFinanceFundingSources(), fetchFinanceDrawdowns(), fetchFinanceBudgetLines(), fetchFinancePayments(), fetchFinanceTreasuryPositions(),
    fetchProcurementVendors(), fetchProcurementComplianceDocuments(), fetchProcurementRequisitions(), fetchProcurementBids(), fetchProcurementAwards(), fetchProcurementContracts(), fetchProcurementContractVariations(), fetchProcurementInvoices(),
    getAsOfDate(),
  ]);

  const systems: DataSourceSystem[] = [
    {
      system: "ZDF (CMS)",
      tables: [
        { table: "lending_beneficiaries", rows: beneficiaries.length },
        { table: "lending_applications", rows: applications.length },
        { table: "lending_approvals", rows: approvals.length },
        { table: "lending_disbursements", rows: disbursements.length },
        { table: "lending_repayments", rows: repayments.length },
      ],
      totalRows: beneficiaries.length + applications.length + approvals.length + disbursements.length + repayments.length,
    },
    {
      system: "ZDF PFI Partners Portal",
      tables: [
        { table: "pfi_partners", rows: partners.length },
        { table: "pfi_submissions", rows: submissions.length },
        { table: "pfi_borrowers", rows: borrowers.length },
        { table: "pfi_portfolio_records", rows: portfolioRecords.length },
      ],
      totalRows: partners.length + submissions.length + borrowers.length + portfolioRecords.length,
    },
    {
      system: "Microsoft Dynamics (ERP)",
      tables: [
        { table: "finance_funding_sources", rows: fundingSources.length },
        { table: "finance_drawdowns", rows: drawdowns.length },
        { table: "finance_budget_lines", rows: budgetLines.length },
        { table: "finance_payments", rows: payments.length },
        { table: "finance_treasury_positions", rows: treasuryPositions.length },
      ],
      totalRows: fundingSources.length + drawdowns.length + budgetLines.length + payments.length + treasuryPositions.length,
    },
    {
      system: "ZDF e-Procurement Portal",
      tables: [
        { table: "procurement_vendors", rows: vendors.length },
        { table: "procurement_compliance_documents", rows: complianceDocs.length },
        { table: "procurement_requisitions", rows: requisitions.length },
        { table: "procurement_bids", rows: bids.length },
        { table: "procurement_awards", rows: awards.length },
        { table: "procurement_contracts", rows: contracts.length },
        { table: "procurement_contract_variations", rows: variations.length },
        { table: "procurement_invoices", rows: invoices.length },
      ],
      totalRows: vendors.length + complianceDocs.length + requisitions.length + bids.length + awards.length + contracts.length + variations.length + invoices.length,
    },
  ];

  return { asOf, systems };
}
