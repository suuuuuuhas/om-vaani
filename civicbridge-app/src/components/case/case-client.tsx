"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowCircleRight,
  CheckCircle,
  Clock,
  Copy,
  Download,
  FileText,
  Gavel,
  Info,
  LockKey,
  Warning
} from "@phosphor-icons/react";
import { useApp } from "@/components/providers/app-provider";
import { getAdapter } from "@/lib/adapters";
import { lookupMessage } from "@/lib/i18n";
import type { CaseRecord, ExecutionMode } from "@/lib/types";
import type { CaseSnapshot, EscalationLetterData } from "@/lib/ai/schemas";
import { daysBetween, formatDate, localeTag } from "@/lib/utils/dates";
import { fallbackExplanation } from "@/lib/ai/fallback/status";

function toSnapshot(c: CaseRecord, locale: CaseRecord["locale"]): CaseSnapshot {
  return {
    id: c.id,
    system: c.system,
    railwaySubflow: c.railwaySubflow,
    locale,
    originalText: c.originalText.slice(0, 4000),
    fields: Object.fromEntries(
      Object.entries(c.fields).map(([k, v]) => [k, String(v).slice(0, 120)])
    ),
    statusCode: c.statusCode,
    referenceNumber: c.referenceNumber,
    expectedResponseDays: c.expectedResponseDays,
    createdAt: new Date(c.createdAt).toISOString(),
    filingDeadlineAt: c.filingDeadlineAt
  };
}

