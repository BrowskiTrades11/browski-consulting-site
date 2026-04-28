import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .ilike("email", user.email ?? "")
      .maybeSingle();

    return NextResponse.json({
      isAdmin: !error && data?.role === "admin",
    });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}