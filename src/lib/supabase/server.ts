import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 * Runs with the signed-in user's session (via cookies), so RLS applies exactly
 * as it would for that user in the browser — this is NOT a service-role client.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component that can't set cookies directly;
            // middleware.ts handles session refresh in that case.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // See note above.
          }
        }
      }
    }
  );
}

/**
 * Service-role client. SUPABASE_SERVICE_ROLE_KEY bypasses Row Level Security,
 * so this must only ever be constructed inside trusted server-side code
 * (route handlers, background jobs) and NEVER imported into anything that
 * ships to the browser or the extension.
 */
export function createServiceRoleClient() {
  if (typeof window !== "undefined") {
    throw new Error("createServiceRoleClient must never be called from the browser.");
  }

  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get() {
          return undefined;
        },
        set() {},
        remove() {}
      }
    }
  );
}
