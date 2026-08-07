"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [personaOpen, setPersonaOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const personaRef = useClickOutside(() => setPersonaOpen(false));
  const bellRef = useClickOutside(() => setBellOpen(false));
  const searchRef = useClickOutside(() => setSearchFocused(false));
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Esc closes whichever surface is open. Without this the only way out of the
  // mobile nav or a dropdown is a precise tap outside it, which is exactly the
  // "no emergency exit" trap keyboard and one-handed users fall into.
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMobileNavOpen(false);
      setPersonaOpen(false);
      setBellOpen(false);
      setSearchFocused(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  // A route change means the destination was reached - the sheet should never
  // still be sitting open over the page the user just asked for.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [activeHref]);

  // ⌘K / Ctrl+K jumps straight into search from anywhere on the page - the
  // accelerator power users expect from a command bar with search + AI ask,
  // and currently the only way in was a mouse click.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Drives the right-edge fade on the nav: on when the row genuinely overflows,
  // off when everything fits, so the affordance never lies in either direction.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const sync = () => el.setAttribute("data-fits", String(el.scrollWidth <= el.clientWidth + 1));
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [domains]);

  const highPriorityRisks = risks.filter((r) => r.priority === "high");

  const searchIndex = useMemo<SearchResult[]>(() => {
    const items: SearchResult[] = [];
    for (const d of domains) {
      items.push({ kind: "domain", label: d.label, detail: `Domain · ${d.tileHeadline}`, action: () => onOpenDomain(d.key) });
      for (const kpi of d.kpis) {
        if (!kpi.href) continue;
        items.push({ kind: "kpi", label: kpi.label, detail: `${d.label} · ${kpi.value}`, action: () => { router.push(kpi.href!); } });
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
  };
  const goHome = () => {
    onGoHome();
    window.history.replaceState(null, "", "/");
  };

  const runSearchResult = (r: SearchResult) => {
    r.action();
    setSearchValue("");
    setSearchFocused(false);
  };

  return (
    <header className="command-bar" style={{ position: "sticky", top: 0, zIndex: "var(--z-header)" as unknown as number, padding: "0 16px" }}>
      <div style={{ height: 56, display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, background: "#0D7A42", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="0.5" y="0.5" width="6.5" height="6.5" fill="white" opacity="0.9" />
              <rect x="9" y="0.5" width="6.5" height="6.5" fill="white" opacity="0.65" />
              <rect x="0.5" y="9" width="6.5" height="6.5" fill="white" opacity="0.65" />
              <rect x="9" y="9" width="6.5" height="6.5" fill="white" opacity="0.4" />
            </svg>
          </div>
          <button onClick={goHome} className="hidden sm:block" style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
            <div className="font-display" style={{ fontSize: 13, fontWeight: 700, color: "#0A0E1A", letterSpacing: "-0.01em", lineHeight: 1 }}>Zamani Development Finance</div>
            <div style={{ fontSize: 10, color: "#5A6880", fontFamily: "var(--font-sans)", lineHeight: 1, marginTop: 2 }}>Enterprise Intelligence Platform</div>
          </button>
        </div>

        {/* ── Mobile / tablet nav trigger ───────────────────────────────────
            The desktop cluster below is `hidden lg:flex`, so without this
            everything under 1024px had no way to reach any domain workspace
            or persona view at all - the dashboard was a dead end on a phone.
            44px target, per touch guidance. */}
        {/* Display lives in the classes, not the inline style: an inline
            `display: flex` outranks `lg:hidden` and would leave the hamburger
            visible on desktop next to the full nav. */}
        <button
          className="flex lg:hidden items-center justify-center"
          onClick={() => setMobileNavOpen((v) => !v)}
          aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-nav-sheet"
          style={{
            width: 44,
            height: 44,
            marginLeft: -6,
            background: mobileNavOpen ? "#F4F6F9" : "transparent",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            {mobileNavOpen ? (
              <path d="M4 4l10 10M14 4L4 14" stroke="#0A0E1A" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <>
                <path d="M2.5 5h13" stroke="#0A0E1A" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M2.5 9h13" stroke="#0A0E1A" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M2.5 13h13" stroke="#0A0E1A" strokeWidth="1.6" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>

        {/* ── Desktop nav cluster ───────────────────────────────────────────
            minWidth:0 lets this cluster shrink inside the flex row (flex
            items default to min-width:auto, which would otherwise force the
            whole header to overflow/wrap). The <nav> below scrolls
            horizontally on its own when the domain labels - now full
            source-system names like "Microsoft Dynamics (ERP)" - don't all
            fit, so the header itself always stays a single line. */}
        <div className="hidden lg:flex" style={{ alignItems: "center", gap: 16, flexShrink: 1, minWidth: 0 }}>
          <div style={{ width: 1, height: 22, background: "rgba(10,14,26,0.1)", flexShrink: 0 }} />
          <div ref={personaRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setPersonaOpen((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: personaOpen ? "#F4F6F9" : "transparent", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0A0E1A", fontFamily: "var(--font-sans)", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activePersonaLabel}</span>
              <span style={{ fontSize: 10, color: "#5A6880", flexShrink: 0, transform: personaOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
            </button>
            {personaOpen && (
              <div data-testid="persona-dropdown" className="dropdown-pop" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, width: 220, background: "white", border: "1px solid rgba(10,14,26,0.08)", borderRadius: 10, boxShadow: "0 8px 24px rgba(10,14,26,0.12)", padding: 6, zIndex: "var(--z-dropdown)" as unknown as number }}>
                {PERSONAS.map((p) => {
                  const isActive = p.href === activeHref;
                  return (
                    <Link
                      key={p.label}
                      href={p.href}
                      onClick={() => setPersonaOpen(false)}
                      style={{ display: "block", padding: "8px 10px", borderRadius: 6, textDecoration: "none", fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? "#0D7A42" : "#0A0E1A", background: isActive ? "#E7F6ED" : "transparent", fontFamily: "var(--font-sans)" }}
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
          <nav ref={navRef} className="nav-scroll" style={{ display: "flex", alignItems: "center", gap: 4, overflowX: "auto", minWidth: 0 }}>
            <button
              onClick={goHome}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                border: "none",
                background: activeHref === "/" ? "#E7F6ED" : "transparent",
                color: activeHref === "/" ? "#0D7A42" : "#5A6880",
                fontSize: 12,
                fontWeight: activeHref === "/" ? 600 : 400,
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              Executive Overview
            </button>
            {(["lending", "finance", "partners", "procurement"] as DomainKey[]).map((key) => {
              const domain = domains.find((d) => d.key === key);
              if (!domain) return null;
              return (
                <button
                  key={key}
                  onClick={() => goToDomain(key)}
                  title={DOMAIN_TAGLINES[key]}
                  style={{ padding: "4px 9px", borderRadius: 6, border: "none", background: "transparent", color: "#5A6880", fontSize: 12, fontWeight: 400, cursor: "pointer", fontFamily: "var(--font-sans)", transition: "all 0.15s", flexShrink: 0, whiteSpace: "nowrap" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F4F6F9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {domain.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div style={{ flex: 1, minWidth: 12 }} />

        {/* ── Search (desktop) ────────────────────────────────────────────── */}
        <div ref={searchRef} className="hidden md:block" style={{ position: "relative", flexShrink: 0 }}>
          {/* Fixed width rather than 200 -> 280 on focus. Animating `width`
              re-runs layout for the whole header on every frame, and the
              visible effect was the rest of the bar shuffling sideways each
              time the field took focus. Stable chrome reads as more solid
              than chrome that rearranges itself. */}
          <div className="search-bar" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", width: 200 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="5.5" cy="5.5" r="4.5" stroke="#5A6880" strokeWidth="1.2" />
              <path d="M9 9L12 12" stroke="#5A6880" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search risks, domains, KPIs…"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              style={{ background: "transparent", border: "none", outline: "none", fontSize: 12, color: "#0A0E1A", fontFamily: "var(--font-sans)", width: "100%" }}
            />
            {!searchFocused && !searchValue && (
              <kbd
                aria-hidden="true"
                style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, color: "#5A6880", fontFamily: "var(--font-mono)", background: "rgba(10,14,26,0.05)", border: "1px solid rgba(10,14,26,0.08)", borderRadius: 4, padding: "1px 5px", lineHeight: 1.5 }}
              >
                ⌘K
              </kbd>
            )}
          </div>
          {searchFocused && searchValue.trim() && (
            <div data-testid="search-results-dropdown" className="dropdown-pop" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 320, background: "white", border: "1px solid rgba(10,14,26,0.08)", borderRadius: 10, boxShadow: "0 8px 24px rgba(10,14,26,0.12)", padding: 6, zIndex: "var(--z-dropdown)" as unknown as number, maxHeight: 320, overflowY: "auto" }}>
              {searchResults.length === 0 && <div style={{ padding: "10px 10px", fontSize: 12, color: "#5A6880", fontFamily: "var(--font-sans)" }}>No matches for &ldquo;{searchValue}&rdquo;.</div>}
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => runSearchResult(r)}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F4F6F9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0A0E1A", fontFamily: "var(--font-sans)" }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: "#5A6880", fontFamily: "var(--font-sans)", marginTop: 1 }}>{r.detail}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right cluster ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div className="hidden 2xl:flex" style={{ alignItems: "center", gap: 5, padding: "4px 10px", background: "rgba(5,150,105,0.07)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 6 }}>
            <span className="live-pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", color: "#059669" }} />
            <span style={{ fontSize: 11, color: "#047857", fontWeight: 500, fontFamily: "var(--font-mono)" }}>Data as of {asOfLabel}</span>
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
                <span style={{ position: "absolute", top: -2, right: -2, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 8, background: "#DC2626", border: "1.5px solid white", fontSize: 9, fontWeight: 700, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
                  {highPriorityRisks.length}
                </span>
              )}
            </button>
            {bellOpen && (
              <div data-testid="notifications-dropdown" className="dropdown-pop" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 300, background: "white", border: "1px solid rgba(10,14,26,0.08)", borderRadius: 10, boxShadow: "0 8px 24px rgba(10,14,26,0.12)", padding: 6, zIndex: "var(--z-dropdown)" as unknown as number }}>
                <div style={{ padding: "6px 8px 8px", fontSize: 11, fontWeight: 700, color: "#5A6880", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-sans)" }}>
                  High priority ({highPriorityRisks.length})
                </div>
                {highPriorityRisks.length === 0 && <div style={{ padding: "6px 8px 10px", fontSize: 12, color: "#5A6880", fontFamily: "var(--font-sans)" }}>No high-priority items right now.</div>}
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
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#0A0E1A", fontFamily: "var(--font-sans)" }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: "#5A6880", fontFamily: "var(--font-sans)", marginTop: 1 }}>{r.subtitle} · {r.time}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onOpenAI}
            className="hidden sm:flex"
            data-testid="nav-ai-assistant-button"
            style={{ alignItems: "center", gap: 6, padding: "5px 12px", background: "#0D7A42", border: "none", borderRadius: 8, cursor: "pointer", color: "white", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-sans)" }}
          >
            <span>✦</span>Ask Ada
          </button>

          <div className="hidden 2xl:block" style={{ fontSize: 13, fontWeight: 600, color: "#0A0E1A", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>{timeStr}</div>
        </div>
      </div>

      {/* ── Mobile / tablet nav sheet ──────────────────────────────────────
          Carries exactly the same destinations as the desktop cluster: the
          persona list and the four domain workspaces. position:fixed so it
          escapes the header's stacking context and can't be clipped by the
          page's overflow-x containment. */}
      {mobileNavOpen && (
        <>
          <div
            onClick={() => setMobileNavOpen(false)}
            style={{ position: "fixed", inset: "56px 0 0", background: "rgba(10,14,26,0.35)", zIndex: "var(--z-nav-backdrop)" as unknown as number }}
            aria-hidden="true"
          />
          <div
            id="mobile-nav-sheet"
            className="lg:hidden dropdown-pop"
            style={{
              position: "fixed",
              top: 56,
              left: 0,
              right: 0,
              maxHeight: "calc(100vh - 56px)",
              overflowY: "auto",
              background: "white",
              borderBottom: "1px solid rgba(10,14,26,0.08)",
              boxShadow: "0 12px 32px rgba(10,14,26,0.14)",
              zIndex: "var(--z-nav-sheet)" as unknown as number,
              padding: "10px 12px 16px",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "#5A6880", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "var(--font-sans)", padding: "8px 10px 6px" }}>
              Views
            </div>
            {PERSONAS.map((p) => {
              const isActive = p.href === activeHref;
              return (
                <Link
                  key={p.label}
                  href={p.href}
                  onClick={() => setMobileNavOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    minHeight: 44,
                    padding: "10px 12px",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#0D7A42" : "#0A0E1A",
                    background: isActive ? "#E7F6ED" : "transparent",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {p.label}
                </Link>
              );
            })}

            <div style={{ height: 1, background: "rgba(10,14,26,0.08)", margin: "10px 10px" }} />

            <div style={{ fontSize: 10, fontWeight: 700, color: "#5A6880", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "var(--font-sans)", padding: "4px 10px 6px" }}>
              Source systems
            </div>
            {(["lending", "finance", "partners", "procurement"] as DomainKey[]).map((key) => {
              const domain = domains.find((d) => d.key === key);
              if (!domain) return null;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setMobileNavOpen(false);
                    goToDomain(key);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    minHeight: 44,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  <span style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#0A0E1A" }}>{domain.label}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: "#5A6880", marginTop: 2 }}>{domain.tileHeadline}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </header>
  );
}
