import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);

    if (!process.env.STRIPE_MONEY_PRINT_ORB_PRICE_ID) {
      return NextResponse.json({ error: "Missing STRIPE_MONEY_PRINT_ORB_PRICE_ID" }, { status: 500 });
    }

    if (!process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_APP_URL" }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          price: process.env.STRIPE_MONEY_PRINT_ORB_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?checkout=success&go=dashboard`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?checkout=canceled`,
      metadata: {
        userId: user.id,
        botType: "MONEY_PRINT_ORB",
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
