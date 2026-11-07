import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  full_name: z.string().max(200).nullable().optional(),
  timezone: z.string().min(1).max(100).optional()
});

export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You need to be signed in to do that." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Those profile details couldn't be saved." }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update(parsed.data).eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "We couldn't update your profile. Try again in a moment." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
