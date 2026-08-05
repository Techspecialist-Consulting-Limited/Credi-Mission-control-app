"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  Landmark,
  Layers,
  MapPin,
  Package,
  Percent,
  PieChart,
  RefreshCw,
  ShieldAlert,
  Star,
  Tag,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { CommandBar } from "./command-bar";
import { AiWidget } from "./ai-widget";
import { AiBadge } from "./dashboard";
import type { DashboardProps, DomainKey } from "./dashboard";
import type { PersonaKpiIcon, PersonaOverview } from "@/lib/personas";
import type { Tone } from "@/lib/kpis";
import { AnimatedGrid, AnimatedGridItem, AnimatedNumber } from "./animated-kpi";
import { DonutChart } from "./charts/donut-chart";
import { BarChart } from "./charts/bar-chart";

const STATUS_COLORS: Record<Tone, string> = { good: "#059669", watch: "#D97706", critical: "#DC2626" };

const ICON_MAP: Record<PersonaKpiIcon, typeof Wallet> = {
  wallet: Wallet,
  chart: PieChart,
  percent: Percent,
  shield: ShieldAlert,
  landmark: Landmark,
  trending: TrendingUp,
  clock: Clock,
  check: CheckCircle2,
  users: Users,
  tag: Tag,
  package: Package,
  star: Star,
  zap: Zap,
  map: MapPin,
  database: Database,
  calendar: Calendar,
  layers: Layers,
  refresh: RefreshCw,
};

