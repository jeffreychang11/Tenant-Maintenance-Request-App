"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { stripe } from "@/lib/stripe/client";
import { priceIdFor, PLAN_LABELS, UNIT_RANGES, type Tier, type BillingInterval } from "@/lib/stripe/plans";
import { getSubscriptionForLandlord, countUnitsForLandlord } from "@/lib/billing/subscription";
import { createMessageBundleCheckoutSession } from "@/lib/billing/messageBundle";
import {
  checkMessageCapUpgrade,
  applyConfirmedMessageCapUpgrade,
  type MessageCapUpgradeResult,
} from "@/lib/billing/messageLimit";
import {
  previewYearlySwitch,
  applyYearlySwitch,
  previewDowngradeToBasic,
  applyDowngradeToBasic,
  type PlanChangePreview,
} from "@/lib/billing/planChange";
import { createClient } from "@/lib/supabase/server";

const MIN_TRIAL_END_LEAD_MS = 49 * 60 * 60 * 1000; // Stripe requires >= 48h out, or "now"

export async function createCheckoutSession(formData: FormData) {
  if (!stripe) throw new Error("Stripe isn't configured yet.");

  const { user } = await requireProfile();
  const tier = formData.get("tier") as Tier;
  const interval = (formData.get("interval") as BillingInterval) || "month";

  const priceId = priceIdFor(tier, interval);
  if (!priceId) throw new Error("That plan isn't available.");

  const supabase = await createClient();

  // A landlord can't subscribe to a tier their current unit count doesn't
  // fit — e.g. 5 units picking the 1-3 plan. Mirrors the enforcement on the
  // way up (checkUnitLimit, for adding units past a tier's ceiling) on the
  // signup side too, so the two can never disagree about which tier a
  // landlord should be on.
  const range = UNIT_RANGES[tier];
  const unitCount = await countUnitsForLandlord(supabase, user.id);
  if (unitCount > range.max) {
    throw new Error(
      `You have ${unitCount} units — that's more than the ${PLAN_LABELS[tier]} plan covers. Choose a bigger plan instead.`
    );
  }

  const sub = await getSubscriptionForLandlord(supabase, user.id);

  const trialEndMs = sub?.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : 0;
  const trialEnd =
    !sub?.stripe_subscription_id && trialEndMs - Date.now() > MIN_TRIAL_END_LEAD_MS
      ? Math.floor(trialEndMs / 1000)
      : undefined;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: user.id,
    customer: sub?.stripe_customer_id ?? undefined,
    customer_email: sub?.stripe_customer_id ? undefined : user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: trialEnd ? { trial_end: trialEnd } : undefined,
    success_url: `${appUrl}/billing?success=1`,
    cancel_url: `${appUrl}/billing`,
  });

  if (!session.url) throw new Error("Couldn't start checkout — try again.");
  redirect(session.url);
}

export async function createMessageBundleCheckout() {
  const { user } = await requireProfile();
  const { url } = await createMessageBundleCheckoutSession(user.id, user.email ?? undefined);
  redirect(url);
}

export async function previewMessageCapUpgrade(): Promise<MessageCapUpgradeResult> {
  const { user } = await requireProfile();
  return checkMessageCapUpgrade(user.id);
}

export async function confirmMessageCapUpgrade() {
  const { user } = await requireProfile();
  await applyConfirmedMessageCapUpgrade(user.id);
}

export async function previewSwitchToYearly(tier: Tier): Promise<PlanChangePreview> {
  const { user } = await requireProfile();
  return previewYearlySwitch(user.id, tier);
}

export async function confirmSwitchToYearly(tier: Tier) {
  const { user } = await requireProfile();
  await applyYearlySwitch(user.id, tier);
}

export async function previewBasicDowngrade(): Promise<PlanChangePreview> {
  const { user } = await requireProfile();
  return previewDowngradeToBasic(user.id);
}

export async function confirmBasicDowngrade() {
  const { user } = await requireProfile();
  await applyDowngradeToBasic(user.id);
}

export async function createPortalSession() {
  if (!stripe) throw new Error("Stripe isn't configured yet.");

  const { user } = await requireProfile();
  const supabase = await createClient();
  const sub = await getSubscriptionForLandlord(supabase, user.id);

  if (!sub?.stripe_customer_id) redirect("/billing");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${appUrl}/billing`,
  });

  redirect(session.url);
}
