import { bool, fetchCsv, num, strOrNull } from "./csv";
import type {
  FinanceBudgetLine,
  FinanceDrawdown,
  FinanceFundingSource,
  FinancePayment,
  FinanceTreasuryPosition,
  LendingApplication,
  LendingApproval,
  LendingBeneficiary,
  LendingDisbursement,
  LendingRepayment,
  PfiBorrower,
  PfiPartner,
  PfiPortfolioRecord,
  PfiSubmission,
  ProcurementAward,
  ProcurementBid,
  ProcurementComplianceDocument,
  ProcurementContract,
  ProcurementContractVariation,
  ProcurementInvoice,
  ProcurementRequisition,
  ProcurementVendor,
} from "./types";

// --- Lending/ -------------------------------------------------------------

export const fetchLendingBeneficiaries = () =>
  fetchCsv<LendingBeneficiary>("Lending", "lending_beneficiaries", (c) => ({
    beneficiary_id: c.beneficiary_id,
    external_ref: c.external_ref,
    state: c.state,
    sector: c.sector,
    gender: c.gender,
    age_band: c.age_band,
    employment_category: c.employment_category,
  }));

export const fetchLendingApplications = () =>
  fetchCsv<LendingApplication>("Lending", "lending_applications", (c) => ({
    application_id: c.application_id,
    beneficiary_id: c.beneficiary_id,
    pfi_id: c.pfi_id,
    product: c.product,
    amount_requested: num(c.amount_requested),
    state: c.state,
    sector: c.sector,
    submitted_date: c.submitted_date,
    status: c.status,
    decision_reason: strOrNull(c.decision_reason),
    first_time_borrower_flag: bool(c.first_time_borrower_flag),
  }));

export const fetchLendingApprovals = () =>
  fetchCsv<LendingApproval>("Lending", "lending_approvals", (c) => ({
    approval_id: c.approval_id,
    application_id: c.application_id,
    amount_approved: num(c.amount_approved),
    approved_by: c.approved_by,
    approval_date: c.approval_date,
    conditions: strOrNull(c.conditions),
    status: c.status,
  }));

export const fetchLendingDisbursements = () =>
  fetchCsv<LendingDisbursement>("Lending", "lending_disbursements", (c) => ({
    disbursement_id: c.disbursement_id,
    approval_id: c.approval_id,
    amount: num(c.amount),
    disbursement_date: c.disbursement_date,
    disbursement_reference: c.disbursement_reference,
    status: c.status,
  }));

export const fetchLendingRepayments = () =>
  fetchCsv<LendingRepayment>("Lending", "lending_repayments", (c) => ({
    repayment_id: c.repayment_id,
    disbursement_id: c.disbursement_id,
    instalment_number: num(c.instalment_number),
    amount_due: num(c.amount_due),
    amount_paid: num(c.amount_paid),
    due_date: c.due_date,
    paid_date: strOrNull(c.paid_date),
    days_overdue: num(c.days_overdue),
    status: c.status,
  }));

// --- PFI Partner Portal/ ---------------------------------------------------

export const fetchPfiPartners = () =>
  fetchCsv<PfiPartner>("PFI Partner Portal", "pfi_partners", (c) => ({
    partner_id: c.partner_id,
    partner_name: c.partner_name,
    institution_type: c.institution_type,
    region: c.region,
    onboarding_date: c.onboarding_date,
    approved_limit: num(c.approved_limit),
    zdf_exposure: num(c.zdf_exposure),
    status: c.status,
  }));

export const fetchPfiSubmissions = () =>
  fetchCsv<PfiSubmission>("PFI Partner Portal", "pfi_submissions", (c) => ({
    submission_id: c.submission_id,
    partner_id: c.partner_id,
    reporting_period: c.reporting_period,
    submitted_date: strOrNull(c.submitted_date),
    due_date: c.due_date,
    record_count: num(c.record_count),
    status: c.status,
  }));

export const fetchPfiBorrowers = () =>
  fetchCsv<PfiBorrower>("PFI Partner Portal", "pfi_borrowers", (c) => ({
    borrower_ref: c.borrower_ref,
    partner_id: c.partner_id,
    beneficiary_id: strOrNull(c.beneficiary_id),
    state: c.state,
    sector: c.sector,
    gender: c.gender,
    age_band: c.age_band,
    employment_category: c.employment_category,
  }));

export const fetchPfiPortfolioRecords = () =>
  fetchCsv<PfiPortfolioRecord>("PFI Partner Portal", "pfi_portfolio_records", (c) => ({
    record_id: c.record_id,
    submission_id: c.submission_id,
    partner_id: c.partner_id,
    borrower_ref: c.borrower_ref,
    disbursement_id: strOrNull(c.disbursement_id),
    funding_source: c.funding_source,
    amount: num(c.amount),
    disbursed_date: c.disbursed_date,
    repayment_status: c.repayment_status,
    arrears_days: num(c.arrears_days),
  }));

// --- finance/ ---------------------------------------------------------------

export const fetchFinanceFundingSources = () =>
  fetchCsv<FinanceFundingSource>("finance", "finance_funding_sources", (c) => ({
    source_id: c.source_id,
    funder: c.funder,
    facility_amount: num(c.facility_amount),
    drawn: num(c.drawn),
    available: num(c.available),
    tenor: c.tenor,
    rate: num(c.rate),
  }));

