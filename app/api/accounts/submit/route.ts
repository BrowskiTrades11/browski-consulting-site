import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const user = requireUser(req);
    const body = await req.json();
    const propAccountId = String(body.propAccountId || "").trim();

    if (!propAccountId) {
      return NextResponse.json({ error: "Tradeify account ID is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("tradeify_accounts")
      .insert({
  user_id: user.id,
  email: user.email || null,
  full_name: user.fullName || user.name || null,
  prop_account_id: propAccountId,
  approval_status: "pending",
  license_key: null,
  notes: "",
})
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      account: {
        id: data.id,
        propAccountId: data.prop_account_id,
        approvalStatus: data.approval_status,
        licenseKey: data.license_key,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