export function CaseClient({ caseId }: { caseId: string }) {
  const { dict, locale, store, updateCase } = useApp();
  const record = store?.cases.find((c) => c.id === caseId) ?? null;

  const [explanation, setExplanation] = useState<{
    text: string;
    mode: ExecutionMode;
  } | null>(null);
  const [letter, setLetter] = useState<EscalationLetterData | null>(
    record?.cachedLetter ?? null
  );
  const [letterMode, setLetterMode] = useState<ExecutionMode | null>(
    record?.cachedLetter?.mode ?? null
  );
  const [letterBusy, setLetterBusy] = useState(false);
  const [letterError, setLetterError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const explanationRequested = useRef(false);

  const nextAction = useMemo(
    () => (record ? getAdapter(record.system).computeNextAction(record) : null),
    [record]
  );

  // Restore a cached letter once the seeded store finishes hydrating.
  useEffect(() => {
    if (record?.cachedLetter && !letter) {
      setLetter(record.cachedLetter);
      setLetterMode(record.cachedLetter.mode);
    }
  }, [record, letter]);

  // Status explanation: server service with local deterministic fallback.
  useEffect(() => {
    if (!record || explanationRequested.current) return;
    explanationRequested.current = true;
    const snapshot = toSnapshot(record, locale);
    fetch("/api/ai/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot })
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as {
          data: { explanation: string };
          mode: ExecutionMode;
        };
        setExplanation({ text: body.data.explanation, mode: body.mode });
      })
      .catch(() => {
        setExplanation({
          text: fallbackExplanation(snapshot),
          mode: "fallback"
        });
      });
  }, [record, locale]);

  async function generateLetter() {
    if (!record || !nextAction) return;
    setLetterBusy(true);
    setLetterError(null);
    const snapshot = toSnapshot(record, locale);
    const adapterCtx = getAdapter(record.system).buildEscalationContext(record);
    const factLines = adapterCtx.facts.map((f) => ({
      label: lookupMessage(dict, f.labelKey) ?? f.labelKey,
      value: f.value
    }));
    try {
      const response = await fetch("/api/ai/escalation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshot,
          addressedTo: adapterCtx.addressedTo,
          facts: adapterCtx.facts,
          locale,
          regenerate: Boolean(letter)
        })
      });
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as {
        data: EscalationLetterData;
        mode: ExecutionMode;
      };
      applyLetter(body.data, body.mode);
    } catch {
      // Deterministic local fallback keeps the journey alive without the API.
      const { buildLocalFallbackLetter } = await import("@/lib/ai/fallback/letter");
      const result = buildLocalFallbackLetter(
        { snapshot, addressedTo: adapterCtx.addressedTo, factLines, sourceUrl: adapter.policy.sourceUrl },
        locale
      );
      applyLetter(result, "fallback");
    } finally {
      setLetterBusy(false);
    }
  }

  function applyLetter(data: EscalationLetterData, mode: ExecutionMode) {
    setLetter(data);
    setLetterMode(mode);
    if (record) {
      updateCase(record.id, (c) => ({ ...c, cachedLetter: { ...data, mode } }));
    }
  }

  async function copyLetter() {
    if (!letter) return;
    const full = `${letter.subject}\n\n${letter.body}`;
    try {
      await navigator.clipboard.writeText(full);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = full;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadLetter() {
    if (!letter || !record) return;
    const blob = new Blob([`${letter.subject}\n\n${letter.body}`], {
      type: "text/plain;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CivicBridge-escalation-${record.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!store) {
    return (
      <div className="py-16" role="status">
        <p className="text-sm text-ink-secondary">{dict.intake.aiLoading}</p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-bold">{dict.casePage.notFoundTitle}</h1>
        <p className="mt-2 text-sm text-ink-secondary">{dict.casePage.notFoundBody}</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-control bg-accent px-4 text-sm font-bold text-onaccent hover:bg-accent-strong"
        >
          <ArrowLeft aria-hidden className="size-4" weight="bold" />
          {dict.casePage.backToDashboard}
        </Link>
      </div>
    );
  }

  const adapter = getAdapter(record.system);
  const context = adapter.buildEscalationContext(record);
  const ageDays = Math.max(0, daysBetween(new Date(record.createdAt), new Date()));
  const statusLabel =
    lookupMessage(dict, `status.${record.statusCode.replace(/-/g, "_")}`) ?? record.statusCode;

  return (
    <article className="pt-2">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-strong"
      >
        <ArrowLeft aria-hidden className="size-3.5" weight="bold" />
        {dict.casePage.backToDashboard}
      </Link>

      <header className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-mono text-2xl font-bold tracking-tight md:text-3xl">{record.id}</h1>
        <span className="rounded-[6px] bg-sunken px-2 py-0.5 text-xs font-semibold">
          {dict.systems[systemNameKey(record)]}
        </span>
        <span className={`rounded-[6px] border px-2 py-0.5 text-xs font-semibold ${
          record.statusCode === "closed-unsatisfactory"
            ? "border-bad/40 bg-bad/10 text-bad"
            : "border-line bg-surface text-ink-secondary"
        }`}>
          {statusLabel}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-ink-secondary">
          <Clock aria-hidden className="size-3.5" />
          {ageDays <= 0 ? dict.dashboard.today : `${ageDays} d`}
        </span>
      </header>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-ink-secondary">
        <Warning aria-hidden className="mr-1 inline size-3.5 text-warn" />
        {dict.casePage.syntheticNote}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <section aria-labelledby="timeline-heading" className="rounded-card border border-line bg-surface p-5">
            <h2 id="timeline-heading" className="text-base font-bold">{dict.timeline.heading}</h2>
            <ol className="mt-4 space-y-4 border-l border-line pl-4">
              {[...record.timeline].reverse().map((entry, i) => (
                <li key={`${entry.kind}-${i}`} className="relative text-sm">
                  <span aria-hidden className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-surface bg-accent" />
                  <time dateTime={entry.isoDate} className="block text-xs text-ink-secondary">
                    {formatDate(entry.isoDate, localeTag(locale))}
                  </time>
                  <span className="mt-0.5 block leading-snug">
                    {(lookupMessage(dict, `timeline.${entryKind(entry.kind)}`) ?? entry.kind).replace(
                      "{system}",
                      dict.systems[systemWithTagKey(record)]
                    )}
                  </span>
                  {entry.reference && entry.reference !== "-" && (
                    <span className="mt-0.5 block font-mono text-xs text-ink-secondary">{entry.reference}</span>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="evidence-heading" className="rounded-card border border-line bg-surface p-5">
            <h2 id="evidence-heading" className="text-base font-bold">{dict.casePage.evidenceHeading}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {Object.entries(record.fields).length === 0 && (
                <p className="text-xs text-ink-secondary">-</p>
              )}
              {Object.entries(record.fields).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-xs font-semibold text-ink-secondary">
                    {lookupFieldLabel(dict, k)}
                  </dt>
                  <dd className="truncate text-right font-mono text-xs">{v}</dd>
                </div>
              ))}
            </dl>
            {record.attachments.length === 0 ? (
              <p className="mt-4 text-xs text-ink-secondary">{dict.casePage.evidenceEmpty}</p>
            ) : (
              <ul className="mt-4 grid grid-cols-2 gap-3">
                {record.attachments.map((att) => (
                  <li key={att.id} className="overflow-hidden rounded-control border border-line">
                    {/* Synthetic inline SVG - no real file is ever uploaded. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={att.dataUrl} alt={att.name} width={240} height={160} className="w-full" />
                    <p className="truncate px-2 py-1.5 text-xs text-ink-secondary">{att.name}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section aria-labelledby="explain-heading" className="rounded-card border border-line bg-surface p-5">
            <h2 id="explain-heading" className="text-base font-bold">{dict.casePage.explanationHeading}</h2>
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-[6px] bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">
              <Info aria-hidden className="size-3.5" />
              {explanation === null
                ? dict.intake.modeAi
                : explanation.mode !== "fallback"
                  ? dict.intake.modeAi
                  : dict.intake.modeFallback}
            </p>
            {explanation === null ? (
              <p role="status" className="mt-3 animate-pulse text-sm text-ink-secondary">
                {dict.casePage.explanationLoading}
              </p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed">{explanation.text}</p>
            )}
          </section>

          {nextAction && (
            <section
              aria-labelledby="next-heading"
              className={`rounded-card border p-5 ${
                nextAction.available ? "border-accent/50 bg-accent-soft/40" : "border-line bg-surface"
              }`}
            >
              <h2 id="next-heading" className="flex items-center gap-2 text-base font-bold">
                <ArrowCircleRight aria-hidden className="size-5 text-accent" weight="fill" />
                {dict.casePage.nextStepHeading}
              </h2>
              <p className="mt-2 text-sm font-bold">
                {lookupMessage(dict, nextAction.titleKey)}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                {lookupMessage(dict, nextAction.bodyKey)}
              </p>

              <dl className="mt-4 space-y-1.5 text-xs text-ink-secondary">
                <div className="flex items-center gap-2">
                  <dt className="font-semibold">{dict.casePage.sourceLabel}:</dt>
                  <dd>
                    <a
                      href={nextAction.policy.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline decoration-line underline-offset-2 hover:text-ink"
                    >
                      {nextAction.policy.sourceLabel}
                    </a>
                  </dd>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <dt className="sr-only">{dict.casePage.verifiedOn.replace("{date}", "")}</dt>
                  <dd>
                    {dict.casePage.verifiedOn.replace("{date}", nextAction.policy.verifiedOn)}
                    {" · "}
                    <span className={`rounded-[6px] px-1.5 py-0.5 text-[11px] font-bold ${
                      nextAction.policy.timing === "official"
                        ? "bg-accent text-onaccent"
                        : "bg-sunken"
                    }`}>
                      {nextAction.policy.timing === "official"
                        ? dict.casePage.officialBadge
                        : dict.casePage.advisoryBadge}
                    </span>
                  </dd>
                </div>
                {nextAction.policy.verificationNote && (
                  <div>
                    <dt className="sr-only">Verification note</dt>
                    <dd className="italic">{nextAction.policy.verificationNote}</dd>
                  </div>
                )}
                {nextAction.deadlineAt && (
                  <div>
                    <dt className="inline font-semibold">{dict.casePage.deadlineLabel}: </dt>
                    <dd className="inline font-mono">
                      {new Date(nextAction.deadlineAt).toLocaleString(localeTag(locale))}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          <section aria-labelledby="escalation-heading" className="rounded-card border border-line bg-surface p-5">
            <h2 id="escalation-heading" className="flex items-center gap-2 text-base font-bold">
              <Gavel aria-hidden className="size-5 text-accent" />
              {dict.casePage.escalationHeading}
            </h2>

            {!nextAction?.available ? (
              <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-ink-secondary">
                <LockKey aria-hidden className="mt-0.5 size-4 shrink-0" />
                {dict.casePage.escalationLockedWhy}
              </p>
            ) : !letter ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={generateLetter}
                  disabled={letterBusy}
                  className="inline-flex min-h-12 items-center gap-2 rounded-control bg-accent px-5 text-sm font-bold text-onaccent hover:bg-accent-strong disabled:opacity-70"
                >
                  <FileText aria-hidden className="size-4" weight="fill" />
                  {letterBusy ? dict.casePage.preparingLetter : dict.casePage.generateLetter}
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {letterMode === "fallback" && (
                  <p className="rounded-control bg-sunken px-3 py-2 text-xs text-ink-secondary">
                    {dict.intake.fallbackNotice}
                  </p>
                )}
                <label htmlFor="letter-subject" className="block text-xs font-semibold">
                  Subject
                </label>
                <input
                  id="letter-subject"
                  type="text"
                  value={letter.subject}
                  onChange={(e) =>
                    setLetter((prev) => (prev ? { ...prev, subject: e.target.value } : prev))
                  }
                  className="w-full rounded-control border border-line bg-background px-3 py-2.5 text-sm font-semibold"
                />
                <label htmlFor="letter-body" className="block text-xs font-semibold">
                  {dict.casePage.letterEditableNote}
                </label>
                <textarea
                  id="letter-body"
                  rows={16}
                  value={letter.body}
                  onChange={(e) =>
                    setLetter((prev) => (prev ? { ...prev, body: e.target.value } : prev))
                  }
                  className="w-full resize-y rounded-control border border-line bg-background px-3 py-2.5 text-sm leading-relaxed"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyLetter}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-line bg-background px-3.5 text-xs font-bold hover:border-accent hover:text-accent"
                  >
                    {copied ? (
                      <CheckCircle aria-hidden className="size-4 text-ok" weight="fill" />
                    ) : (
                      <Copy aria-hidden className="size-4" />
                    )}
                    {copied ? dict.casePage.copied : dict.casePage.copy}
                  </button>
                  <button
                    type="button"
                    onClick={downloadLetter}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-line bg-background px-3.5 text-xs font-bold hover:border-accent hover:text-accent"
                  >
                    <Download aria-hidden className="size-4" />
                    {dict.casePage.download}
                  </button>
                  <button
                    type="button"
                    onClick={generateLetter}
                    disabled={letterBusy}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-line bg-background px-3.5 text-xs font-bold hover:border-accent hover:text-accent disabled:opacity-70"
                  >
                    {dict.casePage.regenerate}
                  </button>
                </div>
                <p className="text-xs text-ink-secondary">
                  {dict.app.notLegalAdvice}
                </p>
              </div>
            )}

            {letterError && (
              <p role="alert" className="mt-3 rounded-control border border-bad/50 bg-bad/10 p-3 text-sm">
                {dict.casePage.letterError}
              </p>
            )}
          </section>

          <section className="rounded-card border border-line bg-sunken p-5">
            <h2 className="text-sm font-bold">{context.addressedTo.split("/")[0].trim()}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-ink-secondary">
              {context.furtherOptions.map((opt) => (
                <li key={opt.url}>
                  <a
                    href={opt.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline decoration-line underline-offset-2 hover:text-ink"
                  >
                    {lookupMessage(dict, opt.nameKey) ?? opt.nameKey}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </article>
  );
}

function entryKind(kind: string): string {
  return kind.replace(/-/g, "_");
}

type Systemish = Pick<CaseRecord, "system" | "railwaySubflow">;

function systemNameKey(c: Systemish): "nch_name" | "epfo_name" | "railmadad_name" | "tdr_name" {
  if (c.system !== "railways") return `${c.system}_name` as "nch_name" | "epfo_name";
  return c.railwaySubflow === "tdr" ? "tdr_name" : "railmadad_name";
}

function systemWithTagKey(
  c: Systemish
): "nch_with" | "epfo_with" | "railmadad_with" | "tdr_with" {
  if (c.system !== "railways") return `${c.system}_with` as "nch_with" | "epfo_with";
  return c.railwaySubflow === "tdr" ? "tdr_with" : "railmadad_with";
}

function lookupFieldLabel(dict: ReturnType<typeof useApp>["dict"], key: string): string {
  return (dict.fields as Record<string, string>)[key] ?? key;
}
