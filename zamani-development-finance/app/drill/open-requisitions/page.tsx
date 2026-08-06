import Link from "next/link";
import { DrillShell } from "@/components/drill-shell";
import { getOpenRequisitionsByDepartment } from "@/lib/drill";

export default async function OpenRequisitionsDrill() {
  const { totalCount, totalValue, groups } = await getOpenRequisitionsByDepartment();
  const max = groups[0]?.rawTotal ?? 1;

  return (
    <DrillShell
      crumbs={[{ label: "Executive Overview", href: "/" }, { label: "Head of Procurement", href: "/persona/procurement" }, { label: "Open pipeline" }]}
      title="Open pipeline — requisitions in bidding"
      subtitle={`${totalCount.toLocaleString()} requisition(s), ${totalValue} in estimated value — grouped by department`}
      sourceSystem="ZDF e-Procurement Portal"
    >
      <div className="enterprise-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 2fr auto auto", gap: 16, padding: "12px 24px", borderBottom: "1px solid rgba(10,14,26,0.06)", background: "#FAFBFD" }}>
          {["Department", "", "Estimated value", ""].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#6B7A94", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "Inter" }}>
              {h}
            </span>
          ))}
        </div>
        {groups.map((g) => (
          <Link
            key={g.department}
            href={`/drill/open-requisitions/${encodeURIComponent(g.department)}`}
            style={{ display: "grid", gridTemplateColumns: "1.3fr 2fr auto auto", gap: 16, padding: "12px 24px", alignItems: "center", borderBottom: "1px solid rgba(10,14,26,0.055)", textDecoration: "none", color: "inherit" }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0E1A", fontFamily: "Inter" }}>{g.department}</span>
            <div style={{ height: 8, background: "#EEF2F7", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(g.rawTotal / max) * 100}%`, background: "#0F8A4B", borderRadius: 4 }} />
            </div>
            <span className="font-display" style={{ fontSize: 14, fontWeight: 700, color: "#0A0E1A", textAlign: "right" }}>{g.totalValue}</span>
            <span style={{ color: "#0F8A4B", fontSize: 12, fontFamily: "Inter" }}>View requisitions →</span>
          </Link>
        ))}
      </div>
    </DrillShell>
  );
}
