import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const email = String(user.email || "").toLowerCase();

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("referral_code, referred_by")
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const referralCode = data?.referral_code || null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const referralLink = referralCode ? `${appUrl}/?ref=${referralCode}` : null;

    return NextResponse.json({
      referralCode,
      referralLink,
      wasReferred: !!data?.referred_by,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
