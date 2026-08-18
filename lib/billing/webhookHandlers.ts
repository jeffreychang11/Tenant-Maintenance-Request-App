import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { tierAndIntervalForPriceId } from "@/lib/stripe/plans";
import { syncPlanForUnitCount } from "@/lib/billing/syncPlan";
import { handleMessageBundlePurchase } from "@/lib/billing/messageBundle";

function periodEndOf(sub: Stripe.Subscription): string | null {
  const item = sub.items.data[0];
  return item ? new Date(item.current_period_end * 1000).toISOString() : null;
}

async function upsertFromStripeSubscription(landlordId: string, sub: Stripe.Subscription) {
  const admin = createAdminClient();
  const priceId = sub.items.data[0]?.price.id;
  const plan = priceId ? tierAndIntervalForPriceId(priceId) : null;

  await admin
    .from("subscriptions")
    .update({
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId ?? null,
      tier: plan?.tier ?? null,
      billing_interval: plan?.interval ?? null,
      status: sub.status,
      current_period_end: periodEndOf(sub),
      cancel_at_period_end: sub.cancel_at_period_end,
    })
    .eq("landlord_id", landlordId);
}

async function syncFromSubscriptionId(subscriptionId: string) {
  if (!stripe) return;
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("subscriptions")
    .select("landlord_id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();
  if (!existing) return; // not one of ours (or checkout.session.completed hasn't landed yet)

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  await upsertFromStripeSubscription(existing.landlord_id, sub);
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.mode === "payment" && session.metadata?.kind === "message_bundle") {
    return handleMessageBundlePurchase(session);
  }
  if (session.mode !== "subscription" || !session.subscription) return;
  const landlordId = session.client_reference_id;
  if (!landlordId || !stripe) return;

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription.id;
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  await upsertFromStripeSubscription(landlordId, sub);
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("subscriptions")
    .select("landlord_id")
    .eq("stripe_subscription_id", sub.id)
    .single();
  if (!existing) return;
  await upsertFromStripeSubscription(existing.landlord_id, sub);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const admin = createAdminClient();
  await admin
    .from("subscriptions")
    // cancel_at_period_end is meaningless once the subscription has
    // actually ended — reset it so a stale `true` can't be mistaken for a
    // still-cancelable subscription (see hasOngoingSubscription in
    // app/(landlord)/billing/page.tsx, which also guards against this).
    .update({ status: "canceled", cancel_at_period_end: false })
    .eq("stripe_subscription_id", sub.id);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subRef = invoice.parent?.subscription_details?.subscription;
  if (!subRef) return;
  const subscriptionId = typeof subRef === "string" ? subRef : subRef.id;
  await syncFromSubscriptionId(subscriptionId);

  // Real renewal (not the first purchase) of an annual plan: re-evaluate
  // the tier prospectively, without touching the invoice that was just
  // paid at the old price.
  if (invoice.billing_reason === "subscription_cycle") {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("subscriptions")
      .select("landlord_id, billing_interval")
      .eq("stripe_subscription_id", subscriptionId)
      .single();
    if (existing?.billing_interval === "year") {
      await syncPlanForUnitCount(existing.landlord_id, {
        allowAnnual: true,
        prorationBehavior: "none",
      });
    }
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subRef = invoice.parent?.subscription_details?.subscription;
  if (!subRef) return;
  const subscriptionId = typeof subRef === "string" ? subRef : subRef.id;
  await syncFromSubscriptionId(subscriptionId);
}

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutSessionCompleted(event.data.object);
    case "customer.subscription.updated":
      return handleSubscriptionUpdated(event.data.object);
    case "customer.subscription.deleted":
      return handleSubscriptionDeleted(event.data.object);
    case "invoice.payment_succeeded":
      return handleInvoicePaid(event.data.object);
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event.data.object);
    default:
      return;
  }
}
