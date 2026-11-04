"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CircleNotch,
  FileText,
  ShieldCheck,
  UserCircle,
  Warning
} from "@phosphor-icons/react";
import { useApp } from "@/components/providers/app-provider";
import { fallbackTriage } from "@/lib/ai/fallback/triage";
import { lookupMessage } from "@/lib/i18n";
import type { ExecutionMode, TriageResult } from "@/lib/types";
import { checkSensitiveContent } from "@/lib/privacy/guard";
import { VaaniSaty } from "@/components/voice/vaani-saty";

const MAX_CHARS = 4000;

export function IntakeSection() {
  const router = useRouter();
  const { dict, locale, saveDraft, store } = useApp();

  const [text, setText] = useState("");
  const [aiConsent, setAiConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState<string | undefined>();
  const [status, setStatus] = useState<
    "idle" | "loading" | "blocked" | "error"
  >("idle");
  const [findings, setFindings] = useState<string[]>([]);

  const examples = [
    dict.intake.example1,
    dict.intake.example2,
    dict.intake.example3
  ];

  const privacyItems = [
    dict.intake.privacyAadhaar,
    dict.intake.privacyPan,
    dict.intake.privacyOtp,
    dict.intake.privacyPassword,
    dict.intake.privacyCvv,
    dict.intake.privacyBank
  ];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!aiConsent) { setConsentError(true); return; }
    const trimmed = text.trim();
    if (trimmed.length < 40) {
      setStatus("blocked");
      setFindings(["intake.minChars"]);
      return;
    }

    // Browser-side privacy gate - runs before anything leaves the page.
    const guard = checkSensitiveContent(trimmed);
    if (!guard.ok) {
      setStatus("blocked");
      setFindings(guard.findings.map((f) => f.messageKey));
      return;
    }

    setStatus("loading");
    let triage: TriageResult;
    let mode: ExecutionMode;
    try {
      const response = await fetch("/api/ai/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, locale, voiceLanguage })
      });
      if (response.status === 422) {
        const body = (await response.json()) as {
          findings?: Array<{ messageKey: string }>;
        };
        setStatus("blocked");
        setFindings((body.findings ?? []).map((f) => f.messageKey));
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as {
        data: TriageResult;
        mode: ExecutionMode;
      };
      triage = body.data;
      mode = body.mode;
    } catch {
      // API unreachable or keyless deployment: deterministic local fallback.
      triage = fallbackTriage(trimmed, locale);
      mode = "fallback";
    }

    saveDraft({ text: trimmed, locale, voiceLanguage, triage, mode });
    router.push("/review");
  }

  return (
    <section className="intake-layout grid gap-10 pt-4 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
      <div className="intake-intro max-w-xl">
        <p className="mb-3 inline-flex items-center gap-2 rounded-control bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-strong">
          <UserCircle aria-hidden className="size-4" weight="fill" />
          {(dict.demo.activeAs ?? "").replace(
            "{name}",
            store?.profile.displayName ?? "Aarav"
          )}
        </p>
        <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          {dict.intake.heading}
        </h1>
        <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-ink-secondary">
          {dict.intake.subheading}
        </p>

        <ul className="mt-6 space-y-2 text-sm text-ink-secondary">
          {[
            `${dict.demo.note}`,
            `${dict.app.notLegalAdvice}`
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-ok" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={handleSubmit} noValidate className="min-w-0">
        <VaaniSaty onTranscript={(transcript, language) => { setVoiceLanguage(language ?? undefined); setText((previous) => [previous.trim(), transcript].filter(Boolean).join(" ").slice(0, MAX_CHARS)); }} />
        <div className="rounded-card border border-line bg-surface p-5 shadow-sm md:p-6">
          <label className="mb-4 flex items-start gap-2 text-xs leading-relaxed"><input type="checkbox" checked={aiConsent} onChange={e => setAiConsent(e.target.checked)} className="mt-0.5" /><span>{locale === "hi" ? "मैं AI विश्लेषण के लिए अपना लिखित विवरण Google Gemini को भेजने की सहमति देता/देती हूँ। मेरा ड्राफ्ट इसी ब्राउज़र में रहता है।" : locale === "te" ? "AI విశ్లేషణ కోసం నా వ్రాత వివరణను Google Geminiకి పంపడానికి అంగీకరిస్తున్నాను. నా డ్రాఫ్ట్ ఈ బ్రౌజర్‌లో ఉంటుంది." : "I agree to send my written description to Google Gemini for AI analysis. My draft stays in this browser."}</span></label>
          {consentError && !aiConsent && <p role="alert" className="mb-3 text-xs text-bad">{locale === "hi" ? "आगे बढ़ने से पहले AI प्रोसेसिंग के लिए सहमति दें।" : locale === "te" ? "కొనసాగడానికి ముందు AI ప్రాసెసింగ్‌కు అంగీకరించండి." : "Please agree to AI processing before continuing."}</p>}
          <label htmlFor="grievance" className="block text-sm font-semibold">
            {dict.intake.textLabel}
          </label>
          <p id="grievance-hint" className="mt-1 text-xs text-ink-secondary">
            {dict.intake.textHint}
          </p>
          <textarea
            id="grievance"
            aria-describedby="grievance-hint grievance-count"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
            placeholder={dict.intake.placeholder}
            rows={6}
            maxLength={MAX_CHARS}
            disabled={status === "loading"}
            className="mt-2 w-full resize-y rounded-control border border-line bg-background px-3 py-2.5 text-sm leading-relaxed min-h-32 focus:border-accent"
          />
          <p id="grievance-count" className="mt-1 text-right text-xs text-ink-secondary">
            {(dict.intake.charCount ?? "{n} / 4000").replace("{n}", String(text.length))}
          </p>

          <fieldset className="mt-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              {dict.intake.examplesLabel}
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {examples.map((example, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setText(example)}
                  disabled={status === "loading"}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-line bg-background px-3 text-xs font-medium hover:border-accent hover:text-accent"
                >
                  <FileText aria-hidden className="size-4" />
                  {`${i + 1}`}
                  <span className="sr-only">{example.slice(0, 40)}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-5 rounded-control border border-warn/40 bg-warn/10 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-bold">
              <Warning aria-hidden className="size-4 text-warn" weight="fill" />
              {dict.intake.privacyTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
              {dict.intake.privacyBody}
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium">
              {privacyItems.map((item) => (
                <li key={item} className="rounded-[6px] bg-surface px-2 py-0.5">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {status === "blocked" && findings.length > 0 && (
            <div
              role="alert"
              className="mt-4 rounded-control border border-bad/50 bg-bad/10 p-3.5 text-sm"
            >
              <p className="font-bold">{dict.intake.blockedTitle}</p>
              <p className="mt-1 text-xs text-ink-secondary">{dict.intake.blockedBody}</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
                {findings.map((key) => (
                  <li key={key}>{lookupMessage(dict, key) ?? key}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-accent px-5 text-sm font-bold text-onaccent hover:bg-accent-strong disabled:opacity-70 sm:w-auto"
          >
            {status === "loading" ? (
              <>
                <CircleNotch aria-hidden className="size-4 animate-spin" />
                {dict.intake.submitting}
              </>
            ) : (
              <>
                {dict.intake.submit}
                <ArrowRight aria-hidden className="size-4" weight="bold" />
              </>
            )}
          </button>

          {status === "loading" && (
            <p role="status" className="mt-3 text-xs text-ink-secondary">
              {dict.intake.aiLoading}
            </p>
          )}
          {status === "error" && (
            <div role="alert" className="mt-4 rounded-control border border-line bg-sunken p-3.5 text-sm">
              <p className="font-bold">{dict.intake.aiErrorTitle}</p>
              <p className="mt-1 text-xs text-ink-secondary">{dict.intake.aiErrorBody}</p>
            </div>
          )}
        </div>
      </form>
    </section>
  );
}
