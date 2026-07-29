"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertOctagon, AlertTriangle, Bell, CheckCircle2, Info, X } from "lucide-react";
import type { Notification } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

const TONE = {
  critical: { bg: "bg-destructive/5", border: "border-l-destructive", icon: "text-negative-text", Icon: AlertOctagon },
  warning: { bg: "bg-warning/5", border: "border-l-warning", icon: "text-caution-text", Icon: AlertTriangle },
  info: { bg: "bg-ai/5", border: "border-l-ai", icon: "text-ai-text", Icon: Info },
} as const;

export function NotificationBell({ initialNotifications }: { initialNotifications: Notification[] }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialNotifications);
  const router = useRouter();

  const dismiss = (key: string) => setItems((prev) => prev.filter((n) => n.key !== key));
  const markAllRead = () => setItems([]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative rounded-lg p-2 text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900"
      >
        <Bell className="size-5" />
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-white bg-destructive px-1 text-[9px] font-extrabold text-white">
            {items.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label="Close notifications"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.16, ease: [0.22, 0.68, 0, 1.2] }}
              className="absolute right-0 top-[calc(100%+10px)] z-50 w-[380px] overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Bell className="size-4 text-foreground" />
                  <span className="text-sm font-bold text-foreground">Notifications</span>
                </div>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-[11.5px] font-semibold text-ai-text hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 divide-y divide-border overflow-y-auto">
                {items.length === 0 ? (
                  <div className="space-y-2 p-8 text-center">
                    <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10">
                      <CheckCircle2 className="size-5 text-primary" />
                    </div>
                    <p className="text-[13px] font-semibold text-foreground">All caught up!</p>
                    <p className="text-[11.5px] text-secondary-foreground/80">Nothing needs attention right now.</p>
                  </div>
                ) : (
                  items.map((n) => {
                    const tone = TONE[n.tone];
                    const Icon = tone.Icon;
                    return (
                      <div key={n.key} className={cn("flex items-start gap-3 border-l-4 p-4", tone.bg, tone.border)}>
                        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                          <Icon className={cn("size-4", tone.icon)} strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13px] font-bold leading-snug text-foreground">{n.title}</p>
                            <button
                              type="button"
                              onClick={() => dismiss(n.key)}
                              aria-label="Dismiss"
                              className="mt-0.5 shrink-0 text-secondary-foreground/50 hover:text-secondary-foreground"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                          <p className="mt-0.5 text-[12px] leading-relaxed text-secondary-foreground/80">{n.body}</p>
                          <button
                            type="button"
                            onClick={() => {
                              dismiss(n.key);
                              setOpen(false);
                              router.push(n.actionHref);
                            }}
                            className="mt-2 text-[11px] font-bold text-ai-text hover:underline"
                          >
                            {n.actionLabel} →
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-border bg-secondary/40 px-4 py-2.5 text-center">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[11px] font-medium text-secondary-foreground/70 hover:text-secondary-foreground"
                >
                  Close panel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
