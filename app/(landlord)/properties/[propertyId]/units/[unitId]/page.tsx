import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { removeTenant } from "@/app/(landlord)/properties/actions";
import { TenantRow } from "@/components/properties/TenantRow";
import { InviteTenantForm } from "@/components/properties/InviteTenantForm";
import { BackButton } from "@/components/layout/BackButton";

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string; unitId: string }>;
}) {
  await requireProfile();
  const { propertyId, unitId } = await params;
  const supabase = await createClient();

  const { data: unit } = await supabase
    .from("units")
    .select("id, label, properties(id, name)")
    .eq("id", unitId)
    .single();

  if (!unit) notFound();
  const property = unit.properties as unknown as { id: string; name: string } | null;

  const { data: tenantLinks } = await supabase
    .from("tenant_units")
    .select("id, tenant_id, status, profiles(full_name)")
    .eq("unit_id", unitId)
    .eq("status", "active");

  const tenantContacts = await Promise.all(
    (tenantLinks ?? []).map(async (t) => {
      const { data } = await supabase
        .rpc("get_tenant_contact", { p_tenant_id: t.tenant_id })
        .maybeSingle();
      return { tenantUnitId: t.id, ...data };
    })
  );
  const contactByTenantUnitId = new Map(tenantContacts.map((c) => [c.tenantUnitId, c]));

  return (
    <div className="mx-auto max-w-2xl">
      <BackButton />
      <p className="text-sm text-zinc-500">
        <Link href="/dashboard" className="hover:underline">
          Properties
        </Link>{" "}
        /{" "}
        <Link href={`/properties/${propertyId}`} className="hover:underline">
          {property?.name}
        </Link>{" "}
        / {unit.label}
      </p>
      <h1 className="mt-1 text-2xl font-medium">{unit.label}</h1>

      <h2 className="mt-8 text-lg font-medium">Tenants</h2>
      {!tenantLinks || tenantLinks.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          No tenant linked to this unit yet.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {tenantLinks.map((t) => {
            const contact = contactByTenantUnitId.get(t.id);
            const fullName =
              (t.profiles as unknown as { full_name: string | null } | null)?.full_name ||
              contact?.full_name ||
              "Unnamed tenant";
            return (
              <TenantRow
                key={t.id}
                fullName={fullName}
                email={contact?.email ?? null}
                phone={contact?.phone ?? null}
                onRemove={removeTenant.bind(null, t.id)}
              />
            );
          })}
        </ul>
      )}

      <h2 className="mt-8 text-lg font-medium">Invite a tenant</h2>
      <InviteTenantForm propertyId={propertyId} unitId={unitId} />
    </div>
  );
}
