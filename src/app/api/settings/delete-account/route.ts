import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Deletes the signed-in user's auth account. Every table with
 * `references auth.users(id) on delete cascade` in schema.sql is removed
 * automatically by Postgres — there is no separate per-table cleanup to
 * forget here. Uses the service role only for this one privileged call;
 * the user's own session is what authorizes which account gets deleted.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You need to be signed in to do that." }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json(
      { error: "We couldn't delete your account. Try again or contact support." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
