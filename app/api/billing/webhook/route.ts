import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing webhook configuration" }, { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${error.message}` }, { status: 400 });
  }

  try {
    // Subscription state is read live from Stripe — no local DB action needed here.
    // Add additional event handling below as required (e.g. customer.subscription.deleted).

    return NextResponse.json({ received: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Webhook processing failed" }, { status: 500 });
  }
}