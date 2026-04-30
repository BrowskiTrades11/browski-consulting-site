import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase-client";
import { sendAdminEmail } from "@/lib/email";
import { sendAdminEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();

  if (!email || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Create user in Supabase Auth (email_confirm: true skips email verification)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message || "Failed to create account" },
      { status: 400 }
    );
  }

  // Sign in to get a real session token
  // (Supabase trigger automatically creates the profiles row)
  const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (sessionError || !sessionData.session) {
    return NextResponse.json(
      { error: "Account created but sign-in failed. Please log in manually." },
      { status: 500 }
    );
  }

  await sendAdminEmail(
    "New member registered",
    `<p><strong>${email}</strong> just created an account.</p><p>They will need to subscribe and submit their Tradeify ID before you can approve them.</p>`
  );

  return NextResponse.json({
    token: sessionData.session.access_token,
    user: {
      id: authData.user.id,
      email,
      isAdmin: false,
    },
  });
}