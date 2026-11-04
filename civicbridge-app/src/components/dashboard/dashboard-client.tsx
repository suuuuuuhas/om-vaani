"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowCircleRight,
  ArrowRight,
  ArrowClockwise,
  Clock,
  Warning,
  X
} from "@phosphor-icons/react";
import { useApp } from "@/components/providers/app-provider";
import { getAdapter } from "@/lib/adapters";
import { lookupMessage, LOCALE_META } from "@/lib/i18n";
import { daysBetween } from "@/lib/utils/dates";

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-accent-soft text-accent-strong border-accent/30",
  "in-progress": "bg-accent-soft text-accent-strong border-accent/30",
  "awaiting-response": "bg-warn/10 text-warn border-warn/40",
  "response-received": "bg-ok/10 text-ok border-ok/40",
  "closed-unsatisfactory": "bg-bad/10 text-bad border-bad/40"
};

export function DashboardClient() {
  const { dict, store, resetDemo } = useApp();

  if (!store) {
    return (
      <div className="py-16" role="status">
        <p className="text-sm text-ink-secondary">{dict.intake.aiLoading}</p>
      </div>
    );
  }

  const cases = [...store.cases].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <section className="pt-2">
      <div className="mb-8 rounded-card border border-line bg-surface p-5 md:p-7">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Your civic workspace</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Your concerns, in one place.</h2>
        <p className="mt-2 max-w-[65ch] text-sm text-ink-secondary">Review cases, understand their next steps, or speak to Vaani about a new concern.</p>
        <div className="mt-5 flex flex-wrap gap-3"><Link href="/" className="inline-flex min-h-11 items-center rounded-control bg-accent px-4 text-sm font-bold text-onaccent">Speak to Vaani <ArrowRight aria-hidden className="ml-2 size-4" /></Link><span className="self-center text-xs text-ink-secondary">Cases shown include fictional demonstration records.</span></div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{dict.dashboard.title}</h1>
          <p className="mt-1 max-w-[65ch] text-sm text-ink-secondary">{dict.dashboard.subtitle}</p>
        </div>
        <ResetControl onReset={resetDemo} label={dict.dashboard.resetDemo} confirmTitle={dict.dashboard.resetConfirmTitle} confirmBody={dict.dashboard.resetConfirmBody} yes={dict.dashboard.resetYes} no={dict.dashboard.resetNo} />
      </div>

      {cases.length === 0 ? (
        <div className="mt-10 rounded-card border border-dashed border-line bg-surface p-10 text-center">
          <h2 className="text-lg font-bold">{dict.dashboard.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-secondary">{dict.dashboard.emptyBody}</p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-control bg-accent px-5 text-sm font-bold text-onaccent hover:bg-accent-strong"
          >
            {dict.dashboard.emptyCta}
            <ArrowRight aria-hidden className="size-4" weight="bold" />
          </Link>
        </div>
      ) : (
        <>
          {/* Accessible table summary for screen readers */}
          <h2 className="sr-only">{dict.dashboard.title}</h2>
          <ul className="mt-6 grid gap-3">
            {cases.map((c) => {
              const adapter = getAdapter(c.system);
              const nextAction = adapter.computeNextAction(c);
              const ageDays = Math.max(0, daysBetween(new Date(c.createdAt), new Date()));
              const statusLabel =
                lookupMessage(dict, `status.${c.statusCode.replace(/-/g, "_")}`) ?? c.statusCode;
              const systemName =
                c.railwaySubflow === "tdr"
                  ? dict.systems.tdr_name
                  : c.system === "railways"
                    ? dict.systems.railmadad_name
                    : dict.systems[`${c.system}_name` as "nch_name" | "epfo_name"];
              const title = lookupMessage(dict, nextAction.titleKey) ?? "";
              const sourceHost = safeHost(nextAction.policy.sourceUrl);

              return (
                <li key={c.id}>
                  <Link
                    href={`/case/${c.id}`}
                    className="block rounded-card border border-line bg-surface p-4 hover:border-accent"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="font-mono text-sm font-bold">{c.id}</span>
                      <span className="rounded-[6px] bg-sunken px-2 py-0.5 text-xs font-semibold">
                        {systemName}
                      </span>
                      <span className={`rounded-[6px] border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[c.statusCode] ?? ""}`}>
                        {statusLabel}
                      </span>
                      {nextAction.overdue && (
                        <span className="inline-flex items-center gap-1 rounded-[6px] bg-bad/10 px-2 py-0.5 text-xs font-bold text-bad">
                          <Warning aria-hidden className="size-3.5" weight="fill" />
                          {dict.dashboard.overdueTag}
                        </span>
                      )}
                      <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-secondary">
                        <Clock aria-hidden className="size-3.5" />
                        {ageText(ageDays, dict)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm leading-relaxed">{c.triage.summary}</p>
                      <ArrowRight aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-secondary" />
                    </div>
                    {nextAction.available && (
                      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <ArrowCircleRight aria-hidden className="size-4 shrink-0 text-accent" weight="fill" />
                        <span className="font-bold text-accent-strong">{title}</span>
                        <Badge official={nextAction.policy.timing === "official"} dict={dict} />
                        {sourceHost && (
                          <span className="text-ink-secondary">{sourceHost}</span>
                        )}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="sr-only">
            {LOCALE_META.map((m) => m.nativeName).join(", ")}
          </p>
        </>
      )}
    </section>
  );
}

function Badge({ official, dict }: { official: boolean; dict: ReturnType<typeof useApp>["dict"] }) {
  return (
    <span
      className={`rounded-[6px] px-1.5 py-0.5 text-[11px] font-bold ${
        official ? "bg-accent text-onaccent" : "bg-sunken text-ink-secondary"
      }`}
    >
      {official ? dict.casePage.officialBadge : dict.casePage.advisoryBadge}
    </span>
  );
}

function ResetControl(props: {
  onReset: () => void;
  label: string;
  confirmTitle: string;
  confirmBody: string;
  yes: string;
  no: string;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-line px-3 text-xs font-semibold text-ink-secondary hover:border-bad hover:text-bad"
      >
        <ArrowClockwise aria-hidden className="size-4" />
        {props.label}
      </button>
    );
  }
  return (
    <div role="alertdialog" aria-label={props.confirmTitle} className="rounded-card border border-line bg-surface p-3 text-xs">
      <p className="font-bold">{props.confirmTitle}</p>
      <p className="mt-0.5 text-ink-secondary">{props.confirmBody}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            props.onReset();
            setConfirming(false);
          }}
          className="min-h-9 rounded-control bg-bad px-3 font-bold text-white"
        >
          {props.yes}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="inline-flex min-h-9 items-center gap-1 rounded-control border border-line px-3 font-semibold"
        >
          <X aria-hidden className="size-3.5" />
          {props.no}
        </button>
      </div>
    </div>
  );
}

function ageText(days: number, dict: ReturnType<typeof useApp>["dict"]): string {
  if (days <= 0) return dict.dashboard.today;
  if (days === 1) return dict.dashboard.dayAgo;
  return dict.dashboard.daysAgo.replace("{n}", String(days));
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
