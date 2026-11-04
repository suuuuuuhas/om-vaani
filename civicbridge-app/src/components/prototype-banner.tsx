"use client";

import { Warning } from "@phosphor-icons/react";
import { useApp } from "@/components/providers/app-provider";

export function PrototypeBanner() {
  const { dict } = useApp();
  return (
    <div
      role="note"
      aria-label={dict.app.prototypeBanner}
      className="border-b border-line bg-sunken"
    >
      <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 text-xs leading-relaxed text-ink-secondary md:px-6">
        <Warning aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" weight="fill" />
        <span>{dict.app.prototypeBanner}</span>
      </p>
    </div>
  );
}
