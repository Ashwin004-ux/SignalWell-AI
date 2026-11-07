import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runE2E() {
  console.log("=== SignalWell API E2E Test ===");
  
  // 1. Authentication Test
  console.log("\\n[1] Testing Authentication for stable@test.com...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "stable@test.com",
    password: "password123"
  });

  if (authError || !authData.session) {
    console.error("❌ Authentication Failed:", authError);
    process.exit(1);
  }
  console.log("✅ Authentication Successful! User ID:", authData.user.id);
  
  // 2. Dashboard Data Verification (Are insights generated?)
  console.log("\\n[2] Verifying AI Insights Generation...");
  const { data: insights, error: insightsError } = await supabase
    .from("ai_analysis")
    .select("*")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (insightsError) {
    console.error("❌ Failed to query ai_analysis:", insightsError);
  } else if (!insights || insights.length === 0) {
    console.warn("⚠️ No insights found yet. The cron job might still be running or failed.");
  } else {
    console.log("✅ AI Insights found!");
    console.log("   Risk Level:", insights[0].risk_level);
    console.log("   Summary:", insights[0].summary);
  }

  // 3. Chatbot Interaction
  console.log("\\n[3] Testing Chatbot API (/api/chat)...");
  
  try {
    const chatResponse = await fetch(`${appUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // In a real browser, the cookies handle auth, but since we are simulating an API call,
        // we pass the JWT token so the Next.js backend can authenticate the user via @supabase/ssr.
        'Authorization': `Bearer ${authData.session.access_token}`
      },
      body: JSON.stringify({
        message: "How is my sleep trending over the past week?"
      })
    });

    if (!chatResponse.ok) {
      console.error(`❌ Chat API returned ${chatResponse.status}`);
      const text = await chatResponse.text();
      console.error(text);
    } else {
      const chatData = await chatResponse.json();
      console.log("✅ Chatbot Response:");
      console.log(chatData.message);
    }
  } catch (err) {
    console.error("❌ Chat API Request Failed:", err);
  }

  console.log("\\n=== E2E Test Complete ===");
}

runE2E().catch(console.error);
