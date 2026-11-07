import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

/**
 * Supabase client for use in Client Components.
 * Only ever uses the public anon key — safe to bundle into the browser.
 * Row Level Security is what actually protects the data; this key alone
 * grants no special access.
 */
export function createClient() {
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
