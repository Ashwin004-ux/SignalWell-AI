import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_USERS = [
  { email: "stable@test.com", password: "password123", name: "Stable User" },
  { email: "variable@test.com", password: "password123", name: "Variable User" },
  { email: "missing@test.com", password: "password123", name: "Missing Data User" }
];

async function seed() {
  console.log("Starting seed process...");
  
  for (const tu of TEST_USERS) {
    let user;
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: tu.email,
      password: tu.password,
      email_confirm: true
    });

    if (createError && (createError.message.includes("already exists") || createError.message.includes("already been registered"))) {
      console.log(`User ${tu.email} already exists.`);
      const { data: profile } = await supabase.from("profiles").select("user_id").eq("full_name", tu.name).single();
      if (profile) {
        user = { id: profile.user_id };
      }
    } else if (createError) {
      console.error("Create User Error:", createError);
    } else if (newUser?.user) {
      user = newUser.user;
    }

    if (!user) {
      console.error(`Could not create or find user ${tu.email}`);
      continue;
    }

    console.log(`User ${tu.email} ready with ID: ${user.id}`);

    await supabase.from("profiles").upsert({
      user_id: user.id,
      full_name: tu.name,
      timezone: "UTC"
    }, { onConflict: "user_id" });

    await supabase.from("user_settings").upsert({
      user_id: user.id,
      notifications_enabled: true,
      data_collection_enabled: true,
      chatbot_enabled: true,
      analytics_enabled: true,
      chatbot_can_access_activity_data: true,
      timezone: "UTC"
    }, { onConflict: "user_id" });

    const today = new Date();
    today.setUTCHours(0,0,0,0);

    const activities = [];
    const sleeps = [];
    const moods = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().split("T")[0];

      if (tu.name === "Missing Data User" && Math.random() > 0.5) {
        continue;
      }

      let screenTime = 240;
      let socialMedia = 60;
      let lateNight = 10;
      let sleepDur = 8 * 60;
      let sleepQual = 8;
      let moodScore = 8;

      if (tu.name === "Variable User") {
        const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
        if (isWeekend) {
          screenTime = 600;
          socialMedia = 300;
          lateNight = 120;
          sleepDur = 6 * 60;
          sleepQual = 5;
          moodScore = 4;
        } else {
          screenTime = 120;
          socialMedia = 30;
          lateNight = 0;
          sleepDur = 9 * 60;
          sleepQual = 9;
          moodScore = 9;
        }
      }

      activities.push({
        user_id: user.id,
        date: dateStr,
        total_screen_time_minutes: screenTime,
        active_device_minutes: screenTime,
        social_media_minutes: socialMedia,
        entertainment_minutes: 0,
        productivity_minutes: 0,
        communication_minutes: 0,
        education_minutes: 0,
        gaming_minutes: 0,
        late_night_usage_minutes: lateNight,
        notifications_count: 50,
        app_switches: 100
      });

      sleeps.push({
        user_id: user.id,
        date: dateStr,
        sleep_duration_minutes: sleepDur,
        sleep_quality: sleepQual,
        interruptions: 1
      });

      moods.push({
        user_id: user.id,
        date: dateStr,
        mood_score: moodScore,
        stress_score: 10 - moodScore,
        anxiety_score: 10 - moodScore,
        wellbeing_score: moodScore
      });
    }

    await supabase.from("daily_activity").upsert(activities, { onConflict: "user_id, date" });
    await supabase.from("sleep_records").upsert(sleeps, { onConflict: "user_id, date" });
    await supabase.from("mood_records").upsert(moods, { onConflict: "user_id, date" });

    console.log(`Inserted ${activities.length} days of data for ${tu.name}`);
  }

  console.log("Seed complete.");
}

seed().catch(console.error);
