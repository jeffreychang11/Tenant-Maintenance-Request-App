import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateProperty } from "@/app/(landlord)/properties/actions";
import { BackButton } from "@/components/layout/BackButton";
import { AddUnitForm } from "@/components/properties/AddUnitForm";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  await requireProfile();
  const { propertyId } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id, address_line1, city, state, postal_code")
    .eq("id", propertyId)
    .single();

  if (!property) notFound();

  const { data: units } = await supabase
    .from("units")
    .select("id, label")
    .eq("property_id", propertyId)
    .order("label");

  const updatePropertyForId = updateProperty.bind(null, propertyId);

  return (
    <div className="mx-auto max-w-md">
      <BackButton />
      <h1 className="text-2xl font-medium">Edit property</h1>
      {/*
        The "Save changes" button submits address/city/state/zip together
        as one update. The Units section needs to render visually between
        street address and city/state, but it's its own form (Add unit
        posts independently) — nesting a <form> inside another isn't valid
        HTML, so the city/state/zip fields and the submit button live
        outside this <form> and are re-associated to it via the `form`
        attribute instead of DOM nesting.
      */}
      <form id="edit-property-form" action={updatePropertyForId} className="mt-8 flex flex-col gap-4">
        <div>
          <label htmlFor="address_line1" className="block text-sm text-zinc-600 dark:text-zinc-400">
            Street address
          </label>
          <input
            id="address_line1"
            name="address_line1"
            defaultValue={property.address_line1 ?? ""}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
          />
        </div>
      </form>

      <h2 className="mt-6 text-lg font-medium">Units</h2>
      {!units || units.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No units yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {units.map((u) => (
            <li
              key={u.id}
              className="rounded-xl border border-black/10 px-4 py-3 text-sm dark:border-white/10"
            >
              {u.label}
            </li>
          ))}
        </ul>
      )}

      <AddUnitForm propertyId={propertyId} />

      <div className="mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="city" className="block text-sm text-zinc-600 dark:text-zinc-400">
              City
            </label>
            <input
              id="city"
              name="city"
              form="edit-property-form"
              defaultValue={property.city ?? ""}
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
            />
          </div>
          <div>
            <label htmlFor="state" className="block text-sm text-zinc-600 dark:text-zinc-400">
              State
            </label>
            <input
              id="state"
              name="state"
              form="edit-property-form"
              defaultValue={property.state ?? ""}
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
            />
          </div>
        </div>
        <div>
          <label htmlFor="postal_code" className="block text-sm text-zinc-600 dark:text-zinc-400">
            ZIP code
          </label>
          <input
            id="postal_code"
            name="postal_code"
            form="edit-property-form"
            defaultValue={property.postal_code ?? ""}
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
          />
        </div>
        <button
          type="submit"
          form="edit-property-form"
          className="mt-2 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
        >
          Save changes
        </button>
      </div>
    </div>
  );
}
