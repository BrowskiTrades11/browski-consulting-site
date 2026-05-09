import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

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

    let referralCode = data?.referral_code || null;

    // Auto-generate a code for existing users who don't have one yet
    if (!referralCode) {
      referralCode = generateReferralCode();
      await supabaseAdmin
        .from("profiles")
        .update({ referral_code: referralCode })
        .ilike("email", email);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const referralLink = `${appUrl}/?ref=${referralCode}`;

    return NextResponse.json({
      referralCode,
      referralLink,
      wasReferred: !!data?.referred_by,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
