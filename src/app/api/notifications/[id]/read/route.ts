import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You need to be signed in to do that." }, { status: 401 });
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "We couldn't update that notification." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
