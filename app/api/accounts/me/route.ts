import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const email = String(user.email || "").toLowerCase();

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || !data.prop_account_id) {
      return NextResponse.json({ accounts: [] });
    }

    return NextResponse.json({
      accounts: [{
        propAccountId: data.prop_account_id,
        approvalStatus: data.active ? "approved" : "pending",
      }],
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}