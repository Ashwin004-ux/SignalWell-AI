import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error("Supabase URL and server key are required.");
const supabase = createClient(supabaseUrl, supabaseKey);

async function inject() {
  const { data: user } = await supabase.from("profiles").select("user_id").eq("full_name", "Stable User").single();
  if (!user) throw new Error("No matching test account was found.");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());

  const { error } = await supabase.from("ai_analysis").upsert(
    {
      user_id: user.user_id,
      date: today,
      period: "daily",
      model_name: "gpt-4o-mini",
      overall_wellbeing_score: 85,
      stress_indicator: "stable",
      anxiety_indicator: "stable",
      mood_indicator: "stable",
      sleep_indicator: "stable",
      digital_habit_indicator: "stable",
      risk_level: "stable",
      confidence: 0.9,
      summary: "Your wellbeing looks incredibly stable over the past week. Consistent sleep and mood are excellent indicators of your strong routine.",
      contributing_factors: ["Consistent sleep patterns", "Stable mood reported"],
      recommendations: ["Maintain current routine", "Keep logging data"]
    },
    { onConflict: "user_id,date,period" }
  );
  
  if (error) {
    console.error("Error inserting ai_analysis:", error);
  } else {
    console.log("Injected AI analysis successfully!");
  }
}

inject().catch(console.error);
