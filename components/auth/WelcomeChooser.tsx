import Link from "next/link";
import Image from "next/image";

export function WelcomeChooser() {
  return (
    <div className="flex min-h-full w-full flex-1 flex-col items-center justify-center gap-1 bg-white px-6 py-16 text-center">
      <Image src="/logo-icon.png" alt="" width={88} height={88} className="rounded-2xl" />
      <span className="mt-4 flex items-baseline text-4xl">
        <span className="mr-0.5 font-serif italic">Simple</span>
        <span className="font-sans font-bold text-[#0F2042]">Roost</span>
      </span>
      <p className="mt-1 text-xs tracking-wide text-black">Maintenance Made Easy</p>

      <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/get-started"
          className="rounded-full bg-black px-5 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700"
        >
          Sign up
        </Link>
        <Link
          href="/login?form=1"
          className="rounded-full border border-black/10 px-5 py-2.5 text-center text-sm font-medium transition-colors hover:bg-black/5 active:bg-black/10"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
