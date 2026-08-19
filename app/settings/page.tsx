import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryLandlordContact } from "@/lib/landlord";
import { LandlordNavBar } from "@/components/layout/LandlordNavBar";
import { TenantNavBar } from "@/components/layout/TenantNavBar";
import { PushToggle } from "@/components/settings/PushToggle";
import { DndSettings } from "@/components/settings/DndSettings";

export default async function SettingsPage() {
  const { user, profile } = await requireProfile();
  const role = profile.role as "landlord" | "tenant";
  const supabase = await createClient();
  const landlordContact = role === "tenant" ? await getPrimaryLandlordContact(supabase, user.id) : null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {role === "landlord" ? (
        <LandlordNavBar />
      ) : (
        <TenantNavBar landlordContact={landlordContact} />
      )}
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-medium">Settings</h1>
          <dl className="mt-6 flex flex-col gap-5">
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Name</dt>
              <dd className="mt-1 text-base font-medium text-black dark:text-white">
                {profile.full_name || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Email</dt>
              <dd className="mt-1 text-base font-medium text-black dark:text-white">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Phone</dt>
              <dd className="mt-1 text-base font-medium text-black dark:text-white">
                {profile.phone || "—"}
              </dd>
              {role === "landlord" && (
                <p className="mt-1 text-xs text-zinc-500">Private — your tenants will never see this number.</p>
              )}
            </div>
          </dl>

          <h2 className="mt-8 text-lg font-medium">Notifications</h2>
          <div className="mt-3">
            <PushToggle />
          </div>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Get a browser notification when there&apos;s activity on your requests. You&apos;ll
            always get an email too, even without this enabled.
          </p>
          {role === "landlord" && (
            <DndSettings
              initialEnabled={profile.dnd_enabled}
              initialStartTime={profile.dnd_start_time}
              initialEndTime={profile.dnd_end_time}
            />
          )}
        </div>
      </main>
    </div>
  );
}
