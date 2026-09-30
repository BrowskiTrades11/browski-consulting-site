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
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Monthly offer: the Checkout Session is a real $49 payment, not a free trial.
      // Once paid, create the $199/month subscription with its first invoice exactly
      // 7 days later. The trial is only an internal billing delay; customers have
      // already paid $49 for access during these seven days.
      if (session.mode === "payment" && session.metadata?.plan === "monthly" && session.customer) {
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer.id;

        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;

        if (paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          const paymentMethodId =
            typeof paymentIntent.payment_method === "string"
              ? paymentIntent.payment_method
              : paymentIntent.payment_method?.id;

          if (paymentMethodId) {
            const existing = await stripe.subscriptions.list({
              customer: customerId,
              status: "all",
              limit: 20,
            });
            const alreadyCreated = existing.data.some(
              (sub) => sub.metadata?.introCheckoutSessionId === session.id
            );

            if (!alreadyCreated) {
              await stripe.subscriptions.create({
                customer: customerId,
                items: [{ price: "price_1ULSS71r1QnMfR7T0VZ3IGLH" }],
                default_payment_method: paymentMethodId,
                trial_end: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
                trial_settings: {
                  end_behavior: { missing_payment_method: "cancel" },
                },
                metadata: {
                  plan: "monthly",
                  introCheckoutSessionId: session.id,
                  paidIntro: "49",
                },
              });
            }
          }
        }
      }
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;

      // Process the first real payment — subscription_create fires for $0 trial invoice,
      // subscription_cycle fires for the first actual charge after trial ends
      if (
        (invoice.billing_reason === "subscription_create" || invoice.billing_reason === "subscription_cycle") &&
        invoice.customer_email &&
        invoice.amount_paid > 0
      ) {
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
                // Apply a 25% credit based on the current $199 monthly renewal price.
                const creditAmount = Math.round(199 * 0.25 * 100); // in cents
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
