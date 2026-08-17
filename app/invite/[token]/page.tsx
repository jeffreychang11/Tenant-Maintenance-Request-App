import { createClient } from "@/lib/supabase/server";
import { InviteSignupForm } from "@/components/properties/InviteSignupForm";
import { acceptInvite } from "@/app/invite/[token]/actions";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: invites } = await supabase.rpc("get_invite_by_token", { p_token: token });
  const invite = invites?.[0];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const acceptForToken = acceptInvite.bind(null, token);

  if (!invite) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <h1 className="text-2xl font-medium">Invite not found</h1>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          This invite link isn&apos;t valid. Ask your landlord to send a new one.
        </p>
      </div>
    );
  }

  const isExpired = invite.status === "pending" && new Date(invite.expires_at) < new Date();
  const isInvalid = invite.status !== "pending" || isExpired;

  if (isInvalid) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <h1 className="text-2xl font-medium">Invite no longer valid</h1>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          {isExpired
            ? "This invite link has expired."
            : `This invite is ${invite.status}.`}{" "}
          Ask your landlord to resend it.
        </p>
      </div>
    );
  }

  const emailMatches = user?.email?.toLowerCase() === invite.email.toLowerCase();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-medium">You&apos;re invited</h1>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        Join {invite.property_name} {invite.unit_label} to submit and track maintenance requests.
      </p>

      {!user && <InviteSignupForm email={invite.email} token={token} />}

      {user && emailMatches && (
        <form action={acceptForToken} className="mt-6">
          <button
            type="submit"
            className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
          >
            Accept invite
          </button>
        </form>
      )}

      {user && !emailMatches && (
        <p className="mt-6 text-sm text-red-600">
          This invite was sent to {invite.email}, but you&apos;re signed in as {user.email}. Log
          out and use the invited email address to accept it.
        </p>
      )}
    </div>
  );
}