const naira = (n: number) => `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
const nairaCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}bn`;
  if (Math.abs(n) >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}m`;
  return naira(n);
};
const FORMATTERS: Record<string, (v: number) => string> = {
  naira: nairaCompact,
  percent: (v) => `${v.toFixed(0)}%`,
  count: (v) => v.toLocaleString(),
};

export function PersonaPage({
  dashboardProps,
  persona,
  activeHref,
}: {
  dashboardProps: DashboardProps;
  persona: PersonaOverview;
  activeHref: string;
}) {
  const { domains, risks, asOfLabel } = dashboardProps;
  const [currentTime, setCurrentTime] = useState(new Date());
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const timeStr = currentTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr = currentTime.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const hour = currentTime.getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  // Live count of items genuinely awaiting this persona's decision - same
  // "Good {time}, {name}. N things need you today." pattern as the MD's
  // Executive Overview hero, not a static headline.
  const queueCount = persona.queue.length;
  const heroSubLine =
    queueCount === 0
      ? "Nothing is waiting on you."
      : `${queueCount === 1 ? "One thing needs" : `${queueCount} things need`} you today.`;

  // These pages don't own in-place domain/risk panels the way the Executive
  // Overview does - the command bar's real destinations for those are full
  // navigations back to "/" (with the domain pre-selected via the same
  // ?domain= param Dashboard already reads on mount), not a local modal.
  const goToDomain = (key: DomainKey) => {
    window.location.href = `/?domain=${key}`;
  };
  const goHome = () => {
    window.location.href = "/";
  };
  const goToRisks = () => {
    window.location.href = "/";
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6F9" }}>
      <CommandBar
        domains={domains}
        risks={risks}
        asOfLabel={asOfLabel}
        timeStr={timeStr}
        onOpenDomain={goToDomain}
        onGoHome={goHome}
        onOpenRisk={goToRisks}
        onOpenAI={() => setAiOpen(true)}
        activeHref={activeHref}
      />

      <main className="px-4 sm:px-6 lg:px-8" style={{ maxWidth: 1480, margin: "0 auto", paddingTop: 32, paddingBottom: 80 }}>
        {/* ── Hero, matches the Executive Overview's hero exactly ─────────── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7A94", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "Inter", margin: "0 0 8px" }}>
                {dateStr} · {persona.role}
              </p>
              <h1 className="font-display" style={{ fontSize: "clamp(28px,5vw,48px)", fontWeight: 800, color: "#0A0E1A", letterSpacing: "-0.025em", lineHeight: 1.05, margin: 0 }}>
                Good {timeOfDay}, {persona.name}.
              </h1>
              <p style={{ fontSize: 16, color: "#6B7A94", marginTop: 10, fontFamily: "Inter", fontWeight: 400, letterSpacing: "-0.01em", maxWidth: 640 }}>{heroSubLine}</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="ms-blue-btn" onClick={() => setAiOpen(true)} style={{ padding: "8px 16px" }}>✦ &nbsp;Ask Ada</button>
            </div>
          </div>
        </div>

        {/* ── AI-brief-style summary card, matches the ai-glow card exactly ── */}
        <div className="ai-glow" style={{ borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <AiBadge label="Ada's Briefing" />
            <span style={{ fontSize: 11, color: "#6B7A94", fontFamily: "Inter" }}>As of {asOfLabel}</span>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.6, fontWeight: 600, color: "#0A0E1A", margin: "0 0 6px", fontFamily: "Inter" }}>{persona.headline}</p>
          <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "#6B7A94", margin: 0, fontFamily: "Inter" }}>{persona.summary}</p>
        </div>

        {/* ── KPI grid, matches KpiRow's icon+hover-lift+count-up style ───── */}
        <AnimatedGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 12, marginBottom: 24 }}>
          {persona.kpis.map((k) => {
            const Icon = ICON_MAP[k.icon];
            const cardStyle: React.CSSProperties = { padding: 20, height: "100%", display: "block", textDecoration: "none", color: "inherit" };
            const statusColor = STATUS_COLORS[k.statusTone];
            const trendMagnitude = k.trendLabel === "—" ? null : parseFloat(k.trendLabel);
            const trendArrow = trendMagnitude === null ? null : trendMagnitude > 0 ? "↑" : trendMagnitude < 0 ? "↓" : "→";
            const trendColor = trendMagnitude === 0 ? "#6B7A94" : k.trendGood ? "#059669" : "#DC2626";
            const content = (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: "#6B7A94", fontFamily: "Inter", lineHeight: 1.3 }}>{k.label}</p>
                  <span style={{ display: "flex", width: 32, height: 32, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#E7F6ED", color: "#0F8A4B" }}>
                    <Icon size={16} strokeWidth={2} />
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <p className="font-display" style={{ fontSize: 26, fontWeight: 700, color: "#0A0E1A", letterSpacing: "-0.01em", margin: 0 }}>
                    <AnimatedNumber value={k.value} />
                  </p>
                  {trendArrow && (
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: trendColor, fontFamily: "Inter" }}>
                      {trendArrow} {k.trendLabel}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                  <span className={k.statusTone === "critical" ? "live-pulse-dot" : undefined} style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, color: statusColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, fontFamily: "Inter" }}>{k.statusLabel}</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
                  <p style={{ fontSize: 12, color: "#6B7A94", fontFamily: "Inter", lineHeight: 1.5, margin: 0 }}>{k.note}</p>
                  {k.href && <span style={{ fontSize: 11, color: "#0F8A4B", fontFamily: "Inter", fontWeight: 500, flexShrink: 0 }}>Drill in →</span>}
                </div>
              </>
            );
            return (
              <AnimatedGridItem key={k.label}>
                {k.href ? (
                  <Link href={k.href} className="enterprise-card" style={cardStyle}>{content}</Link>
                ) : (
                  <div className="enterprise-card" style={cardStyle}>{content}</div>
                )}
              </AnimatedGridItem>
            );
          })}
        </AnimatedGrid>

        {/* ── Real charts ──────────────────────────────────────────────────── */}
        {persona.charts.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 16, marginBottom: 24 }}>
            {persona.charts.map((chart) => (
              <div key={chart.title} className="enterprise-card" style={{ padding: 20 }}>
                <div style={{ marginBottom: 12 }}>
                  <h3 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: "#0A0E1A", margin: 0 }}>{chart.title}</h3>
                  <p style={{ fontSize: 12, color: "#6B7A94", marginTop: 2, fontFamily: "Inter" }}>{chart.subtitle}</p>
                </div>
                {chart.kind === "donut" ? (
                  <DonutChart labels={chart.labels} values={chart.values} colors={chart.colors} valueFormatter={FORMATTERS[chart.format ?? "count"]} height={260} />
                ) : (
                  <BarChart categories={chart.labels} values={chart.values} valueFormatter={FORMATTERS[chart.format ?? "count"]} horizontal={chart.horizontal} height={260} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Decision queue, styled like the Risk Center's row list ──────── */}
        {persona.queue.length > 0 && (
          <div className="enterprise-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(10,14,26,0.06)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7A94", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "Inter", marginBottom: 3 }}>Live Business Issues</div>
              <h3 className="font-display" style={{ fontSize: 17, fontWeight: 700, color: "#0A0E1A", margin: 0, letterSpacing: "-0.01em" }}>
                Awaiting your decision ({persona.queue.length})
              </h3>
            </div>
            {persona.queue.map((item, i) => {
              const row = (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "16px 24px",
                    borderBottom: i === persona.queue.length - 1 ? "none" : "1px solid rgba(10,14,26,0.055)",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ width: 3, height: 32, borderRadius: 2, background: "#0F8A4B", flexShrink: 0 }} />
                  <div style={{ minWidth: 220, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0A0E1A", fontFamily: "Inter" }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "#6B7A94", fontFamily: "Inter", marginTop: 2 }}>{item.detail}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "auto" }}>
                    <div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: "#0A0E1A" }}>{item.value}</div>
                    <div style={{ fontSize: 11.5, color: "#6B7A94", fontFamily: "Inter" }}>{item.waiting}</div>
                  </div>
                </div>
              );
              return item.href ? (
                <a key={i} href={item.href} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                  {row}
                </a>
              ) : (
                <div key={i}>{row}</div>
              );
            })}
          </div>
        )}

        {persona.queue.length === 0 && persona.charts.length === 0 && (
          <div className="enterprise-card" style={{ padding: 24, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#6B7A94", fontFamily: "Inter" }}>Nothing awaiting your decision.</p>
          </div>
        )}
      </main>

      <AiWidget open={aiOpen} onOpenChange={setAiOpen} />
    </div>
  );
}
