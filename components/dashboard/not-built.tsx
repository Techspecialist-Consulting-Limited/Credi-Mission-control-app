import { LayoutTemplate } from "lucide-react";

export function NotBuilt({ title }: { title: string }) {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-20 text-center shadow-sm">
        <LayoutTemplate className="size-9 text-secondary-foreground/60" strokeWidth={1.5} />
        <h1 className="text-lg font-semibold text-foreground">{title} isn&apos;t part of this prototype</h1>
        <p className="max-w-md text-sm text-secondary-foreground/80">
          This section is scaffolded but not built. The prototype demonstrates the integration pattern across Credo, Barrister
          Craig and the Procurement Portal — additional modules plug into the same framework without a redesign.
        </p>
      </div>
    </div>
  );
}
