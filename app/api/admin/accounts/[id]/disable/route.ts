import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, context: any) {
  const { id } = await context.params;

  return NextResponse.json({
    success: true,
    message: `Disabled account ${id}`,
  });
}
