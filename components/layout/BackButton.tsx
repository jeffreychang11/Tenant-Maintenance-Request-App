"use client";

import { useRouter } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Back"
      className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
    >
      <IconArrowLeft size={20} aria-hidden="true" />
    </button>
  );
}
