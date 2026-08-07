/** Loading skeletons.
 *
 * These are server components rendered by route-level `loading.tsx` files
 * while the page's data resolves. The point is not "show something spinning" -
 * it's that the shell (command bar, hero, card geometry) stays put and only
 * the content region resolves, so a navigation never reads as a blank moment.
 *
 * Every block here mirrors the real component's geometry (same heights, same
 * gaps, same max-width, same card radii) so the swap from skeleton to content
 * doesn't shift the layout.
 */

export function SkeletonBlock({
  width,
  height,
  radius = 6,
  style,
}: {
  width?: number | string;
  height: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return <span className="skeleton-block" style={{ display: "block", width: width ?? "100%", height, borderRadius: radius, ...style }} />;
}

/** Static stand-in for CommandBar, which is a client component and isn't
 * mounted during loading. Same 56px height, same sticky treatment, same
 * divider positions - so the header doesn't disappear and reappear. */
function CommandBarSkeleton() {
  return (
    <header className="command-bar" style={{ position: "sticky", top: 0, zIndex: 150, padding: "0 16px" }}>
      <div style={{ height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, background: "#0D7A42", borderRadius: 7, flexShrink: 0, opacity: 0.35 }} />
          <div className="hidden sm:block">
            <SkeletonBlock width={148} height={11} radius={4} />
            <SkeletonBlock width={104} height={8} radius={4} style={{ marginTop: 5 }} />
          </div>
        </div>
        <div className="hidden lg:flex" style={{ alignItems: "center", gap: 16, minWidth: 0 }}>
          <div style={{ width: 1, height: 22, background: "rgba(10,14,26,0.1)", flexShrink: 0 }} />
          <SkeletonBlock width={96} height={13} radius={4} />
          <div style={{ width: 1, height: 22, background: "rgba(10,14,26,0.1)", flexShrink: 0 }} />
          <div style={{ display: "flex", gap: 10 }}>
            {[112, 82, 132, 148].map((w, i) => (
              <SkeletonBlock key={i} width={w} height={13} radius={4} />
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 12 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <SkeletonBlock width={34} height={34} radius={8} />
          <SkeletonBlock width={86} height={26} radius={8} />
        </div>
      </div>
    </header>
  );
}

/** Hero + briefing card, shared by the Executive Overview and every persona
 * page (they render an identical hero and ai-glow block). */
function HeroSkeleton({ briefingLines = 2 }: { briefingLines?: number }) {
  return (
    <>
      <div style={{ marginBottom: 40 }}>
        <SkeletonBlock width={190} height={11} radius={4} />
        <SkeletonBlock width="min(460px, 80%)" height={46} radius={10} style={{ marginTop: 10 }} />
        <SkeletonBlock width={210} height={16} radius={4} style={{ marginTop: 12 }} />
      </div>
      <div className="ai-glow" style={{ borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <SkeletonBlock width={128} height={20} radius={6} />
        <SkeletonBlock width="min(520px, 72%)" height={15} radius={4} style={{ marginTop: 14 }} />
        {Array.from({ length: briefingLines }).map((_, i) => (
          <SkeletonBlock key={i} width={i === briefingLines - 1 ? "48%" : "94%"} height={12} radius={4} style={{ marginTop: 9 }} />
        ))}
      </div>
    </>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#F4F6F9" }}>
      <CommandBarSkeleton />
      <main
        className="px-4 sm:px-6 lg:px-8"
        style={{ maxWidth: 1480, margin: "0 auto", paddingTop: 32, paddingBottom: 80 }}
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Loading dashboard data…</span>
        {children}
      </main>
    </div>
  );
}

function CardSkeleton({ height }: { height: number }) {
  return (
    <div className="enterprise-card" style={{ padding: 20, height }}>
      <SkeletonBlock width={104} height={11} radius={4} />
      <SkeletonBlock width={132} height={28} radius={6} style={{ marginTop: 14 }} />
      <SkeletonBlock width={78} height={11} radius={4} style={{ marginTop: 14 }} />
      <SkeletonBlock width="88%" height={10} radius={4} style={{ marginTop: 12 }} />
    </div>
  );
}

/** Executive Overview: hero, then the two-up briefing/status row, then the
 * risk register list. */
export function ExecutiveOverviewSkeleton() {
  return (
    <PageShell>
      <HeroSkeleton briefingLines={2} />
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 20, marginBottom: 24 }}>
        <div className="enterprise-card" style={{ padding: 24, minHeight: 340 }}>
          <SkeletonBlock width={150} height={22} radius={6} />
          <SkeletonBlock width={260} height={26} radius={6} style={{ marginTop: 18 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 22 }}>
            <SkeletonBlock width={104} height={104} radius={52} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <SkeletonBlock width="70%" height={13} radius={4} />
              <SkeletonBlock width="52%" height={12} radius={4} style={{ marginTop: 10 }} />
              <SkeletonBlock width="60%" height={12} radius={4} style={{ marginTop: 10 }} />
            </div>
          </div>
          <SkeletonBlock width="86%" height={13} radius={4} style={{ marginTop: 26 }} />
          <SkeletonBlock width="66%" height={12} radius={4} style={{ marginTop: 10 }} />
        </div>
        <div className="enterprise-card" style={{ padding: 0, minHeight: 340, overflow: "hidden" }}>
          <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid rgba(10,14,26,0.06)" }}>
            <SkeletonBlock width={132} height={10} radius={4} />
            <SkeletonBlock width={166} height={19} radius={5} style={{ marginTop: 8 }} />
          </div>
          <div style={{ padding: "18px 24px", display: "flex", alignItems: "center", gap: 18, borderBottom: "1px solid rgba(10,14,26,0.06)" }}>
            <SkeletonBlock width={88} height={88} radius={44} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <SkeletonBlock width="56%" height={13} radius={4} />
              <SkeletonBlock width="86%" height={12} radius={4} style={{ marginTop: 9 }} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 0 }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  padding: "16px 18px",
                  borderBottom: i < 2 ? "1px solid rgba(10,14,26,0.06)" : "none",
                  borderRight: i % 2 === 0 ? "1px solid rgba(10,14,26,0.06)" : "none",
                }}
              >
                <SkeletonBlock width={118} height={11} radius={4} />
                <SkeletonBlock width="82%" height={17} radius={5} style={{ marginTop: 12 }} />
                <SkeletonBlock width="64%" height={11} radius={4} style={{ marginTop: 9 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="enterprise-card" style={{ padding: 24 }}>
        <SkeletonBlock width={148} height={20} radius={5} />
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <SkeletonBlock width={36} height={36} radius={9} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <SkeletonBlock width="46%" height={14} radius={4} />
                <SkeletonBlock width="76%" height={11} radius={4} style={{ marginTop: 9 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

/** Persona pages: same hero, then a 3-up KPI grid, then two chart panels. */
export function PersonaPageSkeleton() {
  return (
    <PageShell>
      <HeroSkeleton briefingLines={3} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 12, marginBottom: 24 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <CardSkeleton key={i} height={158} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 16, marginBottom: 24 }}>
        {[0, 1].map((i) => (
          <div key={i} className="enterprise-card" style={{ padding: 24, minHeight: 360 }}>
            <SkeletonBlock width={172} height={17} radius={5} />
            <SkeletonBlock width={232} height={11} radius={4} style={{ marginTop: 9 }} />
            <SkeletonBlock height={244} radius={10} style={{ marginTop: 24 }} />
          </div>
        ))}
      </div>
      <div className="enterprise-card" style={{ padding: 24 }}>
        <SkeletonBlock width={128} height={10} radius={4} />
        <SkeletonBlock width={196} height={19} radius={5} style={{ marginTop: 8 }} />
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <SkeletonBlock width="42%" height={13} radius={4} />
                <SkeletonBlock width="62%" height={11} radius={4} style={{ marginTop: 8 }} />
              </div>
              <SkeletonBlock width={78} height={13} radius={4} style={{ flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

/** Drill-through pages: breadcrumb, title, then a data table. */
export function DrillPageSkeleton() {
  return (
    <PageShell>
      <SkeletonBlock width={300} height={11} radius={4} />
      <SkeletonBlock width="min(520px, 74%)" height={34} radius={8} style={{ marginTop: 16 }} />
      <SkeletonBlock width={264} height={13} radius={4} style={{ marginTop: 12 }} />
      <div className="enterprise-card" style={{ padding: 0, marginTop: 28, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(10,14,26,0.06)", display: "flex", gap: 24 }}>
          {[132, 96, 96, 76].map((w, i) => (
            <SkeletonBlock key={i} width={w} height={11} radius={4} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: "14px 20px",
              borderBottom: i < 7 ? "1px solid rgba(10,14,26,0.05)" : "none",
              display: "flex",
              gap: 24,
              alignItems: "center",
            }}
          >
            <SkeletonBlock width={176} height={13} radius={4} />
            <SkeletonBlock width={92} height={13} radius={4} />
            <SkeletonBlock width={88} height={13} radius={4} />
            <SkeletonBlock width={68} height={13} radius={4} />
          </div>
        ))}
      </div>
    </PageShell>
  );
}
