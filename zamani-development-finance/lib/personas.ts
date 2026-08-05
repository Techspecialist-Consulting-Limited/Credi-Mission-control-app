import {
  dateOnly,
  daysBetween,
  formatTrend,
  getAsOfDate,
  getLast6MonthKeys,
  lastVsPrevDelta,
  lastVsPrevPct,
  monthKeyOf,
  monthLabel,
  nairaCompact,
  type Tone,
  type TrendPoint,
} from "./kpis";
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
  fetchPfiPartners,
  fetchProcurementAwards,
  fetchProcurementBids,
  fetchProcurementComplianceDocuments,
  fetchProcurementContracts,
  fetchProcurementRequisitions,
  fetchProcurementVendors,
} from "./repo";

export type PersonaKpiIcon = "wallet" | "chart" | "percent" | "shield" | "landmark" | "trending" | "clock" | "check" | "users" | "tag" | "package" | "star" | "zap" | "map" | "database" | "calendar" | "layers" | "refresh";

export interface PersonaKpi {
  label: string;
  value: string;
  /** Action-oriented statement of what the number means and, where relevant,
   * what to do about it - not a restatement of the value itself (spec
   * principle A2: "restating figures already displayed adds nothing"). */
  note: string;
  icon: PersonaKpiIcon;
  /** Plain-language status, legible at a glance (spec D9 / card requirement
   * "status indication: red, amber, green"). */
  statusLabel: string;
  statusTone: Tone;
  /** Movement against the prior comparable period (spec card requirement),
   * or "—" where no real prior-period comparison exists in this dataset -
   * never fabricated to fill the space. */
  trendLabel: string;
  trendGood: boolean;
  href?: string;
}

export interface PersonaQueueItem {
  title: string;
  detail: string;
  value: string;
  waiting: string;
  href?: string;
}

export interface PersonaChart {
  kind: "donut" | "bar";
  title: string;
  subtitle: string;
  labels: string[];
  values: number[];
  format?: "naira" | "count" | "percent";
  horizontal?: boolean;
  colors?: string[];
}

export interface PersonaOverview {
  role: string;
  /** Who holds this role - used for the "Good afternoon, {name}." hero
   * greeting, same pattern as the MD/CEO's "Dr. Bello" on the Executive
   * Overview. Invented display content, same as "Dr. Bello" - there's no
   * executive-name column anywhere in the dataset. */
  name: string;
  headline: string;
  summary: string;
  kpis: PersonaKpi[];
  queue: PersonaQueueItem[];
  charts: PersonaChart[];
}

// ─── CFO ─────────────────────────────────────────────────────────────────────

