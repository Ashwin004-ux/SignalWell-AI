import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/dashboard/empty-state";
import { NotificationsList } from "@/components/dashboard/notifications-list";
import { CheckNotificationsButton } from "@/components/dashboard/check-notifications-button";

export default async function NotificationsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: settings } = await supabase
    .from("user_settings")
    .select("notifications_enabled")
    .eq("user_id", user.id)
    .single();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl text-ink">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            High browser usage, late-night browsing, sleep pattern, and positive-change alerts, generated from
            your own recent averages.
          </p>
        </div>
        {settings?.notifications_enabled !== false && <CheckNotificationsButton />}
      </div>

      {settings?.notifications_enabled === false ? (
        <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          Notifications are turned off. Enable them from{" "}
          <a href="/dashboard/privacy" className="text-signal-600 underline underline-offset-2">
            Privacy &amp; Data
          </a>
          .
        </div>
      ) : !notifications || notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="Log a few days of activity and sleep, then check for updates to see if anything stands out."
        />
      ) : (
        <NotificationsList notifications={notifications} />
      )}
    </div>
  );
}
