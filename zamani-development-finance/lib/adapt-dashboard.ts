import type { ExecutiveOverview } from "./kpis";
import type { DashboardProps, Domain, DomainKey, Risk, RiskPriority, TimelineEvent } from "@/components/dashboard";

const asOfLabelFor = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Only these three KPIs have a built drill-through path (lib/drill.ts + app/drill/*).
const KPI_DRILL_HREF: Record<string, string> = {
  "approved-not-paid": "/drill/lapsed-approvals",
  "portfolio-health": "/drill/par30",
  "mandate-reach": "/drill/mandate-reach",
};

/** Converts the real, computed ExecutiveOverview (lib/kpis.ts) into the exact
 * prop shapes the ported Figma dashboard component expects. Kept separate from
 * kpis.ts (which knows nothing about this UI) and from dashboard.tsx (which is
 * an as-close-as-possible port of the reference and shouldn't know where its
 * data comes from). */
export function adaptDashboardData(data: ExecutiveOverview): DashboardProps {
  const asOfLabel = asOfLabelFor(data.asOfDate);

  const domains: Domain[] = data.domains.map((d) => {
    const key = d.key as DomainKey;
    const trend: Domain["trend"] = d.trendLabel === "Stable" ? "stable" : d.trendGood ? "up" : "down";
    return {
      key,
      label: d.label,
      score: d.score,
      trend,
      trendValue: d.trendLabel,
      status: d.statusTone === "good" ? "healthy" : d.statusTone === "watch" ? "attention" : "critical",
      aiSummary: d.summary,
      kpis: d.kpis.map((k) => ({
        key: k.key,
        label: k.label,
        value: k.value,
        // Arrow direction reflects the actual sign of the number ("+1%" is
        // always up, never down); trendGood is a separate judgement (is that
        // direction favourable) and only controls colour - conflating the two
        // used to produce contradictions like a down arrow next to "+1%".
        delta: k.trendLabel === "—" ? undefined : k.trendLabel,
        deltaDir: k.trendLabel.startsWith("+") ? "up" : "down",
        deltaGood: k.trendGood,
        href: KPI_DRILL_HREF[k.key],
      })),
      tileHeadline: d.tileHeadline,
      tileSupporting: d.tileSupporting,
      tileStatusTone: d.tileStatusTone === "good" ? "healthy" : d.tileStatusTone === "watch" ? "attention" : "critical",
    };
  });

  const risks: Risk[] = data.rankedExceptions.map((r) => ({
    id: r.key,
    priority: r.impact.toLowerCase() as RiskPriority,
    status: "open",
    title: r.title,
    subtitle: r.subtitle,
    description: r.detail,
    time: r.dateLabel,
    impactLevel: r.impact,
    impactAreas: r.impactAreas,
    category: r.category,
    actionLabel: r.actionLabel,
    impactAmount: r.impactAmount,
    ageDays: r.ageDays,
    aiAnalysis: [r.detail + ".", r.evidence[0]?.note, r.recommendedActions[0] ? `Recommended: ${r.recommendedActions[0].label}.` : null]
      .filter(Boolean)
      .join(" "),
    evidence: r.evidence.map((e) => ({ time: e.label, note: e.note, source: e.source })),
    recommendedActions: r.recommendedActions,
  }));

  const timeline: TimelineEvent[] = data.timeline.map((t) => ({
    time: t.dateLabel,
    description: t.description,
    category: t.category,
    aiGenerated: false,
  }));

  return {
    greetingName: "Dr. Bello",
    briefSummary: data.briefBullets.map((b) => `${b.lead} ${b.detail}`).join(" "),
    briefPoints: data.briefBullets.map((b) => ({ tone: b.tone, lead: b.lead, detail: b.detail })),
    lapsedApprovalsCount: data.lapsedApprovalsCount,
    overduePartnersCount: data.overduePartnersCount,
    asOfLabel,
    domains,
    risks,
    timeline,
  };
}