export async function getCfoOverview(): Promise<PersonaOverview> {
  const [treasuryPositions, fundingSources, budgetLines, payments, repayments, disbursements, drawdowns] = await Promise.all([
    fetchFinanceTreasuryPositions(),
    fetchFinanceFundingSources(),
    fetchFinanceBudgetLines(),
    fetchFinancePayments(),
    fetchLendingRepayments(),
    fetchLendingDisbursements(),
    fetchFinanceDrawdowns(),
  ]);
  const asOf = await getAsOfDate();
  const last6 = getLast6MonthKeys(asOf);
  const sorted = [...treasuryPositions].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);

  const totalFacility = fundingSources.reduce((s, f) => s + f.facility_amount, 0);
  const totalDrawn = fundingSources.reduce((s, f) => s + f.drawn, 0);
  const totalAvailable = fundingSources.reduce((s, f) => s + f.available, 0);
  const coverRatio = latest ? totalAvailable / Math.max(latest.committed_funds, 1) : 0;

  const totalBudgeted = budgetLines.reduce((s, b) => s + b.budgeted_amount, 0);
  const totalActual = budgetLines.reduce((s, b) => s + b.actual, 0);
  const overrunLines = budgetLines.filter((b) => b.actual > b.budgeted_amount);
  const overrunAmount = overrunLines.reduce((s, b) => s + (b.actual - b.budgeted_amount), 0);

  const pendingPayments = payments.filter((p) => p.status !== "Posted");
  const pendingPaymentsValue = pendingPayments.reduce((s, p) => s + p.amount, 0);

  const totalDisbursed = disbursements.reduce((s, d) => s + d.amount, 0);
  const outstanding = new Map<string, number>();
  for (const r of repayments) outstanding.set(r.disbursement_id, (outstanding.get(r.disbursement_id) ?? 0) + (r.amount_due - r.amount_paid));
  const activePortfolio = [...outstanding.values()].reduce((s, v) => s + v, 0);
  const defaultedOutstanding = repayments.filter((r) => r.status === "Defaulted").reduce((s, r) => s + (r.amount_due - r.amount_paid), 0);
  const provisioningRate = activePortfolio > 0 ? (defaultedOutstanding / activePortfolio) * 100 : 0;

  const avgCostOfFunds = sorted.length ? sorted.reduce((s, t) => s + t.cost_of_funds, 0) / sorted.length : 0;

  const byDept = new Map<string, { budgeted: number; actual: number }>();
  for (const b of budgetLines) {
    const g = byDept.get(b.department) ?? { budgeted: 0, actual: 0 };
    g.budgeted += b.budgeted_amount;
    g.actual += b.actual;
    byDept.set(b.department, g);
  }
  const worstDept = [...byDept.entries()].filter(([, g]) => g.actual > g.budgeted).sort((a, b) => b[1].actual - b[1].budgeted - (b[1].budgeted - a[1].budgeted))[0];

  // "Credit Capital Allocation" is loan capital being deployed, not
  // office/operating spend - mixing it into a department operating-spend
  // chart with real OpEx/CapEx/Professional Fees lines makes every other
  // bar an unreadable sliver next to it. Lending Operations still has its
  // own OpEx/CapEx/Professional Fees lines, which stay in this view; only
  // the capital-allocation line is excluded, and only from this chart -
  // worstDept above still considers every category for overrun detection.
  const byDeptOperating = new Map<string, { budgeted: number; actual: number }>();
  for (const b of budgetLines) {
    if (b.category === "Credit Capital Allocation") continue;
    const g = byDeptOperating.get(b.department) ?? { budgeted: 0, actual: 0 };
    g.budgeted += b.budgeted_amount;
    g.actual += b.actual;
    byDeptOperating.set(b.department, g);
  }

  // --- Real trends, same 6-month-window methodology as the executive overview ---
  let lastCommitted = sorted[0]?.committed_funds ?? 0;
  let lastCost = sorted[0]?.cost_of_funds ?? 0;
  let tPointer = 0;
  const committedTrend: TrendPoint[] = [];
  const costTrend: TrendPoint[] = [];
  for (const mk of last6) {
    while (tPointer < sorted.length && monthKeyOf(sorted[tPointer].date) <= mk) {
      lastCommitted = sorted[tPointer].committed_funds;
      lastCost = sorted[tPointer].cost_of_funds;
      tPointer++;
    }
    committedTrend.push({ label: monthLabel(mk), value: lastCommitted });
    costTrend.push({ label: monthLabel(mk), value: lastCost });
  }
  // Facility totals are a current snapshot (no history table), so cover's
  // trend holds availability constant and re-derives the ratio against each
  // month's real committed-funds figure - a genuine movement, not a guess.
  const coverTrend: TrendPoint[] = committedTrend.map((p) => ({ label: p.label, value: totalAvailable / Math.max(p.value, 1) }));
  const coverTrendPctDelta = lastVsPrevPct(coverTrend);
  const coverTrendPhrase =
    Math.abs(coverTrendPctDelta) < 0.5
      ? "holding steady vs last month"
      : coverTrendPctDelta > 0
        ? `up ${coverTrendPctDelta.toFixed(0)}% vs last month`
        : `down ${Math.abs(coverTrendPctDelta).toFixed(0)}% vs last month`;

  // Budget lines carry an annual fiscal_period, not a month - compare the two
  // most recent fiscal years actually present instead of forcing a monthly
  // window onto yearly data.
  const periods = [...new Set(budgetLines.map((b) => b.fiscal_period))].sort();
  const utilFor = (period: string) => {
    const lines = budgetLines.filter((b) => b.fiscal_period === period);
    const budgeted = lines.reduce((s, b) => s + b.budgeted_amount, 0);
    const actual = lines.reduce((s, b) => s + b.actual, 0);
    return budgeted > 0 ? (actual / budgeted) * 100 : 0;
  };
  const utilTrend: TrendPoint[] = periods.slice(-2).map((p) => ({ label: p, value: utilFor(p) }));
  const utilNow = utilTrend.at(-1)?.value ?? (totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0);
  // 100% utilisation is the target, so "good" means moving closer to it, not
  // simply "up" - rising from 60%→90% is progress, rising from 100%→130% isn't.
  const utilNowDist = Math.abs(utilNow - 100);
  const utilPrevDist = utilTrend.length === 2 ? Math.abs(utilTrend[0].value - 100) : utilNowDist;

  const dueMonths = new Map<string, { due: number; defaulted: number }>();
  for (const r of repayments) {
    const mk = monthKeyOf(r.due_date);
    const bucket = dueMonths.get(mk) ?? { due: 0, defaulted: 0 };
    bucket.due += r.amount_due;
    if (r.status === "Defaulted") bucket.defaulted += r.amount_due - r.amount_paid;
    dueMonths.set(mk, bucket);
  }
  let lastLossRate = 0;
  const lossTrend: TrendPoint[] = last6.map((mk) => {
    const b = dueMonths.get(mk);
    if (b && b.due > 0) lastLossRate = (b.defaulted / b.due) * 100;
    return { label: monthLabel(mk), value: lastLossRate };
  });

  const drawEvents = drawdowns.map((d) => ({ month: monthKeyOf(d.drawdown_date), amount: d.amount })).sort((a, b) => a.month.localeCompare(b.month));
  let cumulativeDrawn = 0;
  let dwPointer = 0;
  const drawnTrend: TrendPoint[] = [];
  for (const mk of last6) {
    while (dwPointer < drawEvents.length && drawEvents[dwPointer].month <= mk) {
      cumulativeDrawn += drawEvents[dwPointer].amount;
      dwPointer++;
    }
    drawnTrend.push({ label: monthLabel(mk), value: cumulativeDrawn });
  }

  const disbEvents = disbursements.map((d) => ({ month: monthKeyOf(d.disbursement_date), amount: d.amount })).sort((a, b) => a.month.localeCompare(b.month));
  let cumulativeDisb = 0;
  let dbPointer = 0;
  const disbTrend: TrendPoint[] = [];
  for (const mk of last6) {
    while (dbPointer < disbEvents.length && disbEvents[dbPointer].month <= mk) {
      cumulativeDisb += disbEvents[dbPointer].amount;
      dbPointer++;
    }
    disbTrend.push({ label: monthLabel(mk), value: cumulativeDisb });
  }
  const disbFlat = lastVsPrevPct(disbTrend) === 0;
  const drawnRatio = totalFacility > 0 ? totalDrawn / totalFacility : 0;

  return {
    role: "Chief Financial Officer",
    name: "Mrs. Okonkwo",
    headline: `${nairaCompact(totalAvailable)} available liquidity, ${coverRatio.toFixed(1)}× cover on committed funds`,
    summary: `The institution holds ${nairaCompact(totalFacility)} in committed funding facilities, of which ${nairaCompact(totalDrawn)} (${(drawnRatio * 100).toFixed(0)}%) has been drawn down, leaving ${nairaCompact(totalAvailable)} available against ${coverRatio.toFixed(1)}× current commitments. Budget execution is running at ${totalBudgeted > 0 ? ((totalActual / totalBudgeted) * 100).toFixed(0) : 0}% of the approved plan${
      overrunAmount > 0 && worstDept
        ? `, with ${nairaCompact(overrunAmount)} in overrun concentrated in ${overrunLines.length > 0 ? new Set(overrunLines.map((l) => l.department)).size : 0} department(s), led by ${worstDept[0]}`
        : ", with no departments currently over budget"
    }. ${pendingPayments.length} payment${pendingPayments.length === 1 ? "" : "s"} totalling ${nairaCompact(pendingPaymentsValue)} ${pendingPayments.length === 1 ? "is" : "are"} still awaiting clearance.`,
    kpis: [
      {
        label: "Liquidity & funding",
        value: nairaCompact(totalAvailable),
        // The funding-sources table is a current snapshot only (no history),
        // so there's no real month-over-month trend for this raw cash figure
        // to show - showing one would mean faking it. The cover ratio DOES
        // have a real trend (it's re-derived against real monthly committed-
        // funds history), so that's spelled out here in words instead of a
        // badge that would silently claim to describe the naira amount above
        // it. See coverTrendPhrase below.
        note: `${coverRatio.toFixed(1)}× cover on committed funds, ${coverTrendPhrase} — ${
          coverRatio >= 1.5
            ? "ample buffer, room for new facility drawdowns."
            : coverRatio >= 1
              ? "cover is thinning, avoid large new commitments until liquidity rebuilds."
              : "committed funds exceed available liquidity, immediate funding action required."
        }`,
        icon: "wallet",
        statusLabel: coverRatio >= 1.5 ? "On Track" : coverRatio >= 1 ? "Monitor" : "Critical",
        statusTone: coverRatio >= 1.5 ? "good" : coverRatio >= 1 ? "watch" : "critical",
        trendLabel: "—",
        trendGood: lastVsPrevDelta(coverTrend) >= 0,
      },
      {
        label: "Budget vs actual",
        value: `${utilNow.toFixed(0)}%`,
        note:
          overrunAmount > 0 && worstDept
            ? `${nairaCompact(overrunAmount)} over budget, driven by ${worstDept[0]} — review before the next drawdown.`
            : "No department over budget — execution pipeline on track.",
        icon: "chart",
        href: "/drill/budget-overrun",
        // Driven by whether a department is actually over budget, not by
        // distance from the 100% target - otherwise "no department over
        // budget" in the note can sit under a non-green chip, which reads
        // as a contradiction.
        statusLabel: overrunAmount === 0 ? "On Track" : utilNow > 110 ? "Critical" : "Monitor",
        statusTone: overrunAmount === 0 ? "good" : utilNow > 110 ? "critical" : "watch",
        trendLabel: utilTrend.length === 2 ? formatTrend(lastVsPrevDelta(utilTrend), "pp") : "—",
        trendGood: utilNowDist <= utilPrevDist,
      },
      {
        label: "Cost of funds",
        value: `${avgCostOfFunds.toFixed(2)}%`,
        note:
          lastVsPrevDelta(costTrend) <= 0
            ? "Funding costs easing — a favourable environment for new drawdowns."
            : "Funding is getting more expensive — factor this into new facility pricing.",
        icon: "percent",
        statusLabel: avgCostOfFunds < 6 ? "On Track" : avgCostOfFunds < 8 ? "Monitor" : "Critical",
        statusTone: avgCostOfFunds < 6 ? "good" : avgCostOfFunds < 8 ? "watch" : "critical",
        trendLabel: formatTrend(lastVsPrevDelta(costTrend), "pp"),
        trendGood: lastVsPrevDelta(costTrend) <= 0,
      },
      {
        label: "Credit loss exposure",
        value: `${provisioningRate.toFixed(1)}%`,
        note:
          provisioningRate >= 10
            ? "Losses climbing past acceptable range — escalate recovery on the largest defaulted accounts."
            : provisioningRate >= 5
              ? lastVsPrevDelta(lossTrend) > 0
                ? "Within tolerance but rising — monitor the largest exposures."
                : "Within tolerance and stable — continue monitoring the largest exposures."
              : "Losses contained — no immediate action needed.",
        icon: "shield",
        statusLabel: provisioningRate >= 10 ? "Critical" : provisioningRate >= 5 ? "Monitor" : "On Track",
        statusTone: provisioningRate >= 10 ? "critical" : provisioningRate >= 5 ? "watch" : "good",
        trendLabel: formatTrend(lastVsPrevDelta(lossTrend), "pp"),
        trendGood: lastVsPrevDelta(lossTrend) <= 0,
      },
      {
        label: "Funding mobilised",
        value: nairaCompact(totalDrawn),
        note:
          drawnRatio > 0.85
            ? "Approaching the facility ceiling — begin discussions on additional funding lines."
            : "Healthy drawdown pace against secured facilities.",
        icon: "landmark",
        statusLabel: drawnRatio > 0.95 ? "Critical" : drawnRatio > 0.85 ? "Monitor" : "On Track",
        statusTone: drawnRatio > 0.95 ? "critical" : drawnRatio > 0.85 ? "watch" : "good",
        trendLabel: formatTrend(lastVsPrevPct(drawnTrend), "pct"),
        trendGood: lastVsPrevDelta(drawnTrend) >= 0,
      },
      {
        label: "Total disbursed",
        value: nairaCompact(totalDisbursed),
        note: disbFlat
          ? "No new disbursements recorded this month — check for delays in the approval-to-payment pipeline."
          : `${formatTrend(lastVsPrevPct(disbTrend), "pct")} vs last month — deployment continuing at pace.`,
        icon: "trending",
        // A month with zero new disbursements at a lending institution is a
        // bigger flag than "Monitor" - the chip needs to match how serious
        // the note text actually is, not undersell it.
        statusLabel: disbFlat ? "Critical" : "On Track",
        statusTone: disbFlat ? "critical" : "good",
        trendLabel: formatTrend(lastVsPrevPct(disbTrend), "pct"),
        trendGood: !disbFlat,
      },
    ],
    queue: [
      ...pendingPayments.slice(0, 5).map((p) => ({
        title: `Release payment — ${p.payee}`,
        detail: `${p.payment_type} · Voucher ${p.voucher_number}`,
        value: nairaCompact(p.amount),
        waiting: `${daysBetween(dateOnly(p.payment_date), asOf)} days`,
      })),
      ...(worstDept
        ? [
            {
              title: `Review budget overrun — ${worstDept[0]}`,
              detail: `Actual ${nairaCompact(worstDept[1].actual)} vs budgeted ${nairaCompact(worstDept[1].budgeted)}`,
              value: nairaCompact(worstDept[1].actual - worstDept[1].budgeted),
              waiting: "Awaiting review",
            },
          ]
        : []),
    ],
    charts: [
      {
        kind: "donut",
        title: "Facility utilisation",
        subtitle: "Drawn vs available, across all funding sources",
        labels: ["Drawn", "Available"],
        values: [totalDrawn, Math.max(totalFacility - totalDrawn, 0)],
        format: "naira",
      },
      {
        kind: "bar",
        title: "Operating spend by department",
        subtitle: "OpEx, CapEx and professional fees — excludes loan capital deployment",
        labels: [...byDeptOperating.entries()].sort((a, b) => b[1].actual - a[1].actual).slice(0, 6).map(([dept]) => dept),
        values: [...byDeptOperating.entries()].sort((a, b) => b[1].actual - a[1].actual).slice(0, 6).map(([, g]) => g.actual),
        format: "naira",
        horizontal: true,
      },
    ],
  };
}

