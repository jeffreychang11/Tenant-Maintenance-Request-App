import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function getPrimaryLandlordContact(
  supabase: SupabaseClient<Database>,
  tenantId: string
) {
  const { data: tenantUnit } = await supabase
    .from("tenant_units")
    .select("unit_id")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!tenantUnit) return null;

  const { data } = await supabase
    .rpc("get_landlord_contact", { p_unit_id: tenantUnit.unit_id })
    .maybeSingle();

  return data ?? null;
}
