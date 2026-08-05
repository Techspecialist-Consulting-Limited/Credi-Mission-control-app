// Row shapes match the exact CSV columns in mock-data-crdi-proto (verified
// against live headers 2026-08-04) - see that repo's README for the full
// business-rule and relationship documentation behind each field.

// --- Lending/ -----------------------------------------------------------

export interface LendingBeneficiary {
  beneficiary_id: string;
  external_ref: string;
  state: string;
  sector: string;
  gender: string;
  age_band: string;
  employment_category: string;
}

export interface LendingApplication {
  application_id: string;
  beneficiary_id: string;
  pfi_id: string;
  product: string;
  amount_requested: number;
  state: string;
  sector: string;
  submitted_date: string;
  status: "Approved" | "Rejected" | "Under Review" | string;
  decision_reason: string | null;
  first_time_borrower_flag: boolean;
}

export interface LendingApproval {
  approval_id: string;
  application_id: string;
  amount_approved: number;
  approved_by: string;
  approval_date: string;
  conditions: string | null;
  status: "Disbursed" | "Lapsed" | string;
}

export interface LendingDisbursement {
  disbursement_id: string;
  approval_id: string;
  amount: number;
  disbursement_date: string;
  disbursement_reference: string;
  status: string;
}

export interface LendingRepayment {
  repayment_id: string;
  disbursement_id: string;
  instalment_number: number;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  paid_date: string | null;
  days_overdue: number;
  status: "Paid" | "Paid Late" | "Partially Paid" | "Overdue" | "Defaulted" | "Scheduled" | string;
}

// --- PFI Partner Portal/ -------------------------------------------------

export interface PfiPartner {
  partner_id: string;
  partner_name: string;
  institution_type: string;
  region: string;
  onboarding_date: string;
  approved_limit: number;
  zdf_exposure: number;
  status: string;
}

export interface PfiSubmission {
  submission_id: string;
  partner_id: string;
  reporting_period: string;
  submitted_date: string | null;
  due_date: string;
  record_count: number;
  status: "Submitted" | "Late" | "Overdue" | "Not Due" | string;
}

export interface PfiBorrower {
  borrower_ref: string;
  partner_id: string;
  beneficiary_id: string | null;
  state: string;
  sector: string;
  gender: string;
  age_band: string;
  employment_category: string;
}

export interface PfiPortfolioRecord {
  record_id: string;
  submission_id: string;
  partner_id: string;
  borrower_ref: string;
  disbursement_id: string | null;
  funding_source: "ZDF Facility" | "Partner Own Book" | string;
  amount: number;
  disbursed_date: string;
  repayment_status: "Current" | "In Arrears" | "Defaulted" | string;
  arrears_days: number;
}

// --- finance/ -------------------------------------------------------------

export interface FinanceFundingSource {
  source_id: string;
  funder: string;
  facility_amount: number;
  drawn: number;
  available: number;
  tenor: string;
  rate: number;
}

export interface FinanceDrawdown {
  drawdown_id: string;
  source_id: string;
  drawdown_date: string;
  amount: number;
  purpose: string;
  status: string;
}

export interface FinanceBudgetLine {
  budget_id: string;
  department: string;
  category: string;
  fiscal_period: string;
  budgeted_amount: number;
  committed: number;
  actual: number;
  utilisation_pct: number;
}

export interface FinancePayment {
  payment_id: string;
  voucher_number: string;
  payment_type: "Loan Disbursement" | "Vendor Payment" | string;
  payee: string;
  payee_type: string;
  amount: number;
  payment_date: string;
  disbursement_id: string | null;
  invoice_id: string | null;
  source_id: string;
  budget_id: string;
  reference: string;
  status: string;
}

export interface FinanceTreasuryPosition {
  position_id: string;
  date: string;
  cash_balance: number;
  committed_funds: number;
  facility_drawn: number;
  cost_of_funds: number;
}

// --- procurement/ ---------------------------------------------------------

export interface ProcurementVendor {
  vendor_id: string;
  vendor_name: string;
  category: string;
  registration_date: string;
  status: "Active" | "Suspended" | string;
}

export interface ProcurementComplianceDocument {
  document_id: string;
  vendor_id: string;
  document_type: string;
  issue_date: string;
  expiry_date: string;
  status: "Valid" | "Expired" | string;
}

export interface ProcurementRequisition {
  requisition_id: string;
  department: string;
  category: string;
  budget_id: string;
  estimated_value: number;
  raised_date: string;
  status: "Awarded" | "Bidding" | "Cancelled" | string;
  cancellation_reason: string | null;
}

export interface ProcurementBid {
  bid_id: string;
  requisition_id: string;
  vendor_id: string;
  bid_amount: number;
  submitted_date: string;
  responsive_flag: boolean;
}

export interface ProcurementAward {
  award_id: string;
  requisition_id: string;
  bid_id: string;
  vendor_id: string;
  awarded_value: number;
  award_date: string;
  award_justification: string;
}

export interface ProcurementContract {
  contract_id: string;
  award_id: string;
  vendor_id: string;
  contract_value: number;
  start_date: string;
  end_date: string;
  delivery_status: "Completed" | "In Progress" | "Not Started" | "Delayed" | string;
  variations: number;
  variation_value: number;
}

export interface ProcurementContractVariation {
  variation_id: string;
  contract_id: string;
  variation_date: string;
  variation_amount: number;
  reason: string;
}

export interface ProcurementInvoice {
  invoice_id: string;
  contract_id: string;
  requisition_id: string;
  vendor_id: string;
  amount: number;
  invoice_date: string;
  due_date: string;
  status: string;
}
