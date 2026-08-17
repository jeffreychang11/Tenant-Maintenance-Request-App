import Image from "next/image";
import Link from "next/link";

export function Logo({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-base text-black dark:text-white">
      <Image
        src="/logo-icon.png"
        alt=""
        width={18}
        height={18}
        className="rounded-md"
      />
      <span className="flex items-baseline">
        <span className="mr-0.5 font-serif italic">Simple</span>
        <span className="font-sans font-bold text-[#0F2042]">Roost</span>
      </span>
    </Link>
  );
}
