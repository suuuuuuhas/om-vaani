"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListenButton } from "@/components/voice/listen-button";
import {
  ArrowLeft,
  CheckCircle,
  CircleNotch,
  ImageSquare,
  Receipt,
  Sparkle,
  Warning
} from "@phosphor-icons/react";
import { useApp } from "@/components/providers/app-provider";
import { getAdapter } from "@/lib/adapters";
import { TDR_POLICY, tdrDeadlineFromJourney } from "@/lib/adapters/railways";
import type {
  Attachment,
  CaseRecord,
  RailwaySubflow,
  SystemId,
  TriageResult
} from "@/lib/types";
import { generateCaseId } from "@/lib/utils/id";
import { makeSampleAttachment } from "@/data/attachments";
import type { Dictionary } from "@/lib/i18n";

type Fields = Record<string, string>;

function confidenceLabel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.45) return "medium";
  return "low";
}

export function ReviewClient() {
  const router = useRouter();
  const { dict, locale, store, addCase } = useApp();

  const [system, setSystem] = useState<SystemId | null>(null);
  const [subflow, setSubflow] = useState<RailwaySubflow | undefined>(undefined);
  const [fields, setFields] = useState<Fields>({});
  const [originalText, setOriginalText] = useState("");
  const [withReceipt, setWithReceipt] = useState(false);
  const [withScreenshot, setWithScreenshot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draft = store?.draft ?? null;
  const triage: TriageResult | null = draft?.triage ?? null;

  // Initialize editable state once the draft arrives from the intake page.
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const draftKey = triage ? `${draft?.text.slice(0, 40)}|${locale}` : null;
  if (triage && draftKey && initializedFor !== draftKey) {
    setInitializedFor(draftKey);
    setSystem(triage.system);
    setSubflow(triage.railwaySubflow);
    setFields({ ...triage.extractedFields });
    setOriginalText(draft?.text ?? "");
  }

  const adapter = system ? getAdapter(system) : null;

  const missingKeys = useMemo(() => {
    if (!adapter) return [];
    return adapter.fieldKeys.filter(
      (k) => !fields[k] || fields[k].trim() === ""
    );
  }, [adapter, fields]);

  function updateField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function buildAttachments(): Attachment[] {
    const list: Attachment[] = [];
    if (withReceipt) {
      list.push(
        makeSampleAttachment("receipt", {
          amount: fields.amount ?? "-",
          date: fields.purchaseDate ?? fields.journeyDate ?? "-",
          reference: fields.orderNumber ?? fields.transactionId ?? "-"
        })
      );
    }
    if (withScreenshot) {
      list.push(
        makeSampleAttachment("screenshot", {
          status: "Submitted (simulated)",
          reference: "-",
          date: new Date().toLocaleDateString()
        })
      );
    }
    return list;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!triage || !system || !adapter || !store || !draft) return;
    setSubmitting(true);
    setError(null);

    try {
      const now = new Date();
      const isTdr = system === "railways" && subflow === "tdr";
      const deadline = isTdr ? tdrDeadlineFromJourney(fields.journeyDate, now) : null;

      const record: CaseRecord = {
        id: generateCaseId(now, (id) =>
          store.cases.some((c) => c.id === id)
        ),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        originalText: originalText.trim(),
        locale,
        system,
        railwaySubflow: system === "railways" ? subflow : undefined,
        triage,
        fields: Object.fromEntries(
          Object.entries(fields).filter(([, v]) => v && v.trim())
        ),
        attachments: buildAttachments(),
        statusCode: "submitted",
        referenceNumber: adapter.mockSubmit(fields, subflow).referenceNumber,
        expectedResponseDays: isTdr ? 4 : adapter.expectedResponseDays,
        timeline: [
          {
            isoDate: now.toISOString(),
            kind: "submitted",
            reference: "-"
          }
        ],
        policy: isTdr ? TDR_POLICY : adapter.policy,
        filingDeadlineAt: deadline?.deadlineAt
      };

      addCase(record);
      router.push("/dashboard");
    } catch {
      setError(dict.review.submitError);
      setSubmitting(false);
    }
  }

  if (!store || (draft === null && !initializedFor)) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        {store === null ? (
          <p role="status">{dict.intake.aiLoading}</p>
        ) : (
          <>
            <h1 className="text-2xl font-bold">{dict.review.missingDraftTitle}</h1>
            <p className="mt-2 text-sm text-ink-secondary">{dict.review.missingDraftBody}</p>
            <Link
              href="/"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-control bg-accent px-4 text-sm font-bold text-onaccent hover:bg-accent-strong"
            >
              <ArrowLeft aria-hidden className="size-4" weight="bold" />
              {dict.review.backHome}
            </Link>
          </>
        )}
      </div>
    );
  }

  const conf = triage ? confidenceLabel(triage.confidence) : "low";

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 pt-2 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-8">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-strong"
          >
            <ArrowLeft aria-hidden className="size-3.5" weight="bold" />
            {dict.casePage.backToDashboard}
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
            {dict.review.title}
          </h1>
        </div>

        {triage && (
          <section
            aria-labelledby="triage-heading"
            className="rounded-card border border-line bg-surface p-5"
          >
            <h2 id="triage-heading" className="text-base font-bold">
              {dict.review.triageHeading}
            </h2>
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-[6px] bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">
              <Sparkle aria-hidden className="size-3.5" weight="fill" />
              {draft?.mode !== "fallback" ? dict.intake.modeAi : dict.intake.modeFallback}
            </p>
            {draft?.mode === "fallback" && (
              <p className="mt-2 rounded-control bg-sunken px-3 py-2 text-xs text-ink-secondary">
                {dict.intake.fallbackNotice}
              </p>
            )}
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                  {dict.review.summaryHeading}
                </dt>
                <dd className="mt-1 leading-relaxed">{triage.summary}<ListenButton text={triage.summary} locale={draft?.mode === "gemini" ? draft.voiceLanguage ?? locale : locale} autoPlay={Boolean(draft?.voiceLanguage)} /></dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                  {dict.confidence[conf]}
                </dt>
                <dd className="mt-1">
                  <div
                    role="meter"
                    aria-valuenow={Math.round(triage.confidence * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={dict.confidence[conf]}
                    className="h-2 w-full max-w-56 overflow-hidden rounded-full bg-sunken"
                  >
                    <div
                      className={`h-full rounded-full ${conf === "low" ? "bg-warn" : "bg-accent"}`}
                      style={{ width: `${Math.round(triage.confidence * 100)}%` }}
                    />
                  </div>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                  {dict.review.disclaimerHeading}
                </dt>
                <dd className="mt-1 text-xs leading-relaxed text-ink-secondary">
                  {triage.disclaimer}
                </dd>
              </div>
            </dl>
          </section>
        )}

        <section aria-labelledby="correct-heading" className="rounded-card border border-line bg-surface p-5">
          <h2 id="correct-heading" className="text-base font-bold">
            {dict.review.correctHeading}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
            {dict.review.correctPrompt}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="system-select" className="block text-xs font-semibold">
                {dict.review.systemLabel}
              </label>
              <select
                id="system-select"
                value={system ?? ""}
                onChange={(e) => {
                  const next = e.target.value as SystemId;
                  setSystem(next);
                  if (next !== "railways") setSubflow(undefined);
                  else setSubflow("railmadad");
                }}
                className="mt-1.5 min-h-11 w-full rounded-control border border-line bg-background px-3 text-sm"
              >
                <option value="nch">{dict.systems.nch_name}</option>
                <option value="epfo">{dict.systems.epfo_name}</option>
                <option value="railways">{dict.systems.railmadad_name}</option>
              </select>
            </div>
            {system === "railways" && (
              <div>
                <label htmlFor="subflow-select" className="block text-xs font-semibold">
                  {dict.review.subflowLabel}
                </label>
                <select
                  id="subflow-select"
                  value={subflow ?? "railmadad"}
                  onChange={(e) => setSubflow(e.target.value as RailwaySubflow)}
                  className="mt-1.5 min-h-11 w-full rounded-control border border-line bg-background px-3 text-sm"
                >
                  <option value="railmadad">{dict.systems.railmadad_name}</option>
                  <option value="tdr">{dict.systems.tdr_name}</option>
                </select>
              </div>
            )}
          </div>
        </section>

        {adapter && (
          <section aria-labelledby="fields-heading" className="rounded-card border border-line bg-surface p-5">
            <h2 id="fields-heading" className="text-base font-bold">
              {dict.review.fieldsHeading}
            </h2>
            <p className="mt-1 text-xs text-ink-secondary">{dict.review.fieldsHint}</p>

            {missingKeys.length > 0 && (
              <div className="mt-4 rounded-control bg-sunken p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-bold">
                  <Warning aria-hidden className="size-4 text-warn" weight="fill" />
                  {dict.review.missingHeading}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                  {missingKeys.map((k) => (
                    <li key={k} className="rounded-[6px] bg-surface px-2 py-0.5 font-medium">
                      {lookupFieldLabel(dict, k)}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-ink-secondary">{dict.review.missingBody}</p>
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {adapter.fieldKeys.map((key) => (
                <div key={key}>
                  <label htmlFor={`field-${key}`} className="block text-xs font-semibold">
                    {lookupFieldLabel(dict, key)}
                  </label>
                  <input
                    id={`field-${key}`}
                    type="text"
                    value={fields[key] ?? ""}
                    onChange={(e) => updateField(key, e.target.value)}
                    aria-describedby={
                      key in dict.fieldHints ? `hint-${key}` : undefined
                    }
                    className="mt-1.5 min-h-11 w-full rounded-control border border-line bg-background px-3 text-sm focus:border-accent"
                  />
                  {key in dict.fieldHints && (
                    <p id={`hint-${key}`} className="mt-1 text-xs text-ink-secondary">
                      {dict.fieldHints[key as keyof typeof dict.fieldHints]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="attachments-heading" className="rounded-card border border-line bg-surface p-5">
          <h2 id="attachments-heading" className="text-base font-bold">
            {dict.review.attachmentsHeading}
          </h2>
          <p className="mt-1 text-xs text-ink-secondary">{dict.review.attachmentsHint}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              role="checkbox"
              aria-checked={withReceipt}
              onClick={() => setWithReceipt((v) => !v)}
              className={`flex items-start gap-3 rounded-card border p-3.5 text-left ${
                withReceipt ? "border-accent bg-accent-soft" : "border-line bg-background hover:border-accent"
              }`}
            >
              {withReceipt ? (
                <CheckCircle aria-hidden className="size-5 shrink-0 text-ok" weight="fill" />
              ) : (
                <Receipt aria-hidden className="size-5 shrink-0 text-ink-secondary" />
              )}
              <span>
                <span className="block text-sm font-semibold">{dict.review.attachReceipt}</span>
                <span className="block text-xs text-ink-secondary">{dict.review.receiptName}</span>
              </span>
            </button>
            <button
              type="button"
              role="checkbox"
              aria-checked={withScreenshot}
              onClick={() => setWithScreenshot((v) => !v)}
              className={`flex items-start gap-3 rounded-card border p-3.5 text-left ${
                withScreenshot ? "border-accent bg-accent-soft" : "border-line bg-background hover:border-accent"
              }`}
            >
              {withScreenshot ? (
                <CheckCircle aria-hidden className="size-5 shrink-0 text-ok" weight="fill" />
              ) : (
                <ImageSquare aria-hidden className="size-5 shrink-0 text-ink-secondary" />
              )}
              <span>
                <span className="block text-sm font-semibold">{dict.review.attachScreenshot}</span>
                <span className="block text-xs text-ink-secondary">{dict.review.screenshotName}</span>
              </span>
            </button>
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <details className="rounded-card border border-line bg-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            {dict.review.originalHeading}
          </summary>
          <label htmlFor="original-text" className="mt-3 block text-xs font-semibold">
            {dict.review.originalEditLabel}
          </label>
          <textarea
            id="original-text"
            rows={7}
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            className="mt-1.5 w-full resize-y rounded-control border border-line bg-background px-3 py-2 text-sm leading-relaxed"
          />
        </details>

        {error && (
          <p role="alert" className="rounded-control border border-bad/50 bg-bad/10 p-3 text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !system}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-accent px-5 text-sm font-bold text-onaccent hover:bg-accent-strong disabled:opacity-70"
        >
          {submitting ? (
            <>
              <CircleNotch aria-hidden className="size-4 animate-spin" />
              {dict.review.submitting}
            </>
          ) : (
            dict.review.submit
          )}
        </button>
      </aside>
    </form>
  );
}

export function lookupFieldLabel(dict: Dictionary, key: string): string {
  return (dict.fields as Record<string, string>)[key] ?? key;
}