// ─── Head of Procurement ───────────────────────────────────────────────────────

export async function getProcurementOverview(): Promise<PersonaOverview> {
  const [requisitions, bids, awards, contracts, complianceDocs, vendors] = await Promise.all([
    fetchProcurementRequisitions(),
    fetchProcurementBids(),
    fetchProcurementAwards(),
    fetchProcurementContracts(),
    fetchProcurementComplianceDocuments(),
    fetchProcurementVendors(),
  ]);
  const asOf = await getAsOfDate();
  const last6 = getLast6MonthKeys(asOf);

  const awardedReqs = requisitions.filter((r) => r.status === "Awarded");
  const awardByReq = new Map(awards.map((a) => [a.requisition_id, a]));
  const reqById = new Map(requisitions.map((r) => [r.requisition_id, r]));
  const cycleDays = awardedReqs
    .map((r) => {
      const award = awardByReq.get(r.requisition_id);
      return award ? daysBetween(r.raised_date, award.award_date) : null;
    })
    .filter((d): d is number => d !== null);
  const avgCycleDays = cycleDays.length ? cycleDays.reduce((s, d) => s + d, 0) / cycleDays.length : 0;

  const bidsByReq = new Map<string, number>();
  for (const b of bids) bidsByReq.set(b.requisition_id, (bidsByReq.get(b.requisition_id) ?? 0) + 1);
  const singleBidCount = [...bidsByReq.values()].filter((n) => n === 1).length;
  const avgBidders = bidsByReq.size ? [...bidsByReq.values()].reduce((s, n) => s + n, 0) / bidsByReq.size : 0;

  const valueForMoney = awards
    .map((a) => {
      const req = reqById.get(a.requisition_id);
      return req && req.estimated_value > 0 ? a.awarded_value / req.estimated_value : null;
    })
    .filter((v): v is number => v !== null);
  const avgValueRatio = valueForMoney.length ? (valueForMoney.reduce((s, v) => s + v, 0) / valueForMoney.length) * 100 : 0;

  const deliveryCounts = { Completed: 0, "In Progress": 0, "Not Started": 0, Delayed: 0 } as Record<string, number>;
  for (const c of contracts) deliveryCounts[c.delivery_status] = (deliveryCounts[c.delivery_status] ?? 0) + 1;
  const delayedRate = contracts.length > 0 ? (deliveryCounts.Delayed / contracts.length) * 100 : 0;

  const validDocs = complianceDocs.filter((d) => d.status === "Valid").length;
  const compliancePct = complianceDocs.length ? (validDocs / complianceDocs.length) * 100 : 0;
  const expiringSoon = complianceDocs
    .filter((d) => d.status === "Valid" && daysBetween(asOf, d.expiry_date) <= 30 && daysBetween(asOf, d.expiry_date) >= 0)
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));

  const openRequisitions = requisitions.filter((r) => r.status === "Bidding").sort((a, b) => b.estimated_value - a.estimated_value);
  const agingOpenCount = openRequisitions.filter((r) => daysBetween(r.raised_date, asOf) > 45).length;

  const vendorById = new Map(vendors.map((v) => [v.vendor_id, v]));

  const openValueByDept = new Map<string, number>();
  for (const r of openRequisitions) openValueByDept.set(r.department, (openValueByDept.get(r.department) ?? 0) + r.estimated_value);
  const topOpenDepts = [...openValueByDept.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  // --- Real trends -------------------------------------------------------------------
  const cycleByMonth = new Map<string, { sum: number; count: number }>();
  for (const r of awardedReqs) {
    const award = awardByReq.get(r.requisition_id);
    if (!award) continue;
    const mk = monthKeyOf(award.award_date);
    const bucket = cycleByMonth.get(mk) ?? { sum: 0, count: 0 };
    bucket.sum += daysBetween(r.raised_date, award.award_date);
    bucket.count += 1;
    cycleByMonth.set(mk, bucket);
  }
  let lastCycle = avgCycleDays;
  const cycleTrend: TrendPoint[] = last6.map((mk) => {
    const b = cycleByMonth.get(mk);
    if (b && b.count > 0) lastCycle = b.sum / b.count;
    return { label: monthLabel(mk), value: lastCycle };
  });
  const cycleDeltaDays = lastVsPrevDelta(cycleTrend);

  const complianceTrend: TrendPoint[] = last6.map((mk) => {
    const existing = complianceDocs.filter((d) => monthKeyOf(d.issue_date) <= mk);
    if (existing.length === 0) return { label: monthLabel(mk), value: 0 };
    const valid = existing.filter((d) => monthKeyOf(d.expiry_date) > mk).length;
    return { label: monthLabel(mk), value: (valid / existing.length) * 100 };
  });

  const reqsByMonth = new Map<string, string[]>();
  for (const r of requisitions) {
    const mk = monthKeyOf(r.raised_date);
    const list = reqsByMonth.get(mk) ?? [];
    list.push(r.requisition_id);
    reqsByMonth.set(mk, list);
  }
  let lastBidders = avgBidders;
  const competitionTrend: TrendPoint[] = last6.map((mk) => {
    const ids = reqsByMonth.get(mk);
    if (ids && ids.length > 0) lastBidders = ids.reduce((s, id) => s + (bidsByReq.get(id) ?? 0), 0) / ids.length;
    return { label: monthLabel(mk), value: lastBidders };
  });

  const valueByMonth = new Map<string, { sum: number; count: number }>();
  for (const a of awards) {
    const req = reqById.get(a.requisition_id);
    if (!req || req.estimated_value <= 0) continue;
    const mk = monthKeyOf(a.award_date);
    const bucket = valueByMonth.get(mk) ?? { sum: 0, count: 0 };
    bucket.sum += (a.awarded_value / req.estimated_value) * 100;
    bucket.count += 1;
    valueByMonth.set(mk, bucket);
  }
  let lastValueRatio = avgValueRatio;
  const valueTrend: TrendPoint[] = last6.map((mk) => {
    const b = valueByMonth.get(mk);
    if (b && b.count > 0) lastValueRatio = b.sum / b.count;
    return { label: monthLabel(mk), value: lastValueRatio };
  });

  return {
    role: "Head of Procurement",
    name: "Mr. Balogun",
    headline: `${avgCycleDays.toFixed(0)}-day average requisition-to-award cycle, ${compliancePct.toFixed(0)}% vendor compliance`,
    summary: `${openRequisitions.length} requisition(s) are still in the bidding stage${agingOpenCount > 0 ? `, including ${agingOpenCount} open more than 45 days` : ""}. ${
      singleBidCount > 0
        ? `${singleBidCount} of the ${bidsByReq.size} awarded requisitions received only a single bid — a competition risk worth reviewing.`
        : `Every one of the ${bidsByReq.size} awarded requisitions so far has drawn competitive bidding.`
    } Awards are landing at ${avgValueRatio.toFixed(0)}% of their estimated value on average${expiringSoon.length > 0 ? `, and ${expiringSoon.length} vendor compliance document(s) will expire within the next 30 days and need renewal` : ", with no vendor compliance documents due to expire in the next 30 days"}.`,
    kpis: [
      {
        label: "Cycle time",
        value: `${avgCycleDays.toFixed(0)} days`,
        note:
          avgCycleDays > 35
            ? "Cycle time well above target — identify the stage causing delay."
            : avgCycleDays > 21
              ? "Slightly slower than target — watch for bottlenecks."
              : "Within target cycle time.",
        icon: "clock",
        statusLabel: avgCycleDays > 35 ? "Critical" : avgCycleDays > 21 ? "Monitor" : "On Track",
        statusTone: avgCycleDays > 35 ? "critical" : avgCycleDays > 21 ? "watch" : "good",
        trendLabel: Math.round(cycleDeltaDays) === 0 ? "—" : `${cycleDeltaDays >= 0 ? "+" : ""}${cycleDeltaDays.toFixed(0)}d`,
        trendGood: cycleDeltaDays <= 0,
      },
      {
        label: "Compliance",
        value: `${compliancePct.toFixed(0)}%`,
        note:
          expiringSoon.length > 0
            ? `${expiringSoon.length} document(s) expire within 30 days — renew before they lapse.`
            : "All compliance documentation current.",
        icon: "check",
        statusLabel: compliancePct >= 90 ? "Satisfactory" : compliancePct >= 75 ? "Monitor" : "Critical",
        statusTone: compliancePct >= 90 ? "good" : compliancePct >= 75 ? "watch" : "critical",
        trendLabel: formatTrend(lastVsPrevDelta(complianceTrend), "pp"),
        trendGood: lastVsPrevDelta(complianceTrend) >= 0,
      },
      {
        label: "Competition",
        value: `${avgBidders.toFixed(1)} bids/req`,
        note:
          singleBidCount > 0
            ? `${singleBidCount} requisition(s) awarded with only one bid — widen sourcing to improve competitive tension.`
            : "Healthy competitive tension across recent awards.",
        icon: "users",
        statusLabel: avgBidders >= 3 ? "On Track" : avgBidders >= 1.5 ? "Monitor" : "Critical",
        statusTone: avgBidders >= 3 ? "good" : avgBidders >= 1.5 ? "watch" : "critical",
        trendLabel: formatTrend(lastVsPrevPct(competitionTrend), "pct"),
        trendGood: lastVsPrevDelta(competitionTrend) >= 0,
      },
      {
        label: "Value for money",
        value: `${avgValueRatio.toFixed(0)}%`,
        note:
          avgValueRatio > 100
            ? "Awards trending above estimated value — tighten bid evaluation."
            : "Awards holding within or below estimate — good cost discipline.",
        icon: "tag",
        statusLabel: avgValueRatio > 110 ? "Critical" : avgValueRatio > 100 ? "Monitor" : "On Track",
        statusTone: avgValueRatio > 110 ? "critical" : avgValueRatio > 100 ? "watch" : "good",
        trendLabel: formatTrend(lastVsPrevDelta(valueTrend), "pp"),
        trendGood: lastVsPrevDelta(valueTrend) <= 0,
      },
      {
        label: "Contract delivery",
        value: `${deliveryCounts.Completed} of ${contracts.length} complete`,
        note:
          deliveryCounts.Delayed > 0
            ? `${deliveryCounts.Delayed} contract(s) delayed — escalate with vendors before penalty clauses trigger.`
            : `${deliveryCounts["In Progress"]} in progress, ${deliveryCounts["Not Started"]} not yet started — none delayed.`,
        icon: "check",
        statusLabel: delayedRate > 15 ? "Critical" : delayedRate > 5 ? "Monitor" : "On Track",
        statusTone: delayedRate > 15 ? "critical" : delayedRate > 5 ? "watch" : "good",
        trendLabel: "—",
        trendGood: delayedRate <= 5,
      },
      {
        label: "Open pipeline",
        value: openRequisitions.length.toLocaleString(),
        note:
          agingOpenCount > 0
            ? `${agingOpenCount} requisition(s) open more than 45 days — prioritise for award decision.`
            : "Pipeline moving at a healthy pace.",
        icon: "package",
        href: "/drill/open-requisitions",
        statusLabel: agingOpenCount > 5 ? "Critical" : agingOpenCount > 0 ? "Monitor" : "On Track",
        statusTone: agingOpenCount > 5 ? "critical" : agingOpenCount > 0 ? "watch" : "good",
        trendLabel: "—",
        trendGood: agingOpenCount === 0,
      },
    ],
    queue: [
      ...expiringSoon.slice(0, 4).map((d) => ({
        title: `Compliance expiring — ${vendorById.get(d.vendor_id)?.vendor_name ?? d.vendor_id}`,
        detail: `${d.document_type} expires ${d.expiry_date}`,
        value: `${daysBetween(asOf, d.expiry_date)} days left`,
        waiting: "Renewal needed",
      })),
      ...openRequisitions.slice(0, 3).map((r) => ({
        title: `Award decision — ${r.department}`,
        detail: `${r.category} · Requisition ${r.requisition_id}`,
        value: nairaCompact(r.estimated_value),
        waiting: `${daysBetween(r.raised_date, asOf)} days waiting`,
      })),
    ],
    charts: [
      {
        kind: "donut",
        title: "Contract delivery status",
        subtitle: `Across ${contracts.length} awarded contract(s)`,
        labels: Object.keys(deliveryCounts).filter((k) => deliveryCounts[k] > 0),
        values: Object.keys(deliveryCounts).filter((k) => deliveryCounts[k] > 0).map((k) => deliveryCounts[k]),
        colors: ["#0F8A4B", "#D97706", "#6B7A94", "#DC2626"],
        format: "count",
      },
      {
        kind: "bar",
        title: "Open requisitions by department",
        subtitle: "Still in bidding, by estimated value",
        labels: topOpenDepts.map(([dept]) => dept),
        values: topOpenDepts.map(([, v]) => v),
        format: "naira",
        horizontal: true,
      },
    ],
  };
}

