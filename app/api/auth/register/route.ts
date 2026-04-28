import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase-client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const fullName = String(body.fullName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();

  if (!fullName || !email || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Create user in Supabase Auth (email_confirm: true skips email verification)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { full_name: fullName },
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message || "Failed to create account" },
      { status: 400 }
    );
  }

  // Insert profile row
  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    email,
    role: "user",
    active: false,
  });

  if (profileError) {
    // Rollback auth user if profile creation fails
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Sign in to get a real session token
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

  return NextResponse.json({
    token: sessionData.session.access_token,
    user: {
      id: authData.user.id,
      fullName,
      email,
      isAdmin: false,
    },
  });
}