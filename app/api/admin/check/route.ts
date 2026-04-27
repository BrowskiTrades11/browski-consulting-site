import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);

    const { data } = await supabaseAdmin
      .from("admin_users")
      .select("email")
      .eq("email", user.email)
      .single();

   return NextResponse.json({
  isAdmin: Boolean(data)
});
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}