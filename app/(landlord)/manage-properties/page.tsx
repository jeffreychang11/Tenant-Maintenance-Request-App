import Link from "next/link";
import { IconPlus } from "@tabler/icons-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ManagePropertiesList } from "@/components/properties/ManagePropertiesList";

export default async function ManagePropertiesPage() {
  const { user } = await requireProfile();
  const supabase = await createClient();

  const { data: properties } = await supabase
    .from("properties")
    .select(
      "id, name, address_line1, city, state, units(id, label, tenant_units(id, status, profiles(full_name)))"
    )
    .eq("landlord_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">Manage properties</h1>
        <Link
          href="/properties/new"
          aria-label="Add property"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <IconPlus size={18} aria-hidden="true" />
        </Link>
      </div>

      <ManagePropertiesList properties={properties ?? []} landlordId={user.id} />
    </div>
  );
}
