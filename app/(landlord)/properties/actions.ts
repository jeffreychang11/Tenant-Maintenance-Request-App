"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendInviteEmail } from "@/lib/email/resend";
import { requireActiveSubscription } from "@/lib/billing/guard";
import { syncPlanForUnitCount } from "@/lib/billing/syncPlan";
import { checkUnitLimit, applyConfirmedUpgrade, type UnitLimitResult } from "@/lib/billing/unitLimit";

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

  const name = (formData.get("name") as string)?.trim();
  const address_line1 = (formData.get("address_line1") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const state = (formData.get("state") as string)?.trim() || null;
  const postal_code = (formData.get("postal_code") as string)?.trim() || null;
  const unitLabel = (formData.get("unit_label") as string)?.trim() || null;
  const confirmed = formData.get("confirmed") === "1";

  if (!name) throw new Error("Property name is required");

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

export async function createInvite(propertyId: string, unitId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireActiveSubscription(user.id);

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) throw new Error("Email is required");

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

  const { error } = await supabase.from("tenant_invites").insert({
    unit_id: unitId,
    invited_by: user.id,
    email,
    token,
  });
  if (error) throw new Error(error.message);

  const [{ data: profile }, { data: unit }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase.from("units").select("label, properties(name)").eq("id", unitId).single(),
  ]);

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;
  const propertyName =
    (unit as unknown as { properties: { name: string } | null } | null)?.properties?.name ??
    "your property";

  try {
    await sendInviteEmail({
      to: email,
      inviteUrl,
      propertyName,
      unitLabel: unit?.label ?? "",
      landlordName: profile?.full_name || "Your landlord",
    });
  } catch (err) {
    // The invite row is already saved and the link is valid — a failed
    // send shouldn't fail the whole action. Log so it's visible, and the
    // landlord can still copy/share the link manually if needed.
    console.error(`[email] Failed to send invite email to ${email}:`, err);
  }

  revalidatePath(`/properties/${propertyId}/units/${unitId}`);
}

export async function revokeInvite(propertyId: string, unitId: string, inviteId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireActiveSubscription(user.id);

  const { error } = await supabase
    .from("tenant_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId);
  if (error) throw new Error(error.message);

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
