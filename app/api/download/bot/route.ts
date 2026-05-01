import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);

    // Check active Stripe subscription
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      return NextResponse.json({ error: "No active subscription" }, { status: 403 });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customers.data[0].id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({ error: "No active subscription" }, { status: 403 });
    }

    // Generate a short-lived signed URL (60 seconds)
    const { data, error } = await supabaseAdmin.storage
      .from("Downloads")
      .createSignedUrl("MONEYPRINTORB.zip", 60);

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: `File not available: ${error?.message || "no signed URL returned"}` }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 401 });
  }
}
