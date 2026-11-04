# CivicBridge - submission summary and demo shot list

## Project summary (under 250 words)

CivicBridge is an independent hackathon prototype that solves one problem: citizens cannot reliably identify, prepare, track, and escalate grievances spread across fragmented systems. It covers three routes of a single journey - the National Consumer Helpline, EPFO, and Indian Railways (RailMadad plus IRCTC TDR refunds).

A citizen types the problem in English, Hindi, or Telugu. An AI triage service classifies it, extracts reference fields, and flags missing information; every service returns either live OpenAI output or clearly labeled deterministic offline rules, so the journey never breaks. The review step keeps the citizen in control: editable system-specific fields, confidence with correction controls, synthetic receipt/screenshot evidence, then a one-click submit that mints a case ID (CB-2026-#####) into browser-local storage seeded with five realistic demo cases.

The dashboard shows plain-language status, age, overdue tags, and a sourced "suggested next action" for each case. Case pages explain what a status means, cite the official source with its verification date, distinguish advisory guidance from official deadlines, and generate an editable escalation letter that can be copied or downloaded as UTF-8 text.

Safety first: Aadhaar, PAN, OTP, password, CVV, and bank credentials are blocked in both browser and server before any AI call, while synthetic PNR/UAN/order references pass. A persistent banner states this is an independent prototype using only synthetic data.

Codex-class AI assistance implemented the full stack under human direction: Next.js 15, Tailwind 4 design tokens, Zod-validated Responses API integration, adapter-based policy engine, and Vitest/Playwright/axe verification.

*(Word count: ~240)*

## Two-minute demo shot list

**Minute 1 - the complete citizen journey**

| Time | Shot | What to say |
|---|---|---|
| 0:00-0:10 | Landing page, point at persistent prototype banner | "Independent prototype - every citizen here is synthetic." |
| 0:10-0:20 | Toggle language to हिन्दी, then తెలుగు, back to English | Full UI copy in three languages. |
| 0:20-0:35 | Click safe example 1 (consumer refund), click Identify | Progressive AI state, then review page with summary + confidence. |
| 0:35-0:50 | Edit a field, correct the system dropdown if you like, toggle sample receipt, submit | "Citizen stays in control of every field." |
| 0:50-1:00 | Dashboard lands: new CB-2026-#####, status chip, age, next-action column | Five seeded cases show unresolved, overdue, unsatisfactory, TDR deadline, fresh. |

**Minute 2 - depth: architecture, AI contribution, safety**

| Time | Shot | What to say |
|---|---|---|
| 1:00-1:15 | Open overdue NCH case: timeline + "What this status means" | Status explanation service; offline fallback badge when no key. |
| 1:15-1:30 | Suggested next action card: Advisory badge, source link, verified date | Policies are source-backed; NCH 30-day expectation verified on the official page. |
| 1:30-1:45 | Prepare letter -> edit -> Copy -> Download .txt | Editable escalation letter, UTF-8 download, nothing leaves the browser. |
| 1:45-1:55 | Quick cut: intake typing an Aadhaar number -> blocked panel; then code view of `src/lib/adapters` + `src/lib/ai` | Dual privacy gates; SystemAdapter pattern per system with trigger type + official/advisory flag. |
| 1:55-2:00 | End card on README architecture diagram | "OpenAI Responses API when a key exists, deterministic rules when it doesn't - the citizen journey always completes." |
