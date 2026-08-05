import Link from "next/link";
import { DrillShell } from "@/components/drill-shell";
import { AnimatedGrid, AnimatedGridItem, AnimatedNumber } from "@/components/animated-kpi";
import { getMandateReachByState } from "@/lib/drill";

export default async function MandateReachDrill() {
  const { totalCount, groups } = await getMandateReachByState();
  const max = groups[0]?.count ?? 1;
  const leading = groups[0];
  const leadingSharePct = leading ? Math.round((leading.count / totalCount) * 100) : 0;

  return (
    <DrillShell
      crumbs={[{ label: "Executive Overview", href: "/" }, { label: "Mandate reach" }]}
      title="Mandate reach — beneficiaries served"
      subtitle={`${totalCount.toLocaleString()} beneficiaries reached to date — grouped by state`}
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
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7A94", fontFamily: "Inter", textTransform: "uppercase", letterSpacing: "0.05em" }}>States reached</div>
            <div className="font-display" style={{ fontSize: 24, fontWeight: 800, color: "#0A0E1A", marginTop: 6 }}>
              <AnimatedNumber value={groups.length.toString()} />
            </div>
          </div>
        </AnimatedGridItem>
        <AnimatedGridItem>
          <div className="enterprise-card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7A94", fontFamily: "Inter", textTransform: "uppercase", letterSpacing: "0.05em" }}>Leading state</div>
            <div className="font-display" style={{ fontSize: 24, fontWeight: 800, color: "#0A0E1A", marginTop: 6 }}>{leading?.state ?? "—"}</div>
            <div style={{ fontSize: 11.5, color: "#6B7A94", fontFamily: "Inter", marginTop: 2 }}>{leadingSharePct}% of all beneficiaries</div>
          </div>
        </AnimatedGridItem>
      </AnimatedGrid>

      <div className="enterprise-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "32px 1.3fr 3fr auto auto", gap: 16, padding: "12px 24px", borderBottom: "1px solid rgba(10,14,26,0.06)", background: "#FAFBFD" }}>
          {["", "State", "", "Beneficiaries", ""].map((h, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 700, color: "#6B7A94", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "Inter" }}>
              {h}
            </span>
          ))}
        </div>
        <AnimatedGrid>
          {groups.map((g, i) => (
            <AnimatedGridItem key={g.state}>
              <Link
                href={`/drill/mandate-reach/${encodeURIComponent(g.state)}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 1.3fr 3fr auto auto",
                  gap: 16,
                  padding: "13px 24px",
                  alignItems: "center",
                  borderBottom: i === groups.length - 1 ? "none" : "1px solid rgba(10,14,26,0.055)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span className="font-mono" style={{ fontSize: 11, color: "#9AA5B1" }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0E1A", fontFamily: "Inter" }}>{g.state}</span>
                <div style={{ height: 8, background: "#EEF2F7", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(g.count / max) * 100}%`, background: "linear-gradient(90deg,#0F8A4B,#34D399)", borderRadius: 4 }} />
                </div>
                <span className="font-display" style={{ fontSize: 14, fontWeight: 700, color: "#0A0E1A", textAlign: "right" }}>{g.count.toLocaleString()}</span>
                <span style={{ color: "#0F8A4B", fontSize: 12, fontFamily: "Inter", fontWeight: 500 }}>View segments →</span>
              </Link>
            </AnimatedGridItem>
          ))}
        </AnimatedGrid>
      </div>
    </DrillShell>
  );
}
