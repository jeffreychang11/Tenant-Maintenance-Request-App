"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/properties/ConfirmButton";

export function TenantRow({
  fullName,
  email,
  phone,
  onRemove,
}: {
  fullName: string;
  email: string | null;
  phone: string | null;
  onRemove: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex-1 cursor-pointer text-left"
        >
          {fullName}
        </button>
        <ConfirmButton
          action={onRemove}
          confirmMessage={`Mark ${fullName} as moved out? They'll lose access to this unit, and you'll be able to invite a new tenant.`}
          confirmLabel="Remove tenant"
          className="shrink-0 text-xs text-red-600 hover:underline"
        >
          Remove tenant
        </ConfirmButton>
      </div>

      <div
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-1 border-t border-black/10 px-4 py-3 text-sm dark:border-white/10">
            <p>
              <span className="text-zinc-500 dark:text-zinc-400">Email:</span>{" "}
              {email || "—"}
            </p>
            <p>
              <span className="text-zinc-500 dark:text-zinc-400">Phone:</span>{" "}
              {phone || "—"}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}
