import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    console.log("REJECT HIT:", id);

    if (!id) {
      return NextResponse.json({ error: "Missing account id" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("tradeify_accounts")
      .update({
        approval_status: "rejected",
        notes: body.notes || "",
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("REJECT ERROR:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("REJECT SUCCESS:", data.id);

    return NextResponse.json({
      success: true,
      account: data,
    });
  } catch (error: any) {
    console.error("REJECT FAILED:", error?.message || error);
    return NextResponse.json({ error: "Reject failed" }, { status: 500 });
  }
}