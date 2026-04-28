import { NextRequest, NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabase-client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session || !data.user) {
    return NextResponse.json(
      { error: error?.message || "Invalid login" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    token: data.session.access_token,
    user: {
      id: data.user.id,
      email: data.user.email,
      fullName: data.user.user_metadata?.full_name || "User",
    },
  });
}