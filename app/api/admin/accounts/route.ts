import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (status === "pending") {
      query = query.eq("active", false);
    } else if (status === "approved") {
      query = query.eq("active", true);
    }
    // status === "all" or anything else returns everything

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Forbidden" },
      { status: 403 }
    );
  }
}