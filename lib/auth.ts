import { NextRequest } from "next/server";
import { getUserFromToken } from "@/lib/mock-db";

export function getBearerToken(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export function requireUser(req: NextRequest) {
  const token = getBearerToken(req);
  const user = getUserFromToken(token);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export function requireAdmin(req: NextRequest) {
  const user = requireUser(req);
  if (!user.isAdmin) {
    throw new Error("Forbidden");
  }
  return user;
}