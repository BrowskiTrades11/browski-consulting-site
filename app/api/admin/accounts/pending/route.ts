import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("active", false)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ accounts: data });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}