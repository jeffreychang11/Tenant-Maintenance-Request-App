"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronDown, IconMail, IconMinus, IconPencil } from "@tabler/icons-react";
import { markOnboardingTutorialSeen } from "@/app/(landlord)/actions";

// Each slide's "visual" is a small mock-up of the real UI it's teaching,
// styled to match the actual components (chat bubbles, StatusBadge colors,
// ManagePropertiesList rows, DndSettings, the Support page's mail row) —
// not a generic icon — using made-up example data so it's honest about
// being illustrative rather than a screenshot of the landlord's real data.
function ChatVisual() {
  return (
    <div className="rounded-xl border border-black/10 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-800">
      <div className="overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-l-4 border-amber-400 px-3 py-2">
          <p className="text-xs font-medium">123 Oak Street</p>
          <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
            In progress
          </span>
        </div>
        <div className="border-t border-black/10 px-3 py-2 dark:border-white/10">
          <p className="text-xs font-medium">Kitchen sink leak</p>
          <p className="mt-0.5 text-[10px] text-zinc-500">The kitchen sink is leaking again</p>
          <span className="mt-1.5 inline-block rounded-full border-2 border-black px-2 py-0.5 text-[10px] font-semibold dark:border-white">
            Details
          </span>
        </div>
      </div>

      <div className="my-1 flex flex-col items-center">
        <span className="text-[9px] font-medium italic text-zinc-500 dark:text-zinc-400">
          tap Details to reply
        </span>
        <IconChevronDown size={14} className="text-zinc-400" aria-hidden="true" />
      </div>

      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Messages</p>
      <div className="mt-2 flex flex-col gap-2">
        <div className="flex flex-col items-start">
          <span className="mb-0.5 text-[10px] text-zinc-500">Jane Smith</span>
          <div className="max-w-[75%] rounded-xl bg-black/5 px-3 py-1.5 text-xs dark:bg-white/10">
            The kitchen sink is leaking again
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="mb-0.5 text-[10px] text-zinc-500">You</span>
          <div className="max-w-[75%] rounded-xl bg-black px-3 py-1.5 text-xs text-white dark:bg-white dark:text-black">
            I&apos;ll send someone Tuesday morning
          </div>
          <span className="mt-0.5 text-[9px] text-zinc-400">Read</span>
        </div>
      </div>
      <div className="mt-2 flex gap-1.5">
        <div className="flex-1 rounded-md border border-black/10 px-2 py-1 text-[10px] text-zinc-400 dark:border-white/20">
          Write a reply...
        </div>
        <div className="rounded-full bg-black px-2.5 py-1 text-[10px] font-medium text-white dark:bg-white dark:text-black">
          Send
        </div>
      </div>
    </div>
  );
}

function StatusVisual() {
  return (
    <div className="rounded-xl border border-black/10 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-800">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Kitchen sink leak</p>
        <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          In progress
        </span>
      </div>
      <p className="mt-1 text-[10px] text-zinc-500">123 Oak Street &middot; Jane Smith</p>
      <div className="mt-2 flex gap-1.5">
        <span className="rounded-full border border-green-400 px-2.5 py-1 text-[10px] font-medium text-green-700 dark:border-green-600 dark:text-green-400">
          Mark complete
        </span>
      </div>
    </div>
  );
}

function PropertiesVisual() {
  return (
    <div className="rounded-xl border border-black/10 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-800">
      <div className="overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-l-4 border-green-400 px-3 py-2">
          <div>
            <p className="text-xs font-medium">123 Oak Street</p>
            <p className="text-[10px] text-zinc-500">Jane Smith</p>
          </div>
          <div className="flex gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-black/10 dark:border-white/20">
              <IconPencil size={12} aria-hidden="true" />
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-black/10 dark:border-white/20">
              <IconMinus size={12} aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DndVisual() {
  return (
    <div className="rounded-xl border border-black/10 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-800">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Do Not Disturb</p>
        <span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-medium text-white dark:bg-white dark:text-black">
          Enabled
        </span>
      </div>
      <div className="mt-2 flex gap-3 text-[10px]">
        <div>
          <p className="text-zinc-500">From</p>
          <p className="mt-0.5 rounded-md border border-black/10 px-2 py-1 dark:border-white/20">10:00 PM</p>
        </div>
        <div>
          <p className="text-zinc-500">To</p>
          <p className="mt-0.5 rounded-md border border-black/10 px-2 py-1 dark:border-white/20">7:00 AM</p>
        </div>
      </div>
    </div>
  );
}

function SupportVisual() {
  return (
    <div className="rounded-xl border border-black/10 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-800">
      <p className="text-xs font-medium">Support</p>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-[10px] dark:border-white/10 dark:bg-zinc-900">
        <IconMail size={14} className="shrink-0 text-zinc-500" aria-hidden="true" />
        jeffreychang129@gmail.com
      </div>
    </div>
  );
}

const SLIDES = [
  {
    visual: ChatVisual,
    title: "Chat with your tenants",
    description:
      "Tap a property on your dashboard and its request slides open. Tap Details to open it and reply — it becomes a live chat thread, and tenants see your replies right away, no phone number needed.",
  },
  {
    visual: StatusVisual,
    title: "Track every request",
    description:
      "Open a request and mark it in progress or complete as the work happens. Your tenant's view updates the moment you do.",
  },
  {
    visual: PropertiesVisual,
    title: "Manage properties and tenants",
    description:
      "From Manage Properties, add properties and units, invite tenants, and edit their info.",
  },
  {
    visual: DndVisual,
    title: "Do Not Disturb",
    description:
      "In Settings, set quiet hours to mute push notifications overnight. You'll still get email, so nothing slips through.",
  },
  {
    visual: SupportVisual,
    title: "Questions? I'm here.",
    description: (
      <>
        Reach out any time from Support — I read every message myself and I&apos;m happy to help.
        <br />— Jeffrey Chang, Founder of SimpleRoost.
      </>
    ),
  },
];

export function WelcomeTutorial({ show }: { show: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(show);
  const [step, setStep] = useState(0);

  if (!open) return null;

  async function dismiss() {
    setOpen(false);
    try {
      await markOnboardingTutorialSeen();
    } catch {
      // Best-effort — if this fails, the tutorial just shows again next
      // visit instead of leaving an uncaught rejection or a stuck modal.
    }
    router.refresh();
  }

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const Visual = slide.visual;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={dismiss}>
      <div
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="text-xs font-medium text-zinc-500 transition-colors hover:text-black active:text-zinc-700 dark:hover:text-white"
          >
            Skip
          </button>
        </div>

        <Visual />

        <div className="mt-4 text-center">
          <h2 className="text-lg font-medium">{slide.title}</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{slide.description}</p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${
                i === step ? "bg-black dark:bg-white" : "bg-black/15 dark:bg-white/20"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 active:bg-black/10 dark:border-white/20 dark:hover:bg-white/10 dark:active:bg-white/15"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? dismiss() : setStep((s) => s + 1))}
            className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
          >
            {isLast ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
