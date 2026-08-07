import { DrillShell } from "@/components/drill-shell";
import { getArrearsForPartner } from "@/lib/drill";

export default async function Par30ForPartnerDrill({ params }: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await params;
  const { partnerName, records } = await getArrearsForPartner(partnerId);

  return (
    <DrillShell
      crumbs={[
        { label: "Executive Overview", href: "/" },
        { label: "Portfolio health — PAR30", href: "/drill/par30" },
        { label: partnerName },
      ]}
      title={partnerName}
      subtitle={`${records.length} instalment${records.length === 1 ? "" : "s"} 30+ days overdue`}
      sourceSystem="ZDF (CMS)"
    >
      <div className="enterprise-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1fr 1fr 1fr 1fr", gap: 12, padding: "12px 24px", borderBottom: "1px solid rgba(10,14,26,0.06)", background: "#FAFBFD" }}>
          {["Repayment ID", "Disbursement", "Outstanding", "Due date", "Product / State", "Days overdue"].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#5A6880", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-sans)" }}>
              {h}
            </span>
          ))}
        </div>
        {records.map((r) => (
          <div
            key={r.repaymentId}
            style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1fr 1fr 1fr 1fr", gap: 12, padding: "13px 24px", alignItems: "center", borderBottom: "1px solid rgba(10,14,26,0.055)" }}
          >
            <span className="font-mono" style={{ fontSize: 12, color: "#0A0E1A" }}>{r.repaymentId}</span>
            <span className="font-mono" style={{ fontSize: 12, color: "#5A6880" }}>{r.disbursementId}</span>
            <span className="font-display" style={{ fontSize: 13, fontWeight: 700, color: "#B45309" }}>{r.amountOutstanding}</span>
            <span style={{ fontSize: 12, color: "#5A6880", fontFamily: "var(--font-sans)" }}>{r.dueDate}</span>
            <span style={{ fontSize: 12, color: "#5A6880", fontFamily: "var(--font-sans)" }}>{r.product} · {r.state}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: r.status === "Defaulted" ? "#DC2626" : "#D97706", fontFamily: "var(--font-sans)" }}>
              {r.daysOverdue} days{r.status === "Defaulted" ? " · Defaulted" : ""}
            </span>
          </div>
        ))}
        {records.length === 0 && <div style={{ padding: 24, fontSize: 13, color: "#5A6880", fontFamily: "var(--font-sans)" }}>No arrears records for this partner.</div>}
      </div>
    </DrillShell>
  );
}
