"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import {
  LayoutGrid,
  Workflow,
  Scale,
  ShoppingBag,
  Monitor,
  Sparkles,
  FileText,
  ShieldCheck,
  Check,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useViewer } from "./viewer-context";
import { useAiModal } from "./ai-modal-context";
import type { SystemStatus } from "@/lib/dashboard-data";

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };

const primaryNav: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutGrid },
  { label: "Credo Platform", href: "/credo", icon: Workflow },
  { label: "Barrister Craig AI", href: "/barrister-craig", icon: Scale },
  { label: "Procurement Portal", href: "/procurement", icon: ShoppingBag },
  { label: "Mission Control", href: "/mission-control", icon: Monitor },
];

function NavGroup({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                isActive ? "bg-primary/15 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              )}
            >
              {isActive && <span className="absolute inset-y-1 right-0 w-[3px] rounded-full bg-primary" aria-hidden />}
              <Icon className={cn("size-[18px] shrink-0", isActive && "text-primary")} />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function PersonaSwitcher() {
  const { persona, personas, setPersonaKey } = useViewer();

  return (
    <Menu.Root>
      <Menu.Trigger className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white transition-colors duration-150 hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
        <span className="truncate font-semibold">{persona.title}</span>
        <ChevronDown className="size-3.5 shrink-0 text-slate-400" strokeWidth={2.5} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
          <Menu.Popup className="w-[260px] origin-(--transform-origin) rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Menu.RadioGroup
              value={persona.key}
              onValueChange={(value) => setPersonaKey(value as typeof persona.key)}
            >
              <Menu.GroupLabel className="px-2.5 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Executive viewpoint
              </Menu.GroupLabel>
              {personas.map((p) => (
                <Menu.RadioItem
                  key={p.key}
                  value={p.key}
                  className="flex cursor-default select-none items-center gap-2.5 rounded-lg p-2 outline-none transition-colors duration-150 data-highlighted:bg-white/10"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                    {p.initials}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[12.5px] font-semibold text-white">{p.name}</span>
                    <span className="block truncate text-[11px] text-slate-400">{p.title}</span>
                  </span>
                  <Menu.RadioItemIndicator className="shrink-0 text-primary">
                    <Check className="size-3.5" strokeWidth={2.75} />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function Sidebar({ status }: { status: SystemStatus }) {
  const pathname = usePathname();
  const { open } = useAiModal();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col justify-between bg-sidebar text-slate-300">
      <div>
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
            <ShieldCheck className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-bold tracking-wide text-white">CREDICORP</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Mission Control</p>
          </div>
        </div>

        <div className="mx-3 my-3 rounded-lg border border-slate-700/50 bg-slate-800/60 px-3 py-2.5">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Executive viewpoint
          </label>
          <PersonaSwitcher />
        </div>

        <nav className="mt-2 space-y-4 px-3">
          <NavGroup items={primaryNav} pathname={pathname} />

          <div>
            <div className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Intelligence
            </div>
            <ul className="flex flex-col gap-1">
              <li>
                <button
                  type="button"
                  onClick={() => open()}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-ai transition-colors duration-200 hover:bg-ai/10"
                >
                  <Sparkles className="size-4" />
                  AI Knowledge Search
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    open(
                      "Give me a concise executive briefing across Credo memos, Barrister Craig compliance, and the Procurement Portal."
                    )
                  }
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-400 transition-colors duration-200 hover:bg-white/5 hover:text-slate-100"
                >
                  <FileText className="size-4" />
                  Executive Briefing
                </button>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      <div className="border-t border-slate-800 p-4 text-[11px] text-slate-500">
        <div className="mb-1 flex items-center gap-2">
          <span className={cn("size-2 rounded-full", status.ok ? "animate-pulse bg-primary" : "bg-destructive")} />
          <span className="font-medium text-slate-300">
            {status.synthetic ? "Demo data — Fabric unreachable" : "Fabric Lakehouse Live"}
          </span>
        </div>
        <p>{status.synthetic ? "Synthetic dataset in use" : `Connected · ${status.provider}`}</p>
      </div>
    </aside>
  );
}
