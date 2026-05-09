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

    // Check prop_accounts table
    const { data: account, error } = await supabaseAdmin
      .from("prop_accounts")
      .select("active, user_id")
      .ilike("prop_account_id", tradeifyId.trim())
      .eq("active", true)
      .maybeSingle();

    if (error || !account) {
      return NextResponse.json({ valid: false, reason: "License not found" });
    }

    if (!account.active) {
      return NextResponse.json({ valid: false, reason: "License disabled" });
    }

    // Get email from profiles
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", account.user_id)
      .maybeSingle();

    if (!profile?.email) {
      return NextResponse.json({ valid: false, reason: "User not found" });
    }

    // Check Stripe: must have an active subscription
    const customers = await stripe.customers.list({ email: profile.email, limit: 1 });

    if (customers.data.length === 0) {
      return NextResponse.json({ valid: false, reason: "No active subscription" });
    }

    const [activeSubs, trialingSubs] = await Promise.all([
      stripe.subscriptions.list({ customer: customers.data[0].id, status: "active", limit: 1 }),
      stripe.subscriptions.list({ customer: customers.data[0].id, status: "trialing", limit: 1 }),
    ]);

    if (activeSubs.data.length === 0 && trialingSubs.data.length === 0) {
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
