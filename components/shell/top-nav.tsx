"use client";

import { usePathname } from "next/navigation";
import { Search, Bot, Calendar } from "lucide-react";
import { useAiModal } from "./ai-modal-context";
import { useViewer } from "./viewer-context";
import { NotificationBell } from "./notification-bell";
import type { Notification } from "@/lib/dashboard-data";

const today = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

const PAGE_TITLES: Record<string, string> = {
  "/": "Executive Dashboard",
  "/credo": "Credo Platform Intelligence",
  "/barrister-craig": "Barrister Craig AI",
  "/procurement": "Procurement Portal",
  "/mission-control": "IT Mission Control",
};

export function TopNav({ notifications }: { notifications: Notification[] }) {
  const { open } = useAiModal();
  const { persona } = useViewer();
  const pathname = usePathname();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-8">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold text-foreground">{PAGE_TITLES[pathname] ?? "Mission Control"}</h2>
        <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground/80">
          {persona.title} View
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => open()}
          className="flex w-64 items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs text-secondary-foreground/80 transition-colors duration-150 hover:bg-secondary"
        >
          <Search className="size-3.5" />
          <span className="flex-1 truncate text-left">Search platform or ask AI…</span>
          <kbd className="rounded border border-border bg-white px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground/70">
            ⌘K
          </kbd>
        </button>

        <div className="hidden items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground md:flex">
          <Calendar className="size-3.5 text-secondary-foreground/70" />
          {today}
        </div>

        <button
          type="button"
          onClick={() => open()}
          title="Ask AI Assistant"
          className="rounded-lg border border-ai/30 bg-ai/10 p-2 text-ai transition-colors duration-150 hover:bg-ai/20"
        >
          <Bot className="size-4" />
        </button>

        <NotificationBell initialNotifications={notifications} />

        <div className="flex items-center gap-2.5 border-l border-border pl-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-sidebar text-xs font-semibold text-white">
            {persona.initials}
          </div>
          <div className="hidden text-left leading-none md:block">
            <p className="text-xs font-bold text-foreground">{persona.name}</p>
            <p className="mt-1 text-[10px] text-secondary-foreground/80">{persona.title}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
