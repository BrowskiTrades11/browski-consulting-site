import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const email = String(user.email || "").toLowerCase();

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ cancellation_requested: true })
      .ilike("email", email);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
