import { NextRequest, NextResponse } from "next/server";
import { createUser, findUserByEmail } from "@/lib/mock-db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const fullName = String(body.fullName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();

  if (!fullName || !email || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (findUserByEmail(email)) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const user = createUser(fullName, email, password);

  return NextResponse.json({
    token: `mock-token-${user.email}`,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      isAdmin: user.isAdmin,
    },
  });
}