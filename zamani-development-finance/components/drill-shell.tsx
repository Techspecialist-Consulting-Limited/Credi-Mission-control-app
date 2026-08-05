import Link from "next/link";

export function DrillShell({
  crumbs,
  title,
  subtitle,
  sourceSystem,
  children,
}: {
  crumbs: { label: string; href?: string }[];
  title: string;
  subtitle?: string;
  sourceSystem: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#F4F6F9" }}>
      <header className="command-bar" style={{ position: "sticky", top: 0, zIndex: 50, padding: "0 28px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 28, height: 28, background: "#0F8A4B", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="0.5" y="0.5" width="6.5" height="6.5" fill="white" opacity="0.9" />
              <rect x="9" y="0.5" width="6.5" height="6.5" fill="white" opacity="0.65" />
              <rect x="0.5" y="9" width="6.5" height="6.5" fill="white" opacity="0.65" />
              <rect x="9" y="9" width="6.5" height="6.5" fill="white" opacity="0.4" />
            </svg>
          </div>
          <span className="font-display" style={{ fontSize: 13, fontWeight: 700, color: "#0A0E1A" }}>Zamani Development Finance</span>
        </Link>
      </header>

      {/* Hero band - gives every drill/records page (spec's "filtered detail"
          and "records" layers) the same intentional weight as the executive
          and persona layers above it, instead of a bare white title. */}
      <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#0A3820 0%,#0F8A4B 55%,#17A863 100%)", padding: "26px 32px 44px" }}>
        <div style={{ position: "absolute", top: -90, right: -50, width: 260, height: 260, borderRadius: "50%", background: "rgba(255,255,255,0.08)", filter: "blur(30px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -110, left: -50, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.06)", filter: "blur(34px)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }}>
          <nav style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {i > 0 && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>/</span>}
                {c.href ? (
                  <Link href={c.href} style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontFamily: "Inter", textDecoration: "none", fontWeight: 500 }}>
                    {c.label}
                  </Link>
                ) : (
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "Inter" }}>{c.label}</span>
                )}
              </span>
            ))}
          </nav>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
            <div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.8)", background: "rgba(255,255,255,0.14)", borderRadius: 20, padding: "4px 11px", marginBottom: 14 }}>
                ◆ Filtered Detail
              </span>
              <h1 className="font-display" style={{ fontSize: "clamp(26px,4vw,36px)", fontWeight: 800, color: "white", letterSpacing: "-0.02em", margin: 0, lineHeight: 1.1 }}>
                {title}
              </h1>
              {subtitle && <p style={{ fontSize: 14.5, color: "rgba(255,255,255,0.85)", marginTop: 9, fontFamily: "Inter", maxWidth: 640, lineHeight: 1.5 }}>{subtitle}</p>}
            </div>
            <button
              disabled
              title="No live source-system connection in this phase"
              style={{
                padding: "9px 16px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.22)",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                color: "rgba(255,255,255,0.7)",
                fontFamily: "Inter",
                cursor: "not-allowed",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Open in {sourceSystem} →
            </button>
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 32px 80px" }}>{children}</main>
    </div>
  );
}