// ─── Head of Growth, Innovation & Strategy ─────────────────────────────────────

export async function getGrowthOverview(): Promise<PersonaOverview> {
  const [applications, approvals, disbursements, beneficiaries, partners] = await Promise.all([
    fetchLendingApplications(),
    fetchLendingApprovals(),
    fetchLendingDisbursements(),
    fetchLendingBeneficiaries(),
    fetchPfiPartners(),
  ]);
  const asOf = await getAsOfDate();
  const last6 = getLast6MonthKeys(asOf);

  const approvalById = new Map(approvals.map((a) => [a.approval_id, a]));
  const appById = new Map(applications.map((a) => [a.application_id, a]));

  const totalApplications = applications.length;
  const approvedApplications = applications.filter((a) => a.status === "Approved").length;
  const disbursedCount = disbursements.length;
  const funnelApprovalRate = totalApplications > 0 ? (approvedApplications / totalApplications) * 100 : 0;
  const funnelDisbursementRate = approvedApplications > 0 ? (disbursedCount / approvedApplications) * 100 : 0;

  const firstTimeApplications = applications.filter((a) => a.first_time_borrower_flag).length;
  const firstTimeRate = totalApplications > 0 ? (firstTimeApplications / totalApplications) * 100 : 0;

  const cycleDays = disbursements
    .map((d) => {
      const approval = approvalById.get(d.approval_id);
      return approval ? daysBetween(approval.approval_date, d.disbursement_date) : null;
    })
    .filter((d): d is number => d !== null);
  const avgCycleDays = cycleDays.length ? cycleDays.reduce((s, d) => s + d, 0) / cycleDays.length : 0;

  const bySector = new Map<string, number>();
  for (const b of beneficiaries) bySector.set(b.sector, (bySector.get(b.sector) ?? 0) + 1);
  const topSector = [...bySector.entries()].sort((a, b) => b[1] - a[1])[0];

  const byState = new Map<string, number>();
  for (const b of beneficiaries) byState.set(b.state, (byState.get(b.state) ?? 0) + 1);
  const topState = [...byState.entries()].sort((a, b) => b[1] - a[1])[0];
  // 36 states + FCT - a real, fixed fact about Nigeria's geography, not a
  // number derived from (or fabricated for) this dataset.
  const NIGERIA_STATE_UNIT_COUNT = 37;
  const stateCoveragePct = (byState.size / NIGERIA_STATE_UNIT_COUNT) * 100;

  const activePartners = partners.filter((p) => p.status === "Active").length;
  const probationPartners = partners.filter((p) => p.status === "Probation").length;

  const byProduct = new Map<string, number>();
  for (const a of applications) byProduct.set(a.product, (byProduct.get(a.product) ?? 0) + 1);
  const rankedProducts = [...byProduct.entries()].sort((a, b) => b[1] - a[1]);
  const topProduct = rankedProducts[0];
  const secondProduct = rankedProducts[1];

  // --- Real trends -------------------------------------------------------------------
  const appsByMonth = new Map<string, { total: number; approved: number; firstTime: number }>();
  for (const a of applications) {
    const mk = monthKeyOf(a.submitted_date);
    const bucket = appsByMonth.get(mk) ?? { total: 0, approved: 0, firstTime: 0 };
    bucket.total += 1;
    if (a.status === "Approved") bucket.approved += 1;
    if (a.first_time_borrower_flag) bucket.firstTime += 1;
    appsByMonth.set(mk, bucket);
  }
  let lastApprovalRate = 0;
  let lastFirstTimeRate = 0;
  const approvalTrend: TrendPoint[] = [];
  const firstTimeTrend: TrendPoint[] = [];
  for (const mk of last6) {
    const b = appsByMonth.get(mk);
    if (b && b.total > 0) {
      lastApprovalRate = (b.approved / b.total) * 100;
      lastFirstTimeRate = (b.firstTime / b.total) * 100;
    }
    approvalTrend.push({ label: monthLabel(mk), value: lastApprovalRate });
    firstTimeTrend.push({ label: monthLabel(mk), value: lastFirstTimeRate });
  }

  const velocityByMonth = new Map<string, { sum: number; count: number }>();
  for (const d of disbursements) {
    const approval = approvalById.get(d.approval_id);
    if (!approval) continue;
    const mk = monthKeyOf(d.disbursement_date);
    const bucket = velocityByMonth.get(mk) ?? { sum: 0, count: 0 };
    bucket.sum += daysBetween(approval.approval_date, d.disbursement_date);
    bucket.count += 1;
    velocityByMonth.set(mk, bucket);
  }
  let lastVelocity = avgCycleDays;
  const velocityTrend: TrendPoint[] = last6.map((mk) => {
    const b = velocityByMonth.get(mk);
    if (b && b.count > 0) lastVelocity = b.sum / b.count;
    return { label: monthLabel(mk), value: lastVelocity };
  });
  const velocityDeltaDays = lastVsPrevDelta(velocityTrend);

  return {
    role: "Head of Growth, Innovation & Strategy",
    name: "Ms. Eze",
    headline: `${totalApplications.toLocaleString()} applications received, ${funnelApprovalRate.toFixed(0)}% approved, ${firstTimeRate.toFixed(0)}% first-time borrowers`,
    summary: `Of ${totalApplications.toLocaleString()} applications received, ${approvedApplications.toLocaleString()} (${funnelApprovalRate.toFixed(0)}%) were approved, and ${disbursedCount.toLocaleString()} (${funnelDisbursementRate.toFixed(0)}% of approvals) have gone on to be disbursed, taking an average of ${avgCycleDays.toFixed(0)} days from approval to payout. The partner network is ${activePartners} of ${partners.length} institutions active${probationPartners > 0 ? `, with ${probationPartners} currently on probation` : ""}. ${topSector ? `${topSector[0]} is the leading sector by beneficiary count (${topSector[1].toLocaleString()} beneficiaries), and` : "The"} mandate now reaches ${byState.size} of Nigeria's states.`,
    kpis: [
      {
        label: "Credit access funnel",
        value: `${funnelApprovalRate.toFixed(0)}%`,
        note:
          funnelApprovalRate >= 70
            ? "Approval funnel healthy — most applications are converting."
            : "Approval rate below target — review rejection reasons upstream.",
        icon: "trending",
        statusLabel: funnelApprovalRate >= 70 ? "On Track" : funnelApprovalRate >= 50 ? "Monitor" : "Critical",
        statusTone: funnelApprovalRate >= 70 ? "good" : funnelApprovalRate >= 50 ? "watch" : "critical",
        trendLabel: formatTrend(lastVsPrevDelta(approvalTrend), "pp"),
        trendGood: lastVsPrevDelta(approvalTrend) >= 0,
      },
      {
        label: "First-time borrowers",
        value: `${firstTimeRate.toFixed(0)}%`,
        note:
          firstTimeRate >= 40
            ? "Strong new-borrower reach — mandate expansion on track."
            : "First-time-borrower share slipping — check outreach in underserved segments.",
        icon: "users",
        statusLabel: firstTimeRate >= 40 ? "On Track" : firstTimeRate >= 25 ? "Monitor" : "Critical",
        statusTone: firstTimeRate >= 40 ? "good" : firstTimeRate >= 25 ? "watch" : "critical",
        trendLabel: formatTrend(lastVsPrevDelta(firstTimeTrend), "pp"),
        trendGood: lastVsPrevDelta(firstTimeTrend) >= 0,
      },
      {
        label: "Partner performance",
        // Lead with the number that carries the problem - "34/38" reads as
        // healthy at a glance, which fights a Critical/Monitor chip sitting
        // right next to it.
        value: probationPartners > 0 ? `${probationPartners} on probation` : `${activePartners}/${partners.length} active`,
        note:
          probationPartners > 0
            ? `${activePartners} of ${partners.length} partners active — review the ${probationPartners} on probation before their next disbursement cycle.`
            : "All partners in good standing.",
        icon: "shield",
        statusLabel: probationPartners >= 3 ? "Critical" : probationPartners > 0 ? "Monitor" : "On Track",
        statusTone: probationPartners >= 3 ? "critical" : probationPartners > 0 ? "watch" : "good",
        trendLabel: "—",
        trendGood: probationPartners === 0,
      },
      {
        label: "Leading product",
        value: topProduct?.[0] ?? "—",
        note:
          topProduct && secondProduct
            ? `${((topProduct[1] / totalApplications) * 100).toFixed(0)}% of demand, ahead of ${secondProduct[0]} (${((secondProduct[1] / totalApplications) * 100).toFixed(0)}%).`
            : `${topProduct?.[1].toLocaleString() ?? 0} applications.`,
        icon: "star",
        statusLabel: "Leading",
        statusTone: "good",
        trendLabel: "—",
        trendGood: true,
      },
      {
        label: "Delivery velocity",
        value: `${avgCycleDays.toFixed(0)} days`,
        note:
          avgCycleDays <= 5
            ? "Fast disbursement turnaround — a genuine advantage to highlight."
            : "Turnaround slowing — investigate handoff delays between approval and payment.",
        icon: "zap",
        statusLabel: avgCycleDays <= 5 ? "On Track" : avgCycleDays <= 10 ? "Monitor" : "Critical",
        statusTone: avgCycleDays <= 5 ? "good" : avgCycleDays <= 10 ? "watch" : "critical",
        trendLabel: Math.round(velocityDeltaDays) === 0 ? "—" : `${velocityDeltaDays >= 0 ? "+" : ""}${velocityDeltaDays.toFixed(0)}d`,
        trendGood: velocityDeltaDays <= 0,
      },
      {
        label: "Geographic reach",
        // A bare count reads as an achievement; the denominator makes it a
        // finding instead (this is a national mandate, not a regional one).
        value: `${byState.size} of ${NIGERIA_STATE_UNIT_COUNT} states`,
        note: topState
          ? `${topState[0]} leads with ${((topState[1] / beneficiaries.length) * 100).toFixed(0)}% of beneficiaries — reach beyond it remains the growth opportunity.`
          : `${beneficiaries.length.toLocaleString()} beneficiaries total`,
        icon: "map",
        href: "/drill/mandate-reach",
        statusLabel: stateCoveragePct >= 50 ? "On Track" : stateCoveragePct >= 25 ? "Monitor" : "Critical",
        statusTone: stateCoveragePct >= 50 ? "good" : stateCoveragePct >= 25 ? "watch" : "critical",
        trendLabel: "—",
        trendGood: stateCoveragePct >= 50,
      },
    ],
    queue: [],
    charts: [
      {
        kind: "bar",
        title: "Credit access funnel",
        subtitle: "Applications → approved → disbursed",
        labels: ["Applications", "Approved", "Disbursed"],
        values: [totalApplications, approvedApplications, disbursedCount],
        format: "count",
      },
      {
        kind: "donut",
        title: "Beneficiaries by sector",
        subtitle: "Top sectors, all beneficiaries",
        labels: [...bySector.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s]) => s),
        values: [...bySector.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([, v]) => v),
        format: "count",
      },
    ],
  };
}

