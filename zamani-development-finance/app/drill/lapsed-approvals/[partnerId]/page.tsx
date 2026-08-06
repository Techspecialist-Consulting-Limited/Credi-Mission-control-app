import { DrillShell } from "@/components/drill-shell";
import { getLapsedApprovalsForPartner } from "@/lib/drill";

export default async function LapsedApprovalsForPartnerDrill({ params }: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await params;
  const { partnerName, records } = await getLapsedApprovalsForPartner(partnerId);

  return (
    <DrillShell
      crumbs={[
        { label: "Executive Overview", href: "/" },
        { label: "Approved but not yet paid", href: "/drill/lapsed-approvals" },
        { label: partnerName },
      ]}
      title={partnerName}
      subtitle={`${records.length} lapsed approval${records.length === 1 ? "" : "s"} — approved, never disbursed`}
      sourceSystem="ZDF (CMS)"
    >
      <div className="enterprise-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr 1fr", gap: 12, padding: "12px 24px", borderBottom: "1px solid rgba(10,14,26,0.06)", background: "#FAFBFD" }}>
          {["Approval ID", "Amount", "Approved", "Approved by", "Product / State", "Days lapsed"].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#6B7A94", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "Inter" }}>
              {h}
            </span>
          ))}
        </div>
        {records.map((r) => (
          <div
            key={r.approvalId}
            style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr 1fr", gap: 12, padding: "13px 24px", alignItems: "center", borderBottom: "1px solid rgba(10,14,26,0.055)" }}
          >
            <span className="font-mono" style={{ fontSize: 12, color: "#0A0E1A" }}>{r.approvalId}</span>
            <span className="font-display" style={{ fontSize: 13, fontWeight: 700, color: "#B91C1C" }}>{r.amount}</span>
            <span style={{ fontSize: 12, color: "#6B7A94", fontFamily: "Inter" }}>{r.approvalDate}</span>
            <span style={{ fontSize: 12, color: "#6B7A94", fontFamily: "Inter" }}>{r.approvedBy}</span>
            <span style={{ fontSize: 12, color: "#6B7A94", fontFamily: "Inter" }}>{r.product} · {r.state}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#DC2626", fontFamily: "Inter" }}>{r.daysLapsed} days</span>
          </div>
        ))}
        {records.length === 0 && <div style={{ padding: 24, fontSize: 13, color: "#6B7A94", fontFamily: "Inter" }}>No lapsed approvals for this partner.</div>}
      </div>
    </DrillShell>
  );
}
