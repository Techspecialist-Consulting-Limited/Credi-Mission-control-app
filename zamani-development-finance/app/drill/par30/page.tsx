import Link from "next/link";
import { DrillShell } from "@/components/drill-shell";
import { getArrearsByPartner } from "@/lib/drill";

export default async function Par30Drill() {
  const { totalCount, totalOutstanding, groups } = await getArrearsByPartner();

  return (
    <DrillShell
      crumbs={[{ label: "Executive Overview", href: "/" }, { label: "Portfolio health — PAR30" }]}
      title="Portfolio health — PAR30"
      subtitle={`${totalCount.toLocaleString()} instalments 30+ days overdue, ${totalOutstanding} outstanding — grouped by partner institution`}
      sourceSystem="ZDF (CMS)"
    >
      <div className="enterprise-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 12, padding: "12px 24px", borderBottom: "1px solid rgba(10,14,26,0.06)", background: "#FAFBFD" }}>
          {["Partner institution", "Type", "Overdue instalments", "Outstanding", ""].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#6B7A94", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "Inter" }}>
              {h}
            </span>
          ))}
        </div>
        {groups.map((g) => (
          <Link
            key={g.partnerId}
            href={`/drill/par30/${g.partnerId}`}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
              gap: 12,
              padding: "14px 24px",
              alignItems: "center",
              borderBottom: "1px solid rgba(10,14,26,0.055)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0E1A", fontFamily: "Inter" }}>{g.partnerName}</span>
            <span style={{ fontSize: 12, color: "#6B7A94", fontFamily: "Inter" }}>{g.institutionType}</span>
            <span style={{ fontSize: 13, color: "#0A0E1A", fontFamily: "Inter" }}>{g.count}</span>
            <span className="font-display" style={{ fontSize: 14, fontWeight: 700, color: "#B45309" }}>{g.totalAmount}</span>
            <span style={{ color: "#0F8A4B", fontSize: 12, fontFamily: "Inter" }}>View records →</span>
          </Link>
        ))}
      </div>
    </DrillShell>
  );
}
