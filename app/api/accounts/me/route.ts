import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const email = String(user.email || "").toLowerCase();

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, cancellation_requested")
      .ilike("email", email)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ accounts: [] });
    }

    const { data: accounts, error } = await supabaseAdmin
      .from("prop_accounts")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      accounts: (accounts || []).map((acct: any) => ({
        id: acct.id,
        propAccountId: acct.prop_account_id,
        approvalStatus: acct.active ? "approved" : "pending",
        licenseKey: acct.active ? acct.prop_account_id : null,
        cancellationRequested: profile.cancellation_requested || false,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}