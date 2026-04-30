import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendAdminEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const propAccountId = String(body.propAccountId || "").trim();

    if (!propAccountId) {
      return NextResponse.json({ error: "Tradeify account ID is required" }, { status: 400 });
    }

    const email = String(user.email || "").toLowerCase();

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ prop_account_id: propAccountId })
      .ilike("email", email)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await sendAdminEmail(
      "Tradeify ID submitted — approval needed",
      `<p><strong>${email}</strong> submitted Tradeify ID: <strong>${propAccountId}</strong></p><p>Log in to the admin panel to approve or reject their account.</p>`
    );

    return NextResponse.json({
      account: {
        propAccountId: data.prop_account_id,
        approvalStatus: data.active ? "approved" : "pending",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
