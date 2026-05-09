import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendAdminEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const propAccountId = String(body.propAccountId || "").trim();
    const name = String(body.name || "").trim();

    if (!propAccountId) {
      return NextResponse.json({ error: "Tradeify account ID is required" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const email = String(user.email || "").toLowerCase();

    // Get the user's profile id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Prevent duplicate submissions of the same ID
    const { data: existing } = await supabaseAdmin
      .from("prop_accounts")
      .select("id")
      .eq("user_id", profile.id)
      .ilike("prop_account_id", propAccountId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "This Tradeify account ID has already been submitted" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("prop_accounts")
      .insert({ user_id: profile.id, prop_account_id: propAccountId, name, active: false })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await sendAdminEmail(
      "Tradeify ID submitted — approval needed",
      `<p><strong>${name}</strong> (${email}) submitted Tradeify ID: <strong>${propAccountId}</strong></p><p>Log in to the admin panel to approve or reject their account.</p>`
    );

    return NextResponse.json({
      account: {
        id: data.id,
        propAccountId: data.prop_account_id,
        approvalStatus: "pending",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
