import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      return NextResponse.json({
        status: "inactive",
        botType: "MONEY_PRINT_ORB",
        priceMonthlyUsd: 499,
        currentPeriodEnd: null,
      });
    }

    const customer = customers.data[0];

    const [activeSubs, trialingSubs] = await Promise.all([
      stripe.subscriptions.list({ customer: customer.id, status: "active", limit: 1 }),
      stripe.subscriptions.list({ customer: customer.id, status: "trialing", limit: 1 }),
    ]);

    const subscription = activeSubs.data[0] || trialingSubs.data[0];

    if (!subscription) {
      return NextResponse.json({
        status: "inactive",
        botType: "MONEY_PRINT_ORB",
        priceMonthlyUsd: 499,
        currentPeriodEnd: null,
      });
    }

    return NextResponse.json({
      status: subscription.status === "trialing" ? "Trial active" : "active",
      botType: "MONEY_PRINT_ORB",
      priceMonthlyUsd: 499,
      currentPeriodEnd: null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown error", status: "error" }, { status: 200 });
  }
}