import { AlertTriangle } from "lucide-react";

export function DataError({ error }: { error: unknown }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-2xl border border-border bg-white px-8 py-16 text-center">
      <AlertTriangle className="size-8 text-destructive" strokeWidth={1.5} />
      <p className="text-lg font-semibold text-foreground">Couldn&apos;t reach the data service</p>
      <p className="max-w-md text-sm text-secondary-foreground/80">
        {error instanceof Error ? error.message : "The backend API isn't responding. Confirm it's running."}
      </p>
    </div>
  );
}
