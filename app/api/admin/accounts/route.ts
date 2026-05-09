import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = supabaseAdmin
      .from("prop_accounts")
      .select("*, profiles(email, cancellation_requested)")
      .order("created_at", { ascending: false });

    if (status === "pending") {
      query = query.eq("active", false);
    } else if (status === "approved") {
      query = query.eq("active", true);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const accounts = (data || []).map((acct: any) => ({
      id: acct.id,
      prop_account_id: acct.prop_account_id,
      name: acct.name || "",
      active: acct.active,
      created_at: acct.created_at,
      email: acct.profiles?.email || "Unknown",
      cancellation_requested: acct.profiles?.cancellation_requested || false,
    }));

    return NextResponse.json(accounts);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Forbidden" },
      { status: 403 }
    );
  }
}