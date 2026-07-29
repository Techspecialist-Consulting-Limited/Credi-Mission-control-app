import { CircleCheck } from "lucide-react";
import type { VendorRow } from "@/lib/dashboard-data";

const STATUS_TONE: Record<string, string> = {
  Suspended: "bg-destructive/10 text-negative-text",
  "Pending Review": "bg-warning/10 text-caution-text",
};

export function VendorList({ vendors }: { vendors: VendorRow[] }) {
  if (vendors.length === 0) {
    return (
      <section className="flex h-full flex-col items-center justify-center rounded-2xl border border-border bg-card px-8 py-14 text-center shadow-sm">
        <CircleCheck className="size-8 text-primary" strokeWidth={1.5} />
        <p className="mt-3 text-lg font-semibold text-foreground">No vendors need review</p>
        <p className="mt-1 text-sm text-secondary-foreground/80">Every registered vendor is in good standing.</p>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-1">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">Vendors needing review</h2>
        <p className="mt-0.5 text-[13px] text-secondary-foreground/80">Suspended or pending registration review</p>
      </div>

      <ul className="mt-2">
        {vendors.map((vendor, i) => (
          <li key={vendor.vendorId} className={i > 0 ? "border-t border-border" : undefined}>
            <div className="-mx-2 flex items-center gap-4 rounded-lg px-2 py-3.5 transition-colors duration-150 hover:bg-secondary/40">
              <span className="h-9 w-[3px] shrink-0 rounded-full bg-warning" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold tracking-tight text-foreground">{vendor.vendorName}</p>
                <p className="mt-0.5 truncate text-[12.5px] text-secondary-foreground/80">
                  {vendor.category} · {vendor.state} · registered {vendor.registeredDate}
                </p>
              </div>
              <span className={`shrink-0 rounded-md px-2.5 py-1 text-[11.5px] font-semibold ${STATUS_TONE[vendor.status] ?? "bg-secondary text-secondary-foreground/80"}`}>
                {vendor.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
