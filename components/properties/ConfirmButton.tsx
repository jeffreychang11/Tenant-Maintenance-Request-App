"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConfirmButton({
  action,
  confirmMessage,
  children,
  className,
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    if (!window.confirm(confirmMessage)) return;
    setLoading(true);
    try {
      await action();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={loading} className={className}>
      {loading ? "..." : children}
    </button>
  );
}
