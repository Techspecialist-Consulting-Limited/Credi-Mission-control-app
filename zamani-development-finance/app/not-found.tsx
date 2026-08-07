import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", background: "#F4F6F9", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="enterprise-card" style={{ padding: 36, maxWidth: 560, width: "100%" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#5A6880", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-sans)" }}>
          Page not found
        </span>
        <h1 className="font-display" style={{ fontSize: 26, fontWeight: 700, color: "#0A0E1A", letterSpacing: "-0.02em", margin: "14px 0 12px", lineHeight: 1.2 }}>
          That view doesn&rsquo;t exist.
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#5A6880", margin: "0 0 24px", fontFamily: "var(--font-sans)" }}>
          The link may be out of date, or the drill-through you followed points at a record that is no longer in the dataset. The Executive
          Overview has every current view linked from it.
        </p>
        <Link
          className="ms-blue-btn"
          href="/"
          style={{ padding: "9px 18px", textDecoration: "none", display: "inline-flex", alignItems: "center" }}
        >
          Back to Executive Overview
        </Link>
      </div>
    </div>
  );
}
