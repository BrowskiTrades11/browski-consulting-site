import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateAccountStatus } from "@/lib/mock-db";

function createMockLicenseKey() {
  const segment = () => Math.random().toString(16).slice(2, 6).toUpperCase();
  return `BC-${segment()}-${segment()}-${segment()}`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const notes = String(body.notes || "").trim();
    const updated = updateAccountStatus(params.id, "approved", notes, createMockLicenseKey());

    if (!updated) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, account: updated, licenseKey: updated.licenseKey });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}