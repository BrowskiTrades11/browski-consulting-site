import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return NextResponse.json({ valid: false, reason: "No code provided" });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .ilike("referral_code", code.trim())
    .maybeSingle();

  if (error) {
    return NextResponse.json({ valid: false, reason: "Lookup failed" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ valid: false, reason: "Code not found" });
  }

  return NextResponse.json({ valid: true });
}