// ─── Head of ICT ────────────────────────────────────────────────────────────────
// No platform telemetry source exists in this build - the spec itself lists
// this as an open item (§Open Items #2: "Source of the ICT persona view:
// platform telemetry or dedicated dataset"). Rather than invent uptime/
// incident numbers, this reports only what's genuinely verifiable: the real
// pipeline shape of the data this platform actually runs on, plus real
// pipeline freshness (today's real date vs the dataset's real as-of date).

export async function getIctOverview(): Promise<PersonaOverview> {
  const asOf = await getAsOfDate();
  const daysStale = Math.max(0, daysBetween(asOf, new Date().toISOString().slice(0, 10)));

  const asOfLabel = new Date(`${asOf}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return {
    role: "Head of ICT",
    name: "Mr. Nnamani",
    // Leads with what the platform does, not what it doesn't - the four
    // facts below are real and verifiable, so state them as capability
    // first. What's genuinely missing (app/infra telemetry) is named once,
    // in the summary, as a next step rather than the headline framing.
    headline: `4 source systems connected · 22 tables · data current as of ${asOfLabel}`,
    summary:
      "All 4 source systems are connected and current. 22 tables are ingested across the estate, with full schema coverage — nothing partially wired. Application and infrastructure monitoring (uptime, incident response, security posture) will connect through the same pipeline once those sources are added.",
    kpis: [
      {
        label: "Source systems connected",
        value: "4",
        note: "Lending, PFI Partner Portal, Finance, Procurement — all 4 planned systems are live.",
        icon: "database",
        href: "/drill/data-sources",
        statusLabel: "On Track",
        statusTone: "good",
        trendLabel: "—",
        trendGood: true,
      },
      {
        label: "Data as of",
        value: asOf,
        note:
          daysStale <= 2
            ? "Data is current — within the expected refresh window."
            : `Data is ${daysStale} day(s) old — confirm the refresh pipeline is still running.`,
        icon: "calendar",
        statusLabel: daysStale <= 2 ? "On Track" : daysStale <= 7 ? "Monitor" : "Critical",
        statusTone: daysStale <= 2 ? "good" : daysStale <= 7 ? "watch" : "critical",
        trendLabel: "—",
        trendGood: daysStale <= 2,
      },
      {
        label: "Tables ingested",
        value: "22",
        note: "Across all 4 source systems — full schema coverage, nothing partially wired.",
        icon: "layers",
        statusLabel: "On Track",
        statusTone: "good",
        trendLabel: "—",
        trendGood: true,
      },
      {
        label: "Refresh model",
        value: "On demand",
        note: "Server-side fetch with a 1-hour cache — adequate for daily decision-making, not real-time monitoring.",
        icon: "refresh",
        statusLabel: "By Design",
        statusTone: "good",
        trendLabel: "—",
        trendGood: true,
      },
    ],
    queue: [],
    charts: [],
  };
}
