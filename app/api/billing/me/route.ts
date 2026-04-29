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

    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({
        status: "inactive",
        botType: "MONEY_PRINT_ORB",
        priceMonthlyUsd: 499,
        currentPeriodEnd: null,
      });
    }

    const subscription = subscriptions.data[0];

    return NextResponse.json({
      status: "active",
      botType: "MONEY_PRINT_ORB",
      priceMonthlyUsd: 499,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}