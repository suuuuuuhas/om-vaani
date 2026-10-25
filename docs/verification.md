# Verification status — 25 October 2026

## Deployment

- Production: https://om-vaani.vercel.app in `suhas-projects13/om-vaani`.
- Deployment `dpl_EtsVbRzNozjVhsJX4TvT2G7rThYk` is Ready. Python 3.12 FastAPI function, 45.14 MB, Mumbai (`bom1`).
- Free Supabase project Om Vaani (`eoquoljupognldeyrhos`), Mumbai. Schema and private audio bucket installed.
- All three AI keys are now saved in ignored .env.keys.local and encrypted Vercel production variables. The live page reports keys configured. The newer saved Gemini key is deployed and the full hosted synthetic Telugu complaint voice flow passes. Earlier keys hit daily project quota; that blocker is resolved for the current test.

## Passed

- 48 automated tests: confirmation/correction, draft flow, privacy, local persistence, provider wire contracts, separate STT/TTS keys, speech retry, audio duration validation, and local WhatsApp consent/deduplication/retries. Providers are mocked in unit tests.
- All three browser scripts pass Node syntax checks; Git whitespace check passes.
- Real cloud checks: session save/reload, atomic draft save, session lease exclusion/release, shared rate limit, generated OGG upload/download through a signed URL, and denied public table access. Provider calls were mocked for the synthetic storage draft. Evidence: `output/evaluation/cloud-storage.json`.
- Live Vercel HTTP checks: landing, health, config, status and assets return 200; local setup endpoints return 404; session creation returns 200; unauthorized turns and wrong phone suffix return 404. A synthetic cloud draft is retrievable through the live website. Deferred hosted WhatsApp returns 503. Evidence: `output/evaluation/vercel-http.json`.
- Chrome desktop and mobile visual checks pass. At the phone breakpoint document and viewport widths both measure 375 CSS px, with no horizontal overflow. Chrome loaded the saved cloud draft and its routing. Screenshots: `output/qa/vercel-desktop.png`, `output/qa/vercel-draft.png`.
- Previous live laptop provider checks: real Timbre produced mono OGG Opus (48 kHz); Prisma transcribed the synthetic Telugu greeting. TTS took 4,281 ms; STT took 3,313 ms. Evidence: `output/smoke/te-IN.json`.
- Gemini 3.6 generateContent completed all 12 synthetic text intake cases, including the previously rate-limited final case. Gemini 3.8 produced repeated service errors/timeouts; defaults use verified 3.6. Evidence: `output/evaluation/intake.json`.
- A previous real local browser text flow produced a confirmed Telugu complaint draft with amount 2499 and date 2026-10-20, before the keys reverted to blank.
- Credentials, local data/output and Vercel link metadata are ignored by Git and excluded from upload. Setup now writes `.env.keys.local` so stale `.env` edits cannot erase saved keys.
- The initial deployment error-level log scan returned no logs. No independent monitoring or log drain has been configured.

- Hosted synthetic English urgent-fraud audio test returned HTTP 200, a 1930 warning, a spoken OGG reply, and a downloadable signed audio URL. Turn latency was 2,336 ms. Evidence: output/evaluation/vercel-fraud-voice.json. This does not establish normal Gemini-path latency or real-speaker accuracy.
- Daily quota errors now identify the daily limit rather than asking for a one-minute retry.

- Full hosted Telugu voice flow with the newer Gemini key passes: Prisma transcription, Gemini extraction, Timbre replies, explicit confirmation, durable draft save, correct-suffix lookup, wrong-suffix denial, and signed audio downloads. Draft reference GC-249E54JJ5G. Initial turn: 14,963 ms; confirmation: 6,853 ms. The eight-second intake target is not met. Evidence: output/evaluation/live-flow.json.
- Chrome loaded that voice-generated draft from the production status page. Evidence: output/qa/vercel-voice-draft.png.

- Text-first browser mode is deployed: reply text is returned before a separate authenticated speech request. Speech IDs bind audio to the original turn; new messages cannot change its content. Shared HTTP clients reuse connections within each app event loop. Server-Timing and stage metrics are available.
- Hosted intake measurements returned text in 6,928 ms and 5,485 ms for synthetic Telugu audio, and 3,961 ms for written English. Complete profiling was interrupted first by a missing spoken date, then by a local connection error and simultaneous TTS requests receiving HTTP 429. These are individual measurements, not a percentile benchmark.
- Gnani speech calls are now serialized within each app loop, with one bounded retry on HTTP 429; the browser also queues its audio requests. Final hosted queue validation is pending.
- Private source repository created at https://github.com/suuuuuuhas/om-vaani with a Codespaces dev-container configuration. Source push and remote hash verification are in progress. API keys, runtime data and Vercel link metadata remain excluded from Git.

## Outstanding

- Real speakers: ten recordings per demo language including noise/code mixing, and three consenting users. Synthetic speech is an integration check, not proof of human speech accuracy.
- The eight-second latency target has not been met consistently. A previous synthetic voice intake took 8,406 ms; some turns took longer. Synthetic date/amount transcription mistakes were observed, so review and explicit correction remain essential.
- Real Meta test-number text/voice exchange and durable hosted WhatsApp processing.
- Stronger lookup authentication, retention/deletion controls and broader abuse protection before wider public use. Signed-link expiry does not delete stored objects.

One benign dependency warning remains: Starlette TestClient deprecates its current httpx transport. All tests pass. No official complaints were submitted and no messages were sent to other people. Phase 2 calling and social publishing were not implemented.
