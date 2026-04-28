import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export function getBearerToken(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export async function requireUser(req: NextRequest) {
  const token = getBearerToken(req);

  if (!token) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Unauthorized");
  }

  return data.user;
}

export async function requireAdmin(req: NextRequest) {
  const user = await requireUser(req);
  const email = String(user.email || "").trim().toLowerCase();

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("email")
    .ilike("email", email)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Forbidden");
  }

  return user;
}