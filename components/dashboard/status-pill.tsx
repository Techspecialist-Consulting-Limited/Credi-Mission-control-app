const TONE: Record<string, string> = {
  Approved: "bg-primary/10 text-positive-text",
  Active: "bg-primary/10 text-positive-text",
  Low: "bg-primary/10 text-positive-text",
  Resolved: "bg-primary/10 text-positive-text",
  Pending: "bg-warning/10 text-caution-text",
  Medium: "bg-warning/10 text-caution-text",
  "In Progress": "bg-warning/10 text-caution-text",
  "Pending Review": "bg-warning/10 text-caution-text",
  Rejected: "bg-destructive/10 text-negative-text",
  Suspended: "bg-destructive/10 text-negative-text",
  High: "bg-destructive/10 text-negative-text",
  Open: "bg-destructive/10 text-negative-text",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center rounded-md px-2.5 py-1 text-[11.5px] font-semibold ${
        TONE[status] ?? "bg-secondary text-secondary-foreground/80"
      }`}
    >
      {status}
    </span>
  );
}