export const fetchFinanceDrawdowns = () =>
  fetchCsv<FinanceDrawdown>("finance", "finance_drawdowns", (c) => ({
    drawdown_id: c.drawdown_id,
    source_id: c.source_id,
    drawdown_date: c.drawdown_date,
    amount: num(c.amount),
    purpose: c.purpose,
    status: c.status,
  }));

export const fetchFinanceBudgetLines = () =>
  fetchCsv<FinanceBudgetLine>("finance", "finance_budget_lines", (c) => ({
    budget_id: c.budget_id,
    department: c.department,
    category: c.category,
    fiscal_period: c.fiscal_period,
    budgeted_amount: num(c.budgeted_amount),
    committed: num(c.committed),
    actual: num(c.actual),
    utilisation_pct: num(c.utilisation_pct),
  }));

export const fetchFinancePayments = () =>
  fetchCsv<FinancePayment>("finance", "finance_payments", (c) => ({
    payment_id: c.payment_id,
    voucher_number: c.voucher_number,
    payment_type: c.payment_type,
    payee: c.payee,
    payee_type: c.payee_type,
    amount: num(c.amount),
    payment_date: c.payment_date,
    disbursement_id: strOrNull(c.disbursement_id),
    invoice_id: strOrNull(c.invoice_id),
    source_id: c.source_id,
    budget_id: c.budget_id,
    reference: c.reference,
    status: c.status,
  }));

export const fetchFinanceTreasuryPositions = () =>
  fetchCsv<FinanceTreasuryPosition>("finance", "finance_treasury_positions", (c) => ({
    position_id: c.position_id,
    date: c.date,
    cash_balance: num(c.cash_balance),
    committed_funds: num(c.committed_funds),
    facility_drawn: num(c.facility_drawn),
    cost_of_funds: num(c.cost_of_funds),
  }));

// --- procurement/ -----------------------------------------------------------

export const fetchProcurementVendors = () =>
  fetchCsv<ProcurementVendor>("procurement", "procurement_vendors", (c) => ({
    vendor_id: c.vendor_id,
    vendor_name: c.vendor_name,
    category: c.category,
    registration_date: c.registration_date,
    status: c.status,
  }));

export const fetchProcurementComplianceDocuments = () =>
  fetchCsv<ProcurementComplianceDocument>("procurement", "procurement_compliance_documents", (c) => ({
    document_id: c.document_id,
    vendor_id: c.vendor_id,
    document_type: c.document_type,
    issue_date: c.issue_date,
    expiry_date: c.expiry_date,
    status: c.status,
  }));

export const fetchProcurementRequisitions = () =>
  fetchCsv<ProcurementRequisition>("procurement", "procurement_requisitions", (c) => ({
    requisition_id: c.requisition_id,
    department: c.department,
    category: c.category,
    budget_id: c.budget_id,
    estimated_value: num(c.estimated_value),
    raised_date: c.raised_date,
    status: c.status,
    cancellation_reason: strOrNull(c.cancellation_reason),
  }));

export const fetchProcurementBids = () =>
  fetchCsv<ProcurementBid>("procurement", "procurement_bids", (c) => ({
    bid_id: c.bid_id,
    requisition_id: c.requisition_id,
    vendor_id: c.vendor_id,
    bid_amount: num(c.bid_amount),
    submitted_date: c.submitted_date,
    responsive_flag: bool(c.responsive_flag),
  }));

export const fetchProcurementAwards = () =>
  fetchCsv<ProcurementAward>("procurement", "procurement_awards", (c) => ({
    award_id: c.award_id,
    requisition_id: c.requisition_id,
    bid_id: c.bid_id,
    vendor_id: c.vendor_id,
    awarded_value: num(c.awarded_value),
    award_date: c.award_date,
    award_justification: c.award_justification,
  }));

export const fetchProcurementContracts = () =>
  fetchCsv<ProcurementContract>("procurement", "procurement_contracts", (c) => ({
    contract_id: c.contract_id,
    award_id: c.award_id,
    vendor_id: c.vendor_id,
    contract_value: num(c.contract_value),
    start_date: c.start_date,
    end_date: c.end_date,
    delivery_status: c.delivery_status,
    variations: num(c.variations),
    variation_value: num(c.variation_value),
  }));

export const fetchProcurementContractVariations = () =>
  fetchCsv<ProcurementContractVariation>("procurement", "procurement_contract_variations", (c) => ({
    variation_id: c.variation_id,
    contract_id: c.contract_id,
    variation_date: c.variation_date,
    variation_amount: num(c.variation_amount),
    reason: c.reason,
  }));

export const fetchProcurementInvoices = () =>
  fetchCsv<ProcurementInvoice>("procurement", "procurement_invoices", (c) => ({
    invoice_id: c.invoice_id,
    contract_id: c.contract_id,
    requisition_id: c.requisition_id,
    vendor_id: c.vendor_id,
    amount: num(c.amount),
    invoice_date: c.invoice_date,
    due_date: c.due_date,
    status: c.status,
  }));
