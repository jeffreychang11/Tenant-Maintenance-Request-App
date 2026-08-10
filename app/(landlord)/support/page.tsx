import { IconMail } from "@tabler/icons-react";

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-medium">Support</h1>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        Have a question, found a bug, or need help with something? Reach out directly and
        I&apos;ll get back to you.
      </p>
      <a
        href="mailto:jeffreychang129@gmail.com"
        className="mt-4 flex w-fit items-center gap-3 rounded-xl border border-black/10 px-4 py-3 text-sm hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
      >
        <IconMail size={18} className="shrink-0 text-zinc-500" aria-hidden="true" />
        jeffreychang129@gmail.com
      </a>
    </div>
  );
}
