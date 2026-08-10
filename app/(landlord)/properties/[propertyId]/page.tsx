import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createUnit } from "@/app/(landlord)/properties/actions";

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
    .select("id, label")
    .eq("property_id", propertyId)
    .order("label");

  const createUnitForProperty = createUnit.bind(null, propertyId);

  return (
    <div className="mx-auto max-w-2xl">
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
          {units.map((u) => (
            <li key={u.id}>
              <Link
                href={`/properties/${propertyId}/units/${u.id}`}
                className="block rounded-xl border border-black/10 px-4 py-3 hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
              >
                {u.label}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form action={createUnitForProperty} className="mt-6 flex gap-2">
        <input
          name="label"
          required
          placeholder="Unit label (e.g. Unit 2B)"
          className="flex-1 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/20 dark:bg-black"
        />
        <button
          type="submit"
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Add unit
        </button>
      </form>
    </div>
  );
}
