import Link from "next/link";

export function Logo({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-baseline text-base text-black dark:text-white">
      <span className="mr-0.5 font-serif italic">Simple</span>
      <span className="font-sans font-bold">Roost</span>
    </Link>
  );
}
