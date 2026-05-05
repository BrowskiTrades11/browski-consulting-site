import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET_REFERRAL) {
    return NextResponse.json({ error: "Missing webhook configuration" }, { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET_REFERRAL);
  } catch (error: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${error.message}` }, { status: 400 });
  }

  try {
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;

      // Only process the first invoice of a new subscription (the referred subscriber's first payment)
      if (invoice.billing_reason === "subscription_create" && invoice.customer_email) {
        const subscriberEmail = invoice.customer_email.toLowerCase();

        const { data: subscriberProfile } = await supabaseAdmin
          .from("profiles")
          .select("referred_by, referral_credit_applied")
          .ilike("email", subscriberEmail)
          .maybeSingle();

        if (
          subscriberProfile?.referred_by &&
          !subscriberProfile.referral_credit_applied
        ) {
          const referralCode = subscriberProfile.referred_by;

          // Look up the referrer
          const { data: referrerProfile } = await supabaseAdmin
            .from("profiles")
            .select("email")
            .ilike("referral_code", referralCode)
            .maybeSingle();

          if (referrerProfile?.email) {
            // Count how many successful referrals the referrer has already received credit for (cap: 4)
            const { count: creditCount } = await supabaseAdmin
              .from("profiles")
              .select("*", { count: "exact", head: true })
              .ilike("referred_by", referralCode)
              .eq("referral_credit_applied", true);

            const MAX_REFERRAL_CREDITS = 4;

            if ((creditCount ?? 0) < MAX_REFERRAL_CREDITS) {
              // Find the referrer's Stripe customer
              const customers = await stripe.customers.list({
                email: referrerProfile.email,
                limit: 1,
              });

              if (customers.data.length > 0) {
                const referrerCustomerId = customers.data[0].id;
                // Apply a 25% credit (~$124.75) to the referrer's balance for their next invoice
                const creditAmount = Math.round(499 * 0.25 * 100); // in cents
                await stripe.customers.createBalanceTransaction(referrerCustomerId, {
                  amount: -creditAmount,
                  currency: "usd",
                  description: `Referral credit — ${subscriberEmail} subscribed using your referral link (${(creditCount ?? 0) + 1}/${MAX_REFERRAL_CREDITS})`,
                });
              }
            }
          }

          // Mark credit as applied so it doesn't fire again
          await supabaseAdmin
            .from("profiles")
            .update({ referral_credit_applied: true })
            .ilike("email", subscriberEmail);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Webhook processing failed" }, { status: 500 });
  }
}
