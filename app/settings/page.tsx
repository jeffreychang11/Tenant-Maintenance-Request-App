import { requireProfile } from "@/lib/auth";
import { NavBar } from "@/components/layout/NavBar";
import { TenantNavBar } from "@/components/layout/TenantNavBar";
import { PushToggle } from "@/components/settings/PushToggle";

export default async function SettingsPage() {
  const { user, profile } = await requireProfile();
  const role = profile.role as "landlord" | "tenant";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {role === "landlord" ? (
        <NavBar
          role="landlord"
          links={[
            { href: "/dashboard", label: "Properties" },
            { href: "/requests", label: "Requests" },
            { href: "/settings", label: "Settings" },
          ]}
        />
      ) : (
        <TenantNavBar />
      )}
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-medium">Settings</h1>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between border-b border-black/10 pb-3 dark:border-white/10">
              <dt className="text-zinc-600 dark:text-zinc-400">Name</dt>
              <dd>{profile.full_name || "—"}</dd>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-3 dark:border-white/10">
              <dt className="text-zinc-600 dark:text-zinc-400">Email</dt>
              <dd>{user.email}</dd>
            </div>
          </dl>

          <h2 className="mt-8 text-lg font-medium">Notifications</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Get a browser notification when there&apos;s activity on your requests. You&apos;ll
            always get an email too, even without this enabled.
          </p>
          <div className="mt-3">
            <PushToggle />
          </div>
        </div>
      </main>
    </div>
  );
}
