// Update these for your deployment. The extension never receives the
// Supabase service-role key — only the public URL/anon key pair, the same
// ones baked into NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
// for the web app.
export const CONFIG = {
  SUPABASE_URL: "https://wkjrmpkpndujhrishkql.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndranJtcGtwbmR1amhyaXNoa3FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyOTYyNzYsImV4cCI6MjEwNjg3MjI3Nn0.DKCIAwLHKYLeDlS-wGPLNfTbfhAq0H_WBQ1mhGqOEoE",
  API_BASE_URL: "http://localhost:3000/api",
  DASHBOARD_URL: "http://localhost:3000/dashboard",
  // Domains categorized as social media for the wellbeing analysis. Extend
  // as needed — anything not listed here defaults to "other".
  CATEGORY_MAP: {
    "facebook.com": "social_media",
    "instagram.com": "social_media",
    "twitter.com": "social_media",
    "x.com": "social_media",
    "tiktok.com": "social_media",
    "reddit.com": "social_media",
    "linkedin.com": "social_media",
    "youtube.com": "entertainment",
    "netflix.com": "entertainment",
    "twitch.tv": "entertainment",
    "github.com": "productivity",
    "notion.so": "productivity",
    "docs.google.com": "productivity",
    "gmail.com": "communication",
    "mail.google.com": "communication",
    "slack.com": "communication",
    "discord.com": "communication",
    "coursera.org": "education",
    "khanacademy.org": "education",
    "store.steampowered.com": "gaming"
  },
  LATE_NIGHT_START_HOUR: 23,
  LATE_NIGHT_END_HOUR: 5,
  SYNC_INTERVAL_MINUTES: 15
};
