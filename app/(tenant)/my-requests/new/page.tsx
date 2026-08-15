import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NewRequestForm } from "@/components/requests/NewRequestForm";
import { BackButton } from "@/components/layout/BackButton";
import { categoryLabel, type CategoryValue } from "@/lib/categories";

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { user } = await requireProfile();
  const { category } = await searchParams;
  const supabase = await createClient();

  const { data: tenantUnits } = await supabase
    .from("tenant_units")
    .select("unit_id, units(label, properties(name))")
    .eq("tenant_id", user.id)
    .eq("status", "active");

  if (!tenantUnits || tenantUnits.length === 0) {
    return (
      <div className="mx-auto max-w-md">
        <BackButton />
        <h1 className="text-2xl font-medium">New request</h1>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          You&apos;re not linked to a unit yet. Ask your landlord to send you an invite.
        </p>
      </div>
    );
  }

  const units = tenantUnits.map((tu) => {
    const unit = tu.units as unknown as { label: string; properties: { name: string } | null } | null;
    return {
      id: tu.unit_id,
      label: [unit?.properties?.name, unit?.label].filter(Boolean).join(" "),
    };
  });

  const resolvedCategory: CategoryValue = (category as CategoryValue) || "other";

  return (
    <div className="mx-auto max-w-md">
      <BackButton />
      <h1 className="text-2xl font-medium">New request - {categoryLabel(resolvedCategory)}</h1>
      <NewRequestForm units={units} initialCategory={category} />
    </div>
  );
}
