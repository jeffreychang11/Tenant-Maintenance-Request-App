import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryLandlordContact } from "@/lib/landlord";
import { IconMail, IconPhone } from "@tabler/icons-react";

export default async function ContactLandlordPage() {
  const { user } = await requireProfile();
  const supabase = await createClient();
  const landlordContact = await getPrimaryLandlordContact(supabase, user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-medium">Contact Landlord</h1>

      {!landlordContact ? (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          You&apos;re not linked to a unit yet, so there&apos;s no landlord to show.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {landlordContact.full_name && (
            <p className="text-lg font-medium">{landlordContact.full_name}</p>
          )}

          {landlordContact.email && (
            <a
              href={`mailto:${landlordContact.email}`}
              className="flex items-center gap-3 rounded-xl border border-black/10 px-4 py-3 text-sm hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
            >
              <IconMail size={18} className="shrink-0 text-zinc-500" aria-hidden="true" />
              {landlordContact.email}
            </a>
          )}

          {landlordContact.phone && (
            <a
              href={`tel:${landlordContact.phone}`}
              className="flex items-center gap-3 rounded-xl border border-black/10 px-4 py-3 text-sm hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
            >
              <IconPhone size={18} className="shrink-0 text-zinc-500" aria-hidden="true" />
              {landlordContact.phone}
            </a>
          )}

          {!landlordContact.email && !landlordContact.phone && (
            <p className="text-sm text-zinc-500">No contact info on file.</p>
          )}
        </div>
      )}
    </div>
  );
}
