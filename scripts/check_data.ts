import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error("Supabase URL and server key are required.");
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: user } = await supabase.from("profiles").select("user_id").eq("full_name", "Stable User").single();
  if (!user) throw new Error("No matching test account was found.");
  console.log("User:", user.user_id);
  
  if (!user) throw new Error("No matching test account was found.");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
  console.log("Today:", today);

  const [activity, sleep, mood, analysis] = await Promise.all([
    supabase.from("daily_activity").select("*").eq("user_id", user.user_id).eq("date", today).maybeSingle(),
    supabase.from("sleep_records").select("*").eq("user_id", user.user_id).eq("date", today).maybeSingle(),
    supabase.from("mood_records").select("*").eq("user_id", user.user_id).eq("date", today).maybeSingle(),
    supabase.from("ai_analysis").select("*").eq("user_id", user.user_id).eq("period", "daily").order("date", { ascending: false }).limit(1).maybeSingle()
  ]);

  console.log("Activity:", activity.data ? "Exists" : "Null");
  console.log("Sleep:", sleep.data ? "Exists" : "Null");
  console.log("Mood:", mood.data ? "Exists" : "Null");
  console.log("Analysis:", analysis.data ? "Exists" : "Null");
}

check().catch(console.error);
