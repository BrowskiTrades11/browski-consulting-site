import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const REFERRAL_COUPON_ID = "REFER25";

async function ensureReferralCoupon() {
  try {
    await stripe.coupons.retrieve(REFERRAL_COUPON_ID);
  } catch {
    await stripe.coupons.create({
      id: REFERRAL_COUPON_ID,
      percent_off: 25,
      duration: "once",
      name: "Referral — 25% off first month",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const plan: "monthly" | "annual" = body.plan === "annual" ? "annual" : "monthly";

    const monthlyPriceId = process.env.STRIPE_MONEY_PRINT_ORB_PRICE_ID;
    const annualPriceId = process.env.STRIPE_MONEY_PRINT_ORB_ANNUAL_PRICE_ID;

    if (!monthlyPriceId) {
      return NextResponse.json({ error: "Missing STRIPE_MONEY_PRINT_ORB_PRICE_ID" }, { status: 500 });
    }
    if (plan === "annual" && !annualPriceId) {
      return NextResponse.json({ error: "Missing STRIPE_MONEY_PRINT_ORB_ANNUAL_PRICE_ID" }, { status: 500 });
    }

    if (!process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_APP_URL" }, { status: 500 });
    }

    const priceId = plan === "annual" ? annualPriceId! : monthlyPriceId;

    // Check if this user was referred — if so, apply the 25% off first month coupon
    const email = String(user.email || "").toLowerCase();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("referred_by")
      .ilike("email", email)
      .maybeSingle();

    const wasReferred = !!profile?.referred_by;
    const discounts: { coupon: string }[] = [];

    if (wasReferred) {
      await ensureReferralCoupon();
      discounts.push({ coupon: REFERRAL_COUPON_ID });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      // Only allow promo codes if the user wasn't already given a referral discount
      allow_promotion_codes: !wasReferred,
      subscription_data: {
        ...(plan === "monthly" ? { trial_period_days: 15 } : {}),
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      ...(discounts.length > 0 ? { discounts } : {}),
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?checkout=success&go=dashboard`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?checkout=canceled`,
      metadata: {
        userId: user.id,
        botType: "MONEY_PRINT_ORB",
        plan,
        referredBy: profile?.referred_by || "",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
