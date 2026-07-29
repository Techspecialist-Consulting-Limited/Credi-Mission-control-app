const STATUS_COLOR: Record<string, string> = {
  Approved: "#27ae60",
  Active: "#27ae60",
  Low: "#27ae60",
  Resolved: "#27ae60",
  Pending: "#f59e0b",
  Medium: "#f59e0b",
  "In Progress": "#f59e0b",
  "Pending Review": "#f59e0b",
  Rejected: "#ef4444",
  Suspended: "#ef4444",
  High: "#ef4444",
  Open: "#ef4444",
};

const FALLBACK = ["#5b7cfa", "#a855f7", "#64748b", "#cbd5e1"];

export function colorsFor(labels: string[]): string[] {
  let fallbackIndex = 0;
  return labels.map((label) => STATUS_COLOR[label] ?? FALLBACK[fallbackIndex++ % FALLBACK.length]);
}
