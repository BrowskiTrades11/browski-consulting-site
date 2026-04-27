import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function generateLicenseKey() {
  const part = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BC-${part()}-${part()}-${part()}`;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    console.log("APPROVE HIT:", id);

    if (!id) {
      return NextResponse.json({ error: "Missing account id" }, { status: 400 });
    }

    const licenseKey = generateLicenseKey();

    const { data, error } = await supabaseAdmin
      .from("tradeify_accounts")
      .update({
        approval_status: "approved",
        license_key: licenseKey,
        notes: body.notes || "",
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("APPROVE ERROR:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("APPROVE SUCCESS:", data.id);

    return NextResponse.json({
      success: true,
      account: data,
    });
  } catch (error: any) {
    console.error("APPROVE FAILED:", error?.message || error);
    return NextResponse.json({ error: "Approval failed" }, { status: 500 });
  }
}