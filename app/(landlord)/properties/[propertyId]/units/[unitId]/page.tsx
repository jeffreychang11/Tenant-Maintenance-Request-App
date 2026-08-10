import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createInvite, revokeInvite } from "@/app/(landlord)/properties/actions";

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

  const { data: invites } = await supabase
    .from("tenant_invites")
    .select("id, email, status, expires_at, created_at")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: false });

  const inviteForUnit = createInvite.bind(null, propertyId, unitId);
  const revokeForUnit = revokeInvite.bind(null, propertyId, unitId);

  return (
    <div className="mx-auto max-w-2xl">
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
          {tenantLinks.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-black/10 px-4 py-3 text-sm dark:border-white/10"
            >
              {(t.profiles as unknown as { full_name: string | null } | null)?.full_name ||
                "Unnamed tenant"}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-lg font-medium">Invite a tenant</h2>
      <form action={inviteForUnit} className="mt-3 flex gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="tenant@example.com"
          className="flex-1 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/20 dark:bg-black"
        />
        <button
          type="submit"
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Send invite
        </button>
      </form>

      {invites && invites.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Invite history
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-sm dark:border-white/10"
              >
                <div>
                  <p>{inv.email}</p>
                  <p className="text-xs text-zinc-500">
                    {inv.status}
                    {inv.status === "pending" &&
                      ` · expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                  </p>
                </div>
                {inv.status === "pending" && (
                  <form action={revokeForUnit.bind(null, inv.id)}>
                    <button type="submit" className="text-xs text-red-600 hover:underline">
                      Revoke
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
