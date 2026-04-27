import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    // 🔐 Enforce admin access
    await requireAdmin(req);

    // 📥 Read query param
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    // 🧠 Base query
    let query = supabaseAdmin
      .from("tradeify_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    // 🎯 Apply filter if not "all"
    if (status && status !== "all") {
      query = query.eq("approval_status", status);
    }

    // 🚀 Execute query
    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // ✅ Return accounts
    return NextResponse.json(data || []);
  } catch (err: any) {
    // 🔒 Handles unauthorized / forbidden
    return NextResponse.json(
      { error: err?.message || "Forbidden" },
      { status: 403 }
    );
  }
}