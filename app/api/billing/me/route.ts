import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSubscriptionForUser } from "@/lib/mock-db";

export async function GET(req: NextRequest) {
  try {
    const user = requireUser(req);
    const subscription = getSubscriptionForUser(user.id);

    if (!subscription) {
      return NextResponse.json({
        status: "inactive",
        botType: "MONEY_PRINT_ORB",
        priceMonthlyUsd: 499,
        currentPeriodEnd: null,
      });
    }

    return NextResponse.json(subscription);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}