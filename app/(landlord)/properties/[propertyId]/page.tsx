import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createInvite } from "@/app/(landlord)/properties/actions";
import { BackButton } from "@/components/layout/BackButton";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  await requireProfile();
  const { propertyId } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id, name, address_line1, city, state, postal_code")
    .eq("id", propertyId)
    .single();

  if (!property) notFound();

  const { data: units } = await supabase
    .from("units")
    .select("id, label, tenant_units(status)")
    .eq("property_id", propertyId)
    .order("label");

  return (
    <div className="mx-auto max-w-2xl">
      <BackButton />
      <p className="text-sm text-zinc-500">
        <Link href="/dashboard" className="hover:underline">
          Properties
        </Link>{" "}
        / {property.name}
      </p>
      <h1 className="mt-1 text-2xl font-medium">{property.name}</h1>
      {(property.address_line1 || property.city) && (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {[property.address_line1, property.city, property.state, property.postal_code]
            .filter(Boolean)
            .join(", ")}
        </p>
      )}

      <h2 className="mt-8 text-lg font-medium">Units</h2>
      {!units || units.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No units yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {units.map((u) => {
            const hasTenant = u.tenant_units.some((tu) => tu.status === "active");
            const inviteForUnit = createInvite.bind(null, propertyId, u.id);
            return (
              <li key={u.id} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{u.label}</p>
                  <Link
                    href={`/properties/${propertyId}/units/${u.id}`}
                    className="shrink-0 text-xs text-zinc-600 hover:underline dark:text-zinc-400"
                  >
                    Manage →
                  </Link>
                </div>
                {!hasTenant && (
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
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
