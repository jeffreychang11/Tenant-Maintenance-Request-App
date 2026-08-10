"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendInviteEmail } from "@/lib/email/resend";

export async function createProperty(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  const address_line1 = (formData.get("address_line1") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const state = (formData.get("state") as string)?.trim() || null;
  const postal_code = (formData.get("postal_code") as string)?.trim() || null;

  if (!name) throw new Error("Property name is required");

  const { data, error } = await supabase
    .from("properties")
    .insert({ landlord_id: user.id, name, address_line1, city, state, postal_code })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  redirect(`/properties/${data.id}`);
}

export async function createUnit(propertyId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const label = (formData.get("label") as string)?.trim();
  if (!label) throw new Error("Unit label is required");

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

  const { error } = await supabase.rpc("delete_property", { p_property_id: propertyId });
  if (error) throw new Error(error.message);

  revalidatePath("/manage-properties");
  revalidatePath("/dashboard");
}

export async function removeTenant(tenantUnitId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("remove_tenant_from_unit", {
    p_tenant_unit_id: tenantUnitId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/manage-properties");
  revalidatePath("/dashboard");
}
