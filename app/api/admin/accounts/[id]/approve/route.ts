import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function generateLicenseKey() {
  const part = () => Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MPORB-${part()}-${part()}-${part()}`;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    const licenseKey = generateLicenseKey();

    const { data, error } = await supabaseAdmin
      .from("tradeify_accounts")
      .update({
        approval_status: "approved",
        license_key: licenseKey,
        notes: body.notes || "",
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      account: data,
    });
  } catch (error) {
    return NextResponse.json({ error: "Approval failed" }, { status: 500 });
  }
}