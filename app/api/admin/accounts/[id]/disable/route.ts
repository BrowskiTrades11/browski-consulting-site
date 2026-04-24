import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  return NextResponse.json({
    success: true,
    message: `Disabled account ${id}`
  });
}
