import { DrillShell } from "@/components/drill-shell";
import { getOpenRequisitionsForDepartment } from "@/lib/drill";

export default async function OpenRequisitionsForDeptDrill({ params }: { params: Promise<{ department: string }> }) {
  const { department: raw } = await params;
  const department = decodeURIComponent(raw);
  const { records } = await getOpenRequisitionsForDepartment(department);

  return (
    <DrillShell
      crumbs={[
        { label: "Executive Overview", href: "/" },
        { label: "Head of Procurement", href: "/persona/procurement" },
        { label: "Open pipeline", href: "/drill/open-requisitions" },
        { label: department },
      ]}
      title={department}
      subtitle={`${records.length} requisition(s) still in bidding`}
      sourceSystem="ZDF e-Procurement Portal"
    >
      <div className="enterprise-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", gap: 12, padding: "12px 24px", borderBottom: "1px solid rgba(10,14,26,0.06)", background: "#FAFBFD" }}>
          {["Category", "Estimated value", "Raised", "Days open", "Bids"].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#6B7A94", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "Inter" }}>
              {h}
            </span>
          ))}
        </div>
        {records.map((r) => (
          <div key={r.requisitionId} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", gap: 12, padding: "13px 24px", alignItems: "center", borderBottom: "1px solid rgba(10,14,26,0.055)" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0A0E1A", fontFamily: "Inter" }}>{r.category}</div>
              <div style={{ fontSize: 11, color: "#6B7A94", fontFamily: "Inter" }}>{r.requisitionId}</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0E1A", fontFamily: "Inter" }}>{r.estimatedValue}</span>
            <span style={{ fontSize: 13, color: "#0A0E1A", fontFamily: "Inter" }}>{r.raisedDate}</span>
            <span style={{ fontSize: 13, color: r.daysOpen > 60 ? "#DC2626" : "#0A0E1A", fontFamily: "Inter" }}>{r.daysOpen}d</span>
            <span style={{ fontSize: 13, color: r.bidCount <= 1 ? "#D97706" : "#059669", fontFamily: "Inter" }}>{r.bidCount}</span>
          </div>
        ))}
        {records.length === 0 && <div style={{ padding: 24, fontSize: 13, color: "#6B7A94", fontFamily: "Inter" }}>No open requisitions for this department.</div>}
      </div>
    </DrillShell>
  );
}
