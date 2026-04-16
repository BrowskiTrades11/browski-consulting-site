import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAllAccounts } from "@/lib/mock-db";

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    return NextResponse.json({ accounts: getAllAccounts() });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}