import type { SystemStatus as SystemStatusType } from "@/lib/dashboard-data";

export function SystemStatus({ status }: { status: SystemStatusType }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={`size-1.5 rounded-full ${status.ok ? "bg-primary" : "bg-destructive"}`}
        aria-hidden
      />
      <span className="font-medium text-secondary-foreground/80">
        {status.ok ? "All systems operational" : "Connection issue detected"}
      </span>
      {status.synthetic && (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
          Demo data — Fabric unreachable
        </span>
      )}
    </div>
  );
}
