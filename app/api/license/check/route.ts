import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tradeifyId } = body;

    if (!tradeifyId || typeof tradeifyId !== "string") {
      return NextResponse.json(
        { valid: false, reason: "Missing Tradeify ID" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("active")
      .ilike("prop_account_id", tradeifyId.trim())
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ valid: false, reason: "License not found" });
    }

    if (!data.active) {
      return NextResponse.json({ valid: false, reason: "License disabled" });
    }

    return NextResponse.json({ valid: true, reason: "License active" });
  } catch {
    return NextResponse.json(
      { valid: false, reason: "Server error" },
      { status: 500 }
    );
  }
}
