import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { submitAccount } from "@/lib/mock-db";

export async function POST(req: NextRequest) {
  try {
    const user = requireUser(req);
    const body = await req.json();
    const propAccountId = String(body.propAccountId || "").trim();

    if (!propAccountId) {
      return NextResponse.json({ error: "propAccountId is required" }, { status: 400 });
    }

    const account = submitAccount(user, propAccountId);
    return NextResponse.json({ account });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}