"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { Notification } from "@/lib/types/database";

const SEVERITY_DOT: Record<Notification["severity"], string> = {
  info: "bg-signal-500",
  notice: "bg-monitor",
  elevated: "bg-elevated"
};

export function NotificationsList({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState<string | null>(null);

  async function markRead(id: string) {
    setDismissing(id);
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setDismissing(null);
    router.refresh();
  }

  return (
    <ul className="divide-y divide-slate-100 rounded border border-slate-200 bg-white">
      {notifications.map((n) => (
        <li key={n.id} className={clsx("flex items-start gap-3 p-4", n.read && "opacity-60")}>
          <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", SEVERITY_DOT[n.severity])} aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-medium text-ink">{n.title}</p>
            <p className="mt-0.5 text-sm text-slate-600">{n.message}</p>
            <p className="mt-1 text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</p>
          </div>
          {!n.read && (
            <button
              onClick={() => markRead(n.id)}
              disabled={dismissing === n.id}
              className="shrink-0 text-xs font-medium text-slate-500 hover:text-ink"
            >
              Mark read
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
