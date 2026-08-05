"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Domain, DomainKey, Risk } from "./dashboard";
import { DOMAIN_TAGLINES } from "./dashboard";

export function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [onClose]);
  return ref;
}

const PERSONAS = [
  { label: "MD / CEO View", href: "/" },
  { label: "CFO View", href: "/persona/cfo" },
  { label: "Head of Procurement", href: "/persona/procurement" },
  { label: "Head of ICT", href: "/persona/ict" },
  { label: "Head of Growth & Strategy", href: "/persona/growth" },
];

interface SearchResult {
  kind: "domain" | "risk" | "kpi";
  label: string;
  detail: string;
  action: () => void;
}

export function CommandBar({
  domains,
  risks,
  asOfLabel,
  timeStr,
  onOpenDomain,
  onGoHome,
  onOpenRisk,
  onOpenAI,
  activeHref = "/",
}: {
  domains: Domain[];
  risks: Risk[];
  asOfLabel: string;
  timeStr: string;
  onOpenDomain: (key: DomainKey) => void;
  onGoHome: () => void;
  onOpenRisk: (risk: Risk) => void;
  onOpenAI: () => void;
  activeHref?: string;
}) {
  const activePersonaLabel = PERSONAS.find((p) => p.href === activeHref)?.label ?? PERSONAS[0].label;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [personaOpen, setPersonaOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const personaRef = useClickOutside(() => setPersonaOpen(false));
  const bellRef = useClickOutside(() => setBellOpen(false));
  const searchRef = useClickOutside(() => setSearchFocused(false));

  const highPriorityRisks = risks.filter((r) => r.priority === "high");

  const searchIndex = useMemo<SearchResult[]>(() => {
    const items: SearchResult[] = [];
    for (const d of domains) {
      items.push({ kind: "domain", label: d.label, detail: `Domain · Score ${d.score}/100`, action: () => onOpenDomain(d.key) });
      for (const kpi of d.kpis) {
        if (!kpi.href) continue;
        items.push({ kind: "kpi", label: kpi.label, detail: `${d.label} · ${kpi.value}`, action: () => { window.location.href = kpi.href!; } });
      }
    }
    for (const r of risks) {
      items.push({ kind: "risk", label: r.title, detail: `${r.subtitle} · ${r.impactLevel} priority`, action: () => onOpenRisk(r) });
    }
    return items;
  }, [domains, risks, onOpenDomain, onOpenRisk]);

  const searchResults = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return [];
    return searchIndex.filter((item) => item.label.toLowerCase().includes(q) || item.detail.toLowerCase().includes(q)).slice(0, 6);
  }, [searchValue, searchIndex]);

  // Plain History API rather than next/navigation's router: this is a same-page
  // query-string sync purely for shareable/bookmarkable URLs (read back by
  // Dashboard's on-mount effect) - nothing server-side needs to react to it, so
  // there's no reason to route it through Next's navigation machinery.
  const goToDomain = (key: DomainKey) => {
    onOpenDomain(key);
    window.history.replaceState(null, "", `/?domain=${key}`);
    setMobileOpen(false);
  };
  const goHome = () => {
    onGoHome();
    window.history.replaceState(null, "", "/");
    setMobileOpen(false);
  };

  const runSearchResult = (r: SearchResult) => {
    r.action();
    setSearchValue("");
    setSearchFocused(false);
  };

  return (
    <header className="command-bar" style={{ position: "sticky", top: 0, zIndex: 150, padding: "0 16px" }}>
      <div style={{ height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, background: "#0F8A4B", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="0.5" y="0.5" width="6.5" height="6.5" fill="white" opacity="0.9" />
              <rect x="9" y="0.5" width="6.5" height="6.5" fill="white" opacity="0.65" />
              <rect x="0.5" y="9" width="6.5" height="6.5" fill="white" opacity="0.65" />
              <rect x="9" y="9" width="6.5" height="6.5" fill="white" opacity="0.4" />
            </svg>
          </div>
          <button onClick={goHome} className="hidden sm:block" style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
            <div className="font-display" style={{ fontSize: 13, fontWeight: 700, color: "#0A0E1A", letterSpacing: "-0.01em", lineHeight: 1 }}>Zamani Development Finance</div>
            <div style={{ fontSize: 10, color: "#6B7A94", fontFamily: "Inter", lineHeight: 1, marginTop: 2 }}>Enterprise Intelligence Platform</div>
          </button>
        </div>

        {/* ── Desktop nav cluster ─────────────────────────────────────────── */}
        <div className="hidden xl:flex" style={{ alignItems: "center", gap: 16, flexShrink: 0 }}>
          <div style={{ width: 1, height: 22, background: "rgba(10,14,26,0.1)", flexShrink: 0 }} />
          <div ref={personaRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setPersonaOpen((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: personaOpen ? "#F4F6F9" : "transparent", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0E1A", fontFamily: "Inter" }}>{activePersonaLabel}</span>
              <span style={{ fontSize: 10, color: "#6B7A94", transform: personaOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
            </button>
            {personaOpen && (
              <div data-testid="persona-dropdown" className="dropdown-pop" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, width: 220, background: "white", border: "1px solid rgba(10,14,26,0.08)", borderRadius: 10, boxShadow: "0 8px 24px rgba(10,14,26,0.12)", padding: 6, zIndex: 60 }}>
                {PERSONAS.map((p) => {
                  const isActive = p.href === activeHref;
                  return (
                    <Link
                      key={p.label}
                      href={p.href}
                      onClick={() => setPersonaOpen(false)}
                      style={{ display: "block", padding: "8px 10px", borderRadius: 6, textDecoration: "none", fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? "#0F8A4B" : "#0A0E1A", background: isActive ? "#E7F6ED" : "transparent", fontFamily: "Inter" }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#F4F6F9"; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                    >
                      {p.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{ width: 1, height: 22, background: "rgba(10,14,26,0.1)", flexShrink: 0 }} />
          <nav style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <button
              onClick={goHome}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                border: "none",
                background: activeHref === "/" ? "#E7F6ED" : "transparent",
                color: activeHref === "/" ? "#0F8A4B" : "#6B7A94",
                fontSize: 12,
                fontWeight: activeHref === "/" ? 600 : 400,
                cursor: "pointer",
                fontFamily: "Inter",
              }}
            >
              Executive Overview
            </button>
            {(["finance", "procurement", "partners"] as DomainKey[]).map((key) => {
              const domain = domains.find((d) => d.key === key);
              if (!domain) return null;
              return (
                <button
                  key={key}
                  onClick={() => goToDomain(key)}
                  title={DOMAIN_TAGLINES[key]}
                  style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "transparent", color: "#6B7A94", fontSize: 12, fontWeight: 400, cursor: "pointer", fontFamily: "Inter", transition: "all 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F4F6F9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {domain.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div style={{ flex: 1 }} />

        {/* ── Search (desktop) ────────────────────────────────────────────── */}
        <div ref={searchRef} className="hidden md:block" style={{ position: "relative", flexShrink: 0 }}>
          <div className="search-bar" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", width: searchFocused ? 280 : 200, transition: "width 0.2s ease" }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="5.5" cy="5.5" r="4.5" stroke="#6B7A94" strokeWidth="1.2" />
              <path d="M9 9L12 12" stroke="#6B7A94" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search risks, domains, KPIs…"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              style={{ background: "transparent", border: "none", outline: "none", fontSize: 12, color: "#0A0E1A", fontFamily: "Inter", width: "100%" }}
            />
          </div>
          {searchFocused && searchValue.trim() && (
            <div data-testid="search-results-dropdown" className="dropdown-pop" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 320, background: "white", border: "1px solid rgba(10,14,26,0.08)", borderRadius: 10, boxShadow: "0 8px 24px rgba(10,14,26,0.12)", padding: 6, zIndex: 60, maxHeight: 320, overflowY: "auto" }}>
              {searchResults.length === 0 && <div style={{ padding: "10px 10px", fontSize: 12, color: "#6B7A94", fontFamily: "Inter" }}>No matches for &ldquo;{searchValue}&rdquo;.</div>}
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => runSearchResult(r)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F4F6F9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0A0E1A", fontFamily: "Inter" }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: "#6B7A94", fontFamily: "Inter", marginTop: 1 }}>{r.detail}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right cluster ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div className="hidden xl:flex" style={{ alignItems: "center", gap: 5, padding: "4px 10px", background: "rgba(5,150,105,0.07)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 6 }}>
            <span className="live-pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", color: "#059669" }} />
            <span style={{ fontSize: 11, color: "#047857", fontWeight: 500, fontFamily: '"JetBrains Mono",monospace' }}>Data as of {asOfLabel}</span>
          </div>

          <div ref={bellRef} style={{ position: "relative" }}>
            <button
              onClick={() => setBellOpen((v) => !v)}
              aria-label="Notifications"
              style={{ position: "relative", background: bellOpen ? "#F4F6F9" : "transparent", border: "1px solid rgba(10,14,26,0.08)", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M7.5 1.5C5.01 1.5 3 3.51 3 6v3l-1.5 1.5v.75h12V9.5L12 8V6c0-2.49-2.01-4.5-4.5-4.5z" stroke="#0A0E1A" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M6 11.5c0 .83.67 1.5 1.5 1.5S9 12.33 9 11.5" stroke="#0A0E1A" strokeWidth="1.2" fill="none" />
              </svg>
              {highPriorityRisks.length > 0 && (
                <span style={{ position: "absolute", top: -2, right: -2, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 8, background: "#DC2626", border: "1.5px solid white", fontSize: 9, fontWeight: 700, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter" }}>
                  {highPriorityRisks.length}
                </span>
              )}
            </button>
            {bellOpen && (
              <div data-testid="notifications-dropdown" className="dropdown-pop" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 300, background: "white", border: "1px solid rgba(10,14,26,0.08)", borderRadius: 10, boxShadow: "0 8px 24px rgba(10,14,26,0.12)", padding: 6, zIndex: 60 }}>
                <div style={{ padding: "6px 8px 8px", fontSize: 11, fontWeight: 700, color: "#6B7A94", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "Inter" }}>
                  High priority ({highPriorityRisks.length})
                </div>
                {highPriorityRisks.length === 0 && <div style={{ padding: "6px 8px 10px", fontSize: 12, color: "#6B7A94", fontFamily: "Inter" }}>No high-priority items right now.</div>}
                {highPriorityRisks.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      onOpenRisk(r);
                      setBellOpen(false);
                    }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F4F6F9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#0A0E1A", fontFamily: "Inter" }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: "#6B7A94", fontFamily: "Inter", marginTop: 1 }}>{r.subtitle} · {r.time}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onOpenAI}
            className="hidden sm:flex"
            data-testid="nav-ai-assistant-button"
            style={{ alignItems: "center", gap: 6, padding: "5px 12px", background: "#0F8A4B", border: "none", borderRadius: 8, cursor: "pointer", color: "white", fontSize: 12, fontWeight: 600, fontFamily: "Inter" }}
          >
            <span>✦</span>Ask Ada
          </button>

          <div className="hidden xl:block" style={{ fontSize: 13, fontWeight: 600, color: "#0A0E1A", fontFamily: '"JetBrains Mono",monospace', letterSpacing: "0.05em" }}>{timeStr}</div>

          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            className="xl:hidden"
            style={{ background: "transparent", border: "1px solid rgba(10,14,26,0.08)", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              {mobileOpen ? (
                <path d="M3 3L13 13M13 3L3 13" stroke="#0A0E1A" strokeWidth="1.4" strokeLinecap="round" />
              ) : (
                <path d="M2 4.5h12M2 8h12M2 11.5h12" stroke="#0A0E1A" strokeWidth="1.4" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* ── Mobile menu ───────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="xl:hidden" style={{ borderTop: "1px solid rgba(10,14,26,0.07)", padding: "12px 4px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="search-bar" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="5.5" cy="5.5" r="4.5" stroke="#6B7A94" strokeWidth="1.2" />
              <path d="M9 9L12 12" stroke="#6B7A94" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search risks, domains, KPIs…"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#0A0E1A", fontFamily: "Inter", width: "100%" }}
            />
          </div>
          {searchValue.trim() &&
            searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => runSearchResult(r)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(10,14,26,0.06)", background: "white", cursor: "pointer" }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0A0E1A", fontFamily: "Inter" }}>{r.label}</div>
                <div style={{ fontSize: 11, color: "#6B7A94", fontFamily: "Inter" }}>{r.detail}</div>
              </button>
            ))}

          <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7A94", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "Inter", marginTop: 6 }}>Views</div>
          <button onClick={goHome} style={{ textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "none", background: "#E7F6ED", color: "#0F8A4B", fontSize: 13, fontWeight: 600, fontFamily: "Inter", cursor: "pointer" }}>
            Executive Overview
          </button>
          {(["finance", "procurement", "partners"] as DomainKey[]).map((key) => {
            const domain = domains.find((d) => d.key === key);
            if (!domain) return null;
            return (
              <button
                key={key}
                onClick={() => goToDomain(key)}
                style={{ textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "none", background: "#F4F6F9", color: "#0A0E1A", fontSize: 13, fontWeight: 500, fontFamily: "Inter", cursor: "pointer", display: "flex", flexDirection: "column", gap: 2 }}
              >
                <span>{domain.label}</span>
                <span style={{ fontSize: 11, fontWeight: 400, color: "#6B7A94" }}>{DOMAIN_TAGLINES[key]}</span>
              </button>
            );
          })}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="live-pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", color: "#059669" }} />
              <span style={{ fontSize: 11, color: "#047857", fontWeight: 500, fontFamily: '"JetBrains Mono",monospace' }}>Data as of {asOfLabel}</span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0E1A", fontFamily: '"JetBrains Mono",monospace' }}>{timeStr}</span>
          </div>
        </div>
      )}
    </header>
  );
}
