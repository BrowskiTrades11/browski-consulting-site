import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAccountsForUser } from "@/lib/mock-db";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const accounts = getAccountsForUser(user.id);
    return NextResponse.json({ accounts });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}