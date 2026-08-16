import "server-only";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

const BUNDLE_MESSAGE_COUNT = 200;
const BUNDLE_AMOUNT_CENTS = 500;

// Premium-only: once a landlord is over their 1000-message base cap (plus
// any bundles already purchased this month), they can buy 200 more for
// $5 rather than being blocked outright. This is the app's first one-time
// (non-subscription) Stripe charge — createCheckoutSession in
// app/(landlord)/billing/actions.ts only ever does mode: "subscription".
export async function createMessageBundleCheckoutSession(
  landlordId: string,
  email?: string
): Promise<{ url: string }> {
  if (!stripe) throw new Error("Stripe isn't configured yet.");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: landlordId,
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: BUNDLE_AMOUNT_CENTS,
          product_data: { name: "200 extra chat messages (this billing month)" },
        },
        quantity: 1,
      },
    ],
    metadata: {
      landlord_id: landlordId,
      kind: "message_bundle",
      bundle_message_count: String(BUNDLE_MESSAGE_COUNT),
    },
    success_url: `${appUrl}/settings?bundle=success`,
    cancel_url: `${appUrl}/settings`,
  });

  if (!session.url) throw new Error("Couldn't start checkout — try again.");
  return { url: session.url };
}

// Webhook-side handler for a completed bundle purchase. Idempotent via the
// unique constraint on message_bundle_purchases.stripe_checkout_session_id
// — a replayed checkout.session.completed event fails that insert, and the
// credit only lands on a successful (non-conflicting) insert, never
// unconditionally.
export async function handleMessageBundlePurchase(session: Stripe.Checkout.Session) {
  const landlordId = session.metadata?.landlord_id;
  const messageCount = Number(session.metadata?.bundle_message_count ?? BUNDLE_MESSAGE_COUNT);
  if (!landlordId) return;

  const admin = createAdminClient();
  const periodMonth = new Date();
  periodMonth.setUTCDate(1);
  const periodMonthStr = periodMonth.toISOString().slice(0, 10);

  const { error: insertError } = await admin.from("message_bundle_purchases").insert({
    landlord_id: landlordId,
    period_month: periodMonthStr,
    stripe_checkout_session_id: session.id,
    message_count: messageCount,
    amount_cents: session.amount_total ?? BUNDLE_AMOUNT_CENTS,
  });

  // Unique-constraint violation means this session was already credited —
  // do not double-credit on a replayed webhook delivery.
  if (insertError) return;

  const { data: existing } = await admin
    .from("message_usage")
    .select("bundle_messages_purchased")
    .eq("landlord_id", landlordId)
    .eq("period_month", periodMonthStr)
    .single();

  await admin
    .from("message_usage")
    .upsert(
      {
        landlord_id: landlordId,
        period_month: periodMonthStr,
        bundle_messages_purchased: (existing?.bundle_messages_purchased ?? 0) + messageCount,
      },
      { onConflict: "landlord_id,period_month" }
    );
}
