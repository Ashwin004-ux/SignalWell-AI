import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { Card, CardHeading } from "@/components/ui/card";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, timezone")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Your profile and account details.</p>
      </div>

      <Card>
        <CardHeading>Profile</CardHeading>
        <ProfileForm
          initialFullName={profile?.full_name ?? ""}
          initialTimezone={profile?.timezone ?? "UTC"}
          email={user.email ?? ""}
        />
      </Card>

      <Card>
        <CardHeading>Account data controls</CardHeading>
        <p className="mt-2 text-sm text-slate-500">
          Data collection toggles, export, and account deletion live on the{" "}
          <a href="/dashboard/privacy" className="text-signal-600 underline underline-offset-2">
            Privacy &amp; Data
          </a>{" "}
          page.
        </p>
      </Card>
    </div>
  );
}
