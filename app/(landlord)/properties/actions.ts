"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendInviteMessageEmail } from "@/lib/email/resend";
import { requireActiveSubscription } from "@/lib/billing/guard";
import { syncPlanForUnitCount } from "@/lib/billing/syncPlan";
import { checkUnitLimit, applyConfirmedUpgrade, type UnitLimitResult } from "@/lib/billing/unitLimit";
import { inviteLimiter } from "@/lib/rateLimit";
import { firstNameOf } from "@/lib/inviteMessage";

// Read by UpgradeCelebrationModal in the landlord layout on the very next
// render, then left to expire on its own (Server Components can't clear a
// cookie mid-render, so a short maxAge is what makes this a one-time flash
// rather than something that keeps popping up on refresh). Set right after
// a confirmed tier upgrade actually goes through — not just from crossing a
// unit-count threshold — since growing past the current tier now always
// requires the landlord to explicitly confirm the upgrade first (see
// unitLimit.ts); this is a genuine "you just upgraded" celebration, not a
// suggestion for something that already silently happened.
const CELEBRATION_COOKIE = "celebrate_unit_upgrade";

async function flagCelebration() {
  (await cookies()).set(CELEBRATION_COOKIE, "1", { maxAge: 15, path: "/" });
}

// Both createProperty and createUnit funnel through this before inserting:
// checkUnitLimit tells us whether the new unit(s) fit the landlord's
// current plan, need an upgrade the landlord must confirm first (returned
// to the client, nothing inserted yet), or are outright blocked (11th unit
// on the top tier). `confirmed` is only trusted as permission to proceed —
// the target tier/cost is always recomputed server-side, never taken from
// the client.
async function resolveUnitLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  addingCount: number,
  confirmed: boolean
): Promise<UnitLimitResult | null> {
  const check = await checkUnitLimit(supabase, userId, addingCount);
  if (check.status === "blocked") return check;
  if (check.status === "needs_upgrade") {
    if (!confirmed) return check;
    await applyConfirmedUpgrade(userId, check.targetTier);
    await flagCelebration();
  }
  return null; // clear to proceed with the insert
}

export async function createProperty(formData: FormData): Promise<UnitLimitResult | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireActiveSubscription(user.id);

  const address_line1 = (formData.get("address_line1") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const state = (formData.get("state") as string)?.trim() || null;
  const postal_code = (formData.get("postal_code") as string)?.trim() || null;
  const unitLabel = (formData.get("unit_label") as string)?.trim() || null;
  const confirmed = formData.get("confirmed") === "1";

  if (!address_line1) throw new Error("Street address is required");
  if (!city) throw new Error("City is required");
  if (!state) throw new Error("State is required");
  if (!postal_code) throw new Error("ZIP code is required");
  // properties.name is a required column with no dedicated form field
  // anymore (the street address is the only identifying label a landlord
  // enters now) — derive it from address_line1 so it stays populated.
  const name = address_line1;

  const blocked = await resolveUnitLimit(supabase, user.id, unitLabel ? 1 : 0, confirmed);
  if (blocked) return blocked;

  const { data, error } = await supabase
    .from("properties")
    .insert({ landlord_id: user.id, name, address_line1, city, state, postal_code })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (unitLabel) {
    const { error: unitError } = await supabase
      .from("units")
      .insert({ property_id: data.id, label: unitLabel });
    if (unitError) throw new Error(unitError.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/manage-properties");
  redirect(`/properties/${data.id}`);
}

export async function updateProperty(propertyId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireActiveSubscription(user.id);

  const address_line1 = (formData.get("address_line1") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const state = (formData.get("state") as string)?.trim() || null;
  const postal_code = (formData.get("postal_code") as string)?.trim() || null;

  const { error } = await supabase
    .from("properties")
    .update({ address_line1, city, state, postal_code })
    .eq("id", propertyId)
    .eq("landlord_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/manage-properties");
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/properties/${propertyId}/edit`);
  redirect("/manage-properties");
}

export async function createUnit(
  propertyId: string,
  formData: FormData
): Promise<UnitLimitResult | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireActiveSubscription(user.id);

  const label = (formData.get("label") as string)?.trim();
  if (!label) throw new Error("Unit label is required");
  const confirmed = formData.get("confirmed") === "1";

  const blocked = await resolveUnitLimit(supabase, user.id, 1, confirmed);
  if (blocked) return blocked;

  const { error } = await supabase.from("units").insert({ property_id: propertyId, label });
  if (error) throw new Error(error.message);

  revalidatePath(`/properties/${propertyId}`);
}

// Creates the invite row only — does NOT send anything. The email is a
// separate, explicit step (sendInviteMessage below) so the landlord can see
// and confirm the pre-filled message before it goes out, rather than an
// email firing the instant the form is submitted.
export async function createInvite(propertyId: string, unitId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireActiveSubscription(user.id);

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const tenantName = (formData.get("name") as string)?.trim();
  if (!email) throw new Error("Email is required");
  if (!tenantName) throw new Error("Tenant name is required");

  // Revoke any existing pending invite for this unit+email so the partial
  // unique index (unit_id, lower(email)) where status='pending' doesn't
  // reject the new insert.
  await supabase
    .from("tenant_invites")
    .update({ status: "revoked" })
    .eq("unit_id", unitId)
    .eq("email", email)
    .eq("status", "pending");

  const token = randomBytes(32).toString("base64url");

  const { data: invite, error } = await supabase
    .from("tenant_invites")
    .insert({ unit_id: unitId, invited_by: user.id, email, token, tenant_name: tenantName })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/properties/${propertyId}/units/${unitId}`);

  return {
    inviteId: invite.id,
    inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`,
    firstName: firstNameOf(tenantName),
  };
}

// The explicit "Send" step — landlord confirms the pre-filled message
// before this fires a real email.
export async function sendInviteMessage(propertyId: string, unitId: string, inviteId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireActiveSubscription(user.id);

  const { success } = await inviteLimiter.limit(user.id);
  if (!success) throw new Error("Too many invites sent recently — try again in a bit.");

  const { data: invite, error } = await supabase
    .from("tenant_invites")
    .select("email, token, tenant_name")
    .eq("id", inviteId)
    .single();
  if (error || !invite) throw new Error("Invite not found");

  await sendInviteMessageEmail({
    to: invite.email,
    firstName: firstNameOf(invite.tenant_name || "there"),
    inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invite.token}`,
  });

  revalidatePath(`/properties/${propertyId}/units/${unitId}`);
}

export async function deleteProperty(propertyId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireActiveSubscription(user.id);

  const { error } = await supabase.rpc("delete_property", { p_property_id: propertyId });
  if (error) throw new Error(error.message);

  try {
    await syncPlanForUnitCount(user.id);
  } catch (err) {
    console.error(`[billing] Failed to sync plan for landlord ${user.id}:`, err);
  }

  revalidatePath("/manage-properties");
  revalidatePath("/dashboard");
}

export async function removeTenant(tenantUnitId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireActiveSubscription(user.id);

  const { error } = await supabase.rpc("remove_tenant_from_unit", {
    p_tenant_unit_id: tenantUnitId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/manage-properties");
  revalidatePath("/dashboard");
}
