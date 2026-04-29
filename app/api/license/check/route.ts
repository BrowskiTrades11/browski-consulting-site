import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";

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

    // Check Supabase: account exists and is approved
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("active, email")
      .ilike("prop_account_id", tradeifyId.trim())
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ valid: false, reason: "License not found" });
    }

    if (!data.active) {
      return NextResponse.json({ valid: false, reason: "License disabled" });
    }

    // Check Stripe: must have an active subscription
    const customers = await stripe.customers.list({ email: data.email, limit: 1 });

    if (customers.data.length === 0) {
      return NextResponse.json({ valid: false, reason: "No active subscription" });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customers.data[0].id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({ valid: false, reason: "Subscription inactive or cancelled" });
    }

    return NextResponse.json({ valid: true, reason: "License active" });
  } catch {
    return NextResponse.json(
      { valid: false, reason: "Server error" },
      { status: 500 }
    );
  }
}
