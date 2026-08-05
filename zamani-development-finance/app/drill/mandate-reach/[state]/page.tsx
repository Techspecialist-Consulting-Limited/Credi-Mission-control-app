import { DrillShell } from "@/components/drill-shell";
import { AnimatedGrid, AnimatedGridItem, AnimatedNumber } from "@/components/animated-kpi";
import { getMandateReachSegments } from "@/lib/drill";

export default async function MandateReachSegmentsDrill({ params }: { params: Promise<{ state: string }> }) {
  const { state: rawState } = await params;
  const state = decodeURIComponent(rawState);
  const { totalCount, segments } = await getMandateReachSegments(state);
  const leading = segments[0];
  const totalFirstTime = segments.reduce((s, seg) => s + seg.firstTimeBorrowerCount, 0);
  const firstTimeSharePct = totalCount > 0 ? Math.round((totalFirstTime / totalCount) * 100) : 0;

  return (
    <DrillShell
      crumbs={[
        { label: "Executive Overview", href: "/" },
        { label: "Mandate reach", href: "/drill/mandate-reach" },
        { label: state },
      ]}
      title={state}
      subtitle={`${totalCount.toLocaleString()} beneficiaries reached — broken down by sector`}
      sourceSystem="Lending Management System"
    >
      <AnimatedGrid className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 12, marginBottom: 20 }}>
        <AnimatedGridItem>
          <div className="enterprise-card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7A94", fontFamily: "Inter", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total reached</div>
            <div className="font-display" style={{ fontSize: 24, fontWeight: 800, color: "#0A0E1A", marginTop: 6 }}>
              <AnimatedNumber value={totalCount.toLocaleString()} />
            </div>
          </div>
        </AnimatedGridItem>
        <AnimatedGridItem>
          <div className="enterprise-card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7A94", fontFamily: "Inter", textTransform: "uppercase", letterSpacing: "0.05em" }}>Leading sector</div>
            <div className="font-display" style={{ fontSize: 24, fontWeight: 800, color: "#0A0E1A", marginTop: 6 }}>{leading?.sector ?? "—"}</div>
          </div>
        </AnimatedGridItem>
        <AnimatedGridItem>
          <div className="enterprise-card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7A94", fontFamily: "Inter", textTransform: "uppercase", letterSpacing: "0.05em" }}>First-time borrowers</div>
            <div className="font-display" style={{ fontSize: 24, fontWeight: 800, color: "#0A0E1A", marginTop: 6 }}>
              <AnimatedNumber value={`${firstTimeSharePct}%`} />
            </div>
          </div>
        </AnimatedGridItem>
      </AnimatedGrid>

      <div className="enterprise-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "32px 1.5fr 1fr 1fr", gap: 12, padding: "12px 24px", borderBottom: "1px solid rgba(10,14,26,0.06)", background: "#FAFBFD" }}>
          {["", "Sector", "Beneficiaries", "First-time borrowers"].map((h, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 700, color: "#6B7A94", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "Inter" }}>
              {h}
            </span>
          ))}
        </div>
        <AnimatedGrid>
          {segments.map((s, i) => (
            <AnimatedGridItem key={s.sector}>
              <div style={{ display: "grid", gridTemplateColumns: "32px 1.5fr 1fr 1fr", gap: 12, padding: "14px 24px", alignItems: "center", borderBottom: i === segments.length - 1 ? "none" : "1px solid rgba(10,14,26,0.055)" }}>
                <span className="font-mono" style={{ fontSize: 11, color: "#9AA5B1" }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0E1A", fontFamily: "Inter" }}>{s.sector}</span>
                <span className="font-display" style={{ fontSize: 14, fontWeight: 700, color: "#0A0E1A" }}>{s.count.toLocaleString()}</span>
                <span style={{ fontSize: 12, color: "#059669", fontFamily: "Inter", fontWeight: 500 }}>
                  {s.firstTimeBorrowerCount.toLocaleString()} ({s.count > 0 ? Math.round((s.firstTimeBorrowerCount / s.count) * 100) : 0}%)
                </span>
              </div>
            </AnimatedGridItem>
          ))}
        </AnimatedGrid>
        {segments.length === 0 && <div style={{ padding: 24, fontSize: 13, color: "#6B7A94", fontFamily: "Inter" }}>No beneficiaries recorded for this state.</div>}
      </div>
    </DrillShell>
  );
}
