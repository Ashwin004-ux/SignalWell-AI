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
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());

  const sleeps = [{
    user_id: user.user_id,
    date: today,
    sleep_duration_minutes: 480,
    sleep_quality: 80,
    interruptions: 1
  }];

  const { error: sleepError } = await supabase.from("sleep_records").upsert(sleeps, { onConflict: "user_id, date" });
  console.log("Sleep Upsert Error:", sleepError);

  const { error: moodError } = await supabase.from("mood_records").upsert([{
    user_id: user.user_id,
    date: today,
    mood_score: 80,
    stress_score: 20,
    anxiety_score: 20,
    wellbeing_score: 80
  }], { onConflict: "user_id, date" });
  console.log("Mood Upsert Error:", moodError);
}

check().catch(console.error);
