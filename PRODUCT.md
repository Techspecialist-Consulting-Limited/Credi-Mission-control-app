# Product

## Register

product

## Users

CREDICORP Nigeria executives, board members, and department heads. They open this once or twice a day, not continuously — a review moment, not a working session. They are not analysts; they don't want to browse data, they want to know what needs them.

## Product Purpose

Mission Control aggregates operational intelligence from three internal platforms — Credo (workflow automation: memos, travel, procurement, compliance, support), Barrister Craig (AI compliance assistant), and Procurement Portal — into a single executive view. Success is a decision-maker landing on the page and immediately knowing what needs their attention right now, with everything else available a click deeper rather than competing for the same visual space.

## Brand Personality

Authoritative, calm, premium — but expressed now as a dense, live executive intelligence surface rather than a minimal editorial one. Every screen should read as mission control for a serious financial institution: information-forward, always-on, comfortable putting real numbers in front of an executive rather than hiding them behind whitespace. Premium is carried by consistency, real-time responsiveness, and the discipline of never showing a number that isn't real — not by sparseness for its own sake.

## Anti-references

- Generic SaaS/admin templates (AdminLTE, Metronic, CoreUI) — the "any startup's back office" look, copied wholesale rather than adapted to this institution's data
- Decorative AI chrome that fabricates capability the system doesn't have — an "AI confidence score" or "embedding quality" gauge with no real model telemetry behind it is worse than no gauge at all
- Fabricated or hardcoded figures dressed up as live data — a notification timestamped "2 mins ago" that was actually computed at page render, or a chart citing documents/regions/amounts that don't exist in the connected dataset
- Chart-per-tile sprawl with no real distinction between what's a KPI, a trend, and an alert — density is fine, but every element still needs a reason to be exactly that shape

## Design Principles

1. **Density is earned by relevance, not filled for effect.** A KPI grid, a notification center, an activity heatmap, and a detail table can all coexist on one screen — but each exists because an executive asks that exact question, not to make the screen feel busier.
2. **Every tile traces to a real query.** If a number, gauge, or chart can't be computed from a real column in `credo_memos`, `credo_travel_details`, `credo_support_tickets`, `vendor_registry`, or `craig_audit_logs`, it doesn't ship — the closest honest equivalent from real data replaces it instead of an invented metric.
3. **AI-generated content is never confused with computed content.** A banner or briefing built from real aggregate queries is labeled "Computed from live data"; only text that actually came back from the grounded `/ai/ask` agent is presented as AI-generated. Neither is allowed to borrow the other's credibility.
4. **Never blur real and synthetic data.** The backend already marks demo/fallback data explicitly (`synthetic: true`); the UI must carry that distinction visibly (sidebar connection status) rather than let it disappear into the design.
5. **One click deeper, never buried.** Depth and drill-down exist — filters, sub-tabs, and detail tables — but the entry screen never asks the executive to hunt for what matters most right now.

## Accessibility & Inclusion

WCAG 2.1 AA baseline — this is a government-sector platform. Contrast ratios (4.5:1 body text, 3:1 large text), full keyboard navigation, visible focus states, and ARIA labels on interactive and status elements.
