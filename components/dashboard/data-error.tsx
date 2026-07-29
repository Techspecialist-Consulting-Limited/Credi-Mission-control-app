"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";

export function DataError({ error }: { error: unknown }) {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-2xl border border-border bg-white px-8 py-16 text-center">
      <AlertTriangle className="size-8 text-destructive" strokeWidth={1.5} />
      <p className="text-lg font-semibold text-foreground">Couldn&apos;t reach the data service</p>
      <p className="max-w-md text-sm text-secondary-foreground/80">
        {error instanceof Error ? error.message : "The backend API isn't responding. Confirm it's running."}
      </p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="mt-2 flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-primary/90"
      >
        <RotateCw className="size-3.5" strokeWidth={2.5} /> Try again
      </button>
    </div>
  );
}
