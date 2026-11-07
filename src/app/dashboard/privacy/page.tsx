import { createClient } from "@/lib/supabase/server";
import { PrivacyControls } from "@/components/dashboard/privacy-controls";

export default async function PrivacyPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: settings } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">Privacy &amp; Data</h1>
        <p className="mt-1 text-sm text-slate-500">
          Control what SignalWell collects and generates, export your data, or delete your account.
        </p>
      </div>

      {settings ? (
        <PrivacyControls initialSettings={settings} />
      ) : (
        <p className="text-sm text-slate-400">We couldn't load your settings. Try refreshing the page.</p>
      )}
    </div>
  );
}
