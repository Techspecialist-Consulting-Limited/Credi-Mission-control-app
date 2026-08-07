import Link from "next/link";
import { DrillShell } from "@/components/drill-shell";
import { getBudgetOverrunByDepartment } from "@/lib/drill";

export default async function BudgetOverrunDrill() {
  const { totalBudgeted, totalActual, groups } = await getBudgetOverrunByDepartment();
  const maxAbs = Math.max(...groups.map((g) => Math.abs(g.rawVariance)), 1);

  return (
    <DrillShell
      crumbs={[{ label: "Executive Overview", href: "/" }, { label: "CFO View", href: "/persona/cfo" }, { label: "Budget vs actual" }]}
      title="Budget vs actual — by department"
      subtitle={`${totalActual} actual against ${totalBudgeted} budgeted, across ${groups.length} department(s)`}
      sourceSystem="Microsoft Dynamics (ERP)"
    >
      <div className="enterprise-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 2fr auto auto", gap: 16, padding: "12px 24px", borderBottom: "1px solid rgba(10,14,26,0.06)", background: "#FAFBFD" }}>
          {["Department", "", "Variance", ""].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#5A6880", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-sans)" }}>
              {h}
            </span>
          ))}
        </div>
        {groups.map((g) => {
          const over = g.rawVariance > 0;
          return (
            <Link
              key={g.department}
              href={`/drill/budget-overrun/${encodeURIComponent(g.department)}`}
              style={{ display: "grid", gridTemplateColumns: "1.3fr 2fr auto auto", gap: 16, padding: "12px 24px", alignItems: "center", borderBottom: "1px solid rgba(10,14,26,0.055)", textDecoration: "none", color: "inherit" }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0E1A", fontFamily: "var(--font-sans)" }}>{g.department}</span>
              <div style={{ height: 8, background: "#EEF2F7", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(Math.abs(g.rawVariance) / maxAbs) * 100}%`, background: over ? "#DC2626" : "#0D7A42", borderRadius: 4 }} />
              </div>
              <span className="font-display" style={{ fontSize: 14, fontWeight: 700, color: over ? "#DC2626" : "#059669", textAlign: "right" }}>
                {over ? "+" : "−"}{g.variance}
              </span>
              <span style={{ color: "#0D7A42", fontSize: 12, fontFamily: "var(--font-sans)" }}>View lines →</span>
            </Link>
          );
        })}
      </div>
    </DrillShell>
  );
}
