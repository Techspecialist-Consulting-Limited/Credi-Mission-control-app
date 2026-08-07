"use client";

import { useEffect } from "react";

/** Root error boundary.
 *
 * The data layer fetches its source tables over the network at request time,
 * so a failure here is a genuine possibility, not a theoretical one. The copy
 * follows the same rule as everything else on this dashboard: say what
 * happened in plain words, say what it means, and give the reader something
 * to do about it - never a bare error string. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Dashboard render failed:", error);
  }, [error]);

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6F9", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="enterprise-card" style={{ padding: 36, maxWidth: 560, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
              <path d="M8.5 5.6v3.6M8.5 11.8h.007" stroke="#B91C1C" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="8.5" cy="8.5" r="6.6" stroke="#B91C1C" strokeWidth="1.4" />
            </svg>
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#B91C1C", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-sans)" }}>
            Data unavailable
          </span>
        </div>

        <h1 className="font-display" style={{ fontSize: 26, fontWeight: 700, color: "#0A0E1A", letterSpacing: "-0.02em", margin: "0 0 12px", lineHeight: 1.2 }}>
          We couldn&rsquo;t load this dashboard.
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#5A6880", margin: "0 0 8px", fontFamily: "var(--font-sans)" }}>
          The connection to the source systems didn&rsquo;t complete, so none of the figures on this page could be calculated. Nothing has been
          lost and nothing has changed &mdash; the dashboard simply has no data to show you right now.
        </p>
        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#5A6880", margin: "0 0 24px", fontFamily: "var(--font-sans)" }}>
          This is usually temporary. Try again, and if it keeps happening, let the ICT team know the source systems aren&rsquo;t reachable.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="ms-blue-btn" onClick={reset} style={{ padding: "9px 18px" }}>
            Try again
          </button>
          <a className="ghost-btn" href="/" style={{ padding: "9px 18px", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            Back to Executive Overview
          </a>
        </div>

        {error.digest && (
          <p style={{ fontSize: 11, color: "#5A6880", marginTop: 22, marginBottom: 0, fontFamily: "var(--font-mono)" }}>
            Reference for ICT: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
