import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { handleStripeEvent } from "@/lib/billing/webhookHandlers";

// Stripe's signature is the auth here — there's no Supabase session
// involved at all, which is why this lives under /api/* (already excluded
// from proxy.ts's login-redirect check).
export async function POST(req: Request) {
  if (!stripe) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 500 });
  }

  // Read the raw body exactly once — App Router route handlers have no
  // global body-parser to fight (unlike the old Pages API), but calling
  // req.json() first and reconstructing the string via JSON.stringify
  // would still break signature verification, since it won't reproduce
  // Stripe's exact byte formatting.
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing stripe-signature header" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  await handleStripeEvent(event);
  return NextResponse.json({ received: true });
}
