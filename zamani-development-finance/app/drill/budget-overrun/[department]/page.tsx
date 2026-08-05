import { DrillShell } from "@/components/drill-shell";
import { getBudgetLinesForDepartment } from "@/lib/drill";

export default async function BudgetLinesDrill({ params }: { params: Promise<{ department: string }> }) {
  const { department: raw } = await params;
  const department = decodeURIComponent(raw);
  const { records } = await getBudgetLinesForDepartment(department);

  return (
    <DrillShell
      crumbs={[
        { label: "Executive Overview", href: "/" },
        { label: "CFO View", href: "/persona/cfo" },
        { label: "Budget vs actual", href: "/drill/budget-overrun" },
        { label: department },
      ]}
      title={department}
      subtitle={`${records.length} budget line(s)`}
      sourceSystem="ERP / Finance"
    >
      <div className="enterprise-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", gap: 12, padding: "12px 24px", borderBottom: "1px solid rgba(10,14,26,0.06)", background: "#FAFBFD" }}>
          {["Category", "Budgeted", "Committed", "Actual", "Utilisation"].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#6B7A94", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "Inter" }}>
              {h}
            </span>
          ))}
        </div>
        {records.map((r) => (
          <div key={r.budgetId} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", gap: 12, padding: "13px 24px", alignItems: "center", borderBottom: "1px solid rgba(10,14,26,0.055)" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0A0E1A", fontFamily: "Inter" }}>{r.category}</div>
              <div style={{ fontSize: 11, color: "#6B7A94", fontFamily: "Inter" }}>{r.fiscalPeriod} · {r.budgetId}</div>
            </div>
            <span style={{ fontSize: 13, color: "#0A0E1A", fontFamily: "Inter" }}>{r.budgeted}</span>
            <span style={{ fontSize: 13, color: "#0A0E1A", fontFamily: "Inter" }}>{r.committed}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: r.overBudget ? "#DC2626" : "#0A0E1A", fontFamily: "Inter" }}>{r.actual}</span>
            <span style={{ fontSize: 12, color: r.overBudget ? "#DC2626" : "#059669", fontFamily: "Inter" }}>{r.utilisationPct.toFixed(0)}%</span>
          </div>
        ))}
        {records.length === 0 && <div style={{ padding: 24, fontSize: 13, color: "#6B7A94", fontFamily: "Inter" }}>No budget lines recorded for this department.</div>}
      </div>
    </DrillShell>
  );
}
