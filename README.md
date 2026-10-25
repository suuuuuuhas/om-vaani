# Om Vaani — Gnani voice complaint assistant

A Phase 1 implementation of `docs/original-plan.md`, named Om Vaani (ॐ वाणी, voice). Speak or type a consumer issue, answer short follow-ups, review a read-back, explicitly confirm, then receive an English complaint draft, a spoken reply, and a private lookup reference. The draft is never sent to authorities or companies automatically.

## Hosted app

Production: https://om-vaani.vercel.app, in the approved Vercel team `suhas-projects13`. The FastAPI function runs in Mumbai (`bom1`), using the new free Om Vaani Supabase project in Mumbai (`ap-south-1`). Cloud draft persistence, shared rate limits, per-session leases, private audio signed links and lookup have been verified. The separate Gnani STT, Gnani TTS and Gemini keys are saved in the ignored local key file and encrypted Vercel production variables. The live page reports keys configured. The complete hosted synthetic Telugu voice-to-draft flow has passed. The original combined reply took about 15 seconds; the browser now shows text before audio. See docs/latency-results.json for the latest measured flow. To update keys and redeploy:

```powershell
.\.venv\Scripts\python.exe scripts/configure_vercel.py
vercel deploy --prod --yes --scope suhas-projects13
.\.venv\Scripts\python.exe scripts/smoke_flow.py --base-url https://om-vaani.vercel.app
```

The upload script sends values through stdin and prints only setting names. Vercel stores production settings as sensitive server variables. The local credential form is disabled on Vercel. The hosted browser flow supports voice and text; the WhatsApp webhook explicitly returns 503 until a hosted durable queue is implemented. Local WhatsApp support remains available for the deferred test-number connection.

The browser now requests text first and loads the voice reply separately. You can respond while speech is being generated. Each speech request is bound to its original turn, so later messages cannot change what that audio says. Provider connections are reused for the lifetime of an app event loop, and API responses include stage timings for diagnosis. Existing API clients and the local WhatsApp adapter retain the combined text/audio behavior unless they request `defer_speech`.

## Work from anywhere

The source includes a Python 3.12 dev-container configuration for GitHub Codespaces. Tests run without production keys. See [cloud development](docs/cloud-development.md) for browser development, another-laptop setup, credential handling and deployment. Private source repository: https://github.com/suuuuuuhas/om-vaani. Open it on any computer, or launch a browser workspace at https://codespaces.new/suuuuuuhas/om-vaani.

Vercel requests accept audio up to 3 MB and 60 seconds. A bundled ffmpeg fallback decodes audio in temporary storage. No local SQLite database or infinite background worker is started there. Existing laptop drafts are not automatically migrated.

## Run on this Windows laptop

Requires Python 3.11+ and `ffmpeg` on PATH. This workspace has Python 3.12 and ffmpeg available.

```powershell
cd C:\Users\Admin\Documents\ChatGPT\OM
.\scripts\start.ps1
```

Open **http://127.0.0.1:8000/setup** in Chrome. Enter Gnani and Gemini keys and save. Keys are written into ignored `.env.keys.local`; blank fields preserve existing values. They are never returned through setup or public configuration APIs. Configuration is reloaded for each provider request, so saving keys does not require restarting.

Separate Gnani keys are supported: use `GNANI_STT_API_KEY` for Prisma and `GNANI_TTS_API_KEY` for Timbre. Set `GEMINI_API_KEY` for understanding. An optional shared `GNANI_API_KEY` is a fallback only; each specific key takes precedence for its own service.

Settings load `.env`, then `.env.keys.local`, with actual environment variables taking precedence. Keeping setup credentials separate prevents a stale `.env` editor from erasing them. Do not overwrite `.env.keys.local` with the empty template.

Open **http://127.0.0.1:8000/** for the assistant and **http://127.0.0.1:8000/status** for lookup. Select a language explicitly. Telugu is the configurable default, not a claim that Telugu has passed speech quality evaluation. All ten languages shared by the current Prisma and Timbre APIs are selectable.

The local setup API is restricted to loopback requests, checks the Host and Origin, rejects forwarded requests and does not enable CORS. Keep `--no-proxy-headers` when running the app. Access logs are disabled because the compatibility lookup route accepts a phone suffix in its query. The website uses POST for lookup instead.

## Providers and plan changes

- Prisma: `POST https://api.vachana.ai/stt/v3`, `X-API-Key-ID`, multipart `audio_file`, BCP-47 `language_code`, ITN `format=transcribe`. Native OGG is supported. We still decode inputs with ffmpeg into 16 kHz mono WAV to validate duration and accept browser WebM recordings. Inputs over 60 seconds are rejected, never silently truncated.
- Timbre: `POST https://api.vachana.ai/api/v1/tts/inference`, `X-API-Key-ID`. The default is current `timbre-v3.0`, voice `Shivani`, with one voice supporting all ten languages. The REST endpoint can return OGG/Opus directly; no outbound re-encoding is necessary. Model and voice are environment-configurable and must be a matching pair.
- Gemini: the plan proposed `gemini-3.8-flash` through Interactions with `thinking_level=low` and `store=false`. Live checks on this laptop found repeated 3.8 timeouts/service errors. The local `.env` and defaults now use verified `gemini-3.6-flash` with `GEMINI_API_MODE=generate_content`, low thinking, and structured JSON through Google's supported generateContent endpoint. Both transports stay behind one `llm_next_turn()` function. You can set `GEMINI_MODEL=gemini-3.8-flash` and `GEMINI_API_MODE=interactions` to recheck 3.8 later. Provider data terms apply to either transport; generateContent has no Interactions `store` flag. Transient gateway errors receive at most one retry. A 429 asks the user to wait instead of repeatedly retrying against the rate limit.
- Draft body: rendered from the confirmed structured facts, instead of trusting the model to add formal legal assertions. Field values are requested in English, while read-backs and follow-ups use the selected language. Unknown details remain visibly missing.
- SQLite is the immediate local store. Hosted requests use the selected Om Vaani Supabase project through a server-only key; no browser key can read the private tables.
- Draft references use ten random characters, extending the plan's short example. The phone suffix remains a weak shared secret, so rate limiting and generic errors are applied. This is suitable for a test-number prototype, not strong identity verification for sensitive public deployments.
- The core engine has an explicit allowlist for unqualified confirmation in the supported languages. A model-generated `confirmation=yes` cannot finalize a complaint. If the user corrects a read-back, the revised state needs another explicit yes.
- After four follow-up questions, available details can be confirmed with missing details labelled. Unsupported/unknown categories are never turned into a completed complaint automatically.
- Fraud warning happens before normal intake whenever local signals match, with a second semantic check in Gemini for other phrasing. It is a best-effort safeguard, not guaranteed fraud detection. The user can continue drafting after taking urgent reporting steps.

## WhatsApp test-number connection

Use your existing Meta app and test phone number. In `/setup`, save:

1. Access token (`WHATSAPP_TOKEN`). Temporary development tokens expire; refresh them when needed.
2. Business phone number ID (`WHATSAPP_PHONE_NUMBER_ID`), not the displayed phone number.
3. Meta app secret (`WHATSAPP_APP_SECRET`) for HMAC webhook validation.
4. An operator-chosen random `WHATSAPP_VERIFY_TOKEN` matching the webhook configuration.
5. Displayed test number, including country code (`WHATSAPP_DISPLAY_NUMBER`), for the `wa.me` link.
6. A chosen public HTTPS base URL (`PUBLIC_BASE_URL`).

The adapter uses Graph API `v26.0` by default; override `WHATSAPP_GRAPH_VERSION` if your app uses another supported version. Meta's current media docs show v26.0 examples. The worker is intentionally one process; do not run multiple Uvicorn workers against the same inbox.

After choosing a public tunnel, point it at `http://127.0.0.1:8000`. For an installed/authenticated ngrok CLI, the command is:

```powershell
ngrok http 8000
```

No tunnel is installed or started automatically. A tunnel exposes the app publicly; confirm the intended URL/account before connecting it. Save that URL in setup, configure `https://YOUR-HOST/whatsapp/webhook`, supply the matching verify token and subscribe to `messages`. Keep the server and tunnel running. Add the intended recipients in Meta's test-number setup before they send messages.

The user opens the conversation. Send `START`, select a language if needed, then `CONTINUE` to consent to provider processing. This extra consent step prevents the first voice note from being sent to providers before disclosure. Send the complaint again after consenting.

Commands: `language te`, `language hi`, `language en`, `language ta`, `language kn`, `language ml`, `language mr`, `language bn`, `language gu`, `language pa`; `STATUS`; a draft reference; `NEW`; `STOP`.

The signed webhook persists messages before returning 200. A durable local inbox deduplicates message IDs and resumes pending jobs after restart. Replies are split below WhatsApp's text-size limit. Mono OGG/Opus audio is uploaded and sent as an audio message. The worker refuses expired messages and does not broadcast or send unsolicited messages. Completion logs include latency only, without phone numbers or message bodies.

Delivery is at-least-once across a process crash at Meta's network acknowledgement boundary: a reply can duplicate if the process dies after Meta accepts it but before the local progress checkpoint is saved. Provider-side exactly-once delivery is not claimed. After five processing failures, the job is marked failed and a user-facing retry notice is attempted.

## Supabase (optional while developing locally)

Choose the intended project, run `supabase/schema.sql` in its SQL editor, then save the project URL and server secret in local setup and choose Supabase. Use `sb_secret_...` or a legacy `service_role` JWT, never a public/publishable/anon key. The new secret key is passed in `apikey`, not as a JWT. Database tables have RLS enabled and public client access revoked. A single RPC atomically saves the session, complaint and initial status event.

The migration creates private bucket `complaint-audio`. Audio is accessed with one-hour signed URLs. Configure object cleanup in the selected project: signed URL expiry does not remove objects. Switching SQLite/Supabase does not migrate existing records. The durable WhatsApp inbox remains local, so preserve `data/` if moving the server. Cloud deployment needs persistent disk for this inbox or a separate durable queue implementation.

## Data and security boundaries

- Raw incoming audio is decoded in a temporary directory and removed after transcription. Generated local audio has unguessable names and expires after an hour; old generated files are removed when another reply is saved.
- Local sessions, transcripts and drafts remain in ignored `data/complaints.sqlite3` until removed by the operator. Use synthetic/test complaints while developing. No deletion or retention promise is made for third-party providers.
- The app does not collect Aadhaar, OTPs, account passwords or bank account numbers as intake fields. User-written messages can still contain sensitive data; avoid sending such details.
- Web sessions have independent bearer tokens; a session UUID alone does not authorize turns. Tokens stay in page memory. Reloading starts a new conversation; saved drafts remain available through lookup.
- Status lookup omits phone, authentication hashes, internal state and raw transcripts. It displays only the confirmed draft, routing and local timeline.
- The current timeline records draft readiness. It does not poll government portals and has no official case status. Status-change management and accounts are outside Phase 1.
- API keys and data are ignored by Git. The server never exposes a route to retrieve key values. Local setup is a convenience for the trusted laptop operator, not a remote admin portal.
- Shared cloud rate limits and per-session leases are implemented. Wider public use still needs stronger lookup authorization than last four digits, retention/deletion controls, additional abuse controls, and a durable hosted queue for WhatsApp. This deployment is a prototype.

## Test and evaluate

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
node --check web/app.js
node --check web/status.js
node --check web/setup.js
```

Tests mock provider network calls and use temporary databases. They verify engine confirmation/corrections, missing values, category routing, keyword and semantic fraud branches, duplicate/concurrent confirmation, privacy, lookup throttling, webhook HMAC/deduplication, expiry, WhatsApp consent/restart, actual ffmpeg duration checks, and adapter request/response contracts. They do not establish provider availability or real speech quality.

After saving keys, these commands use provider credits:

```powershell
.\.venv\Scripts\python.exe scripts/smoke_gnani.py --language te-IN
.\.venv\Scripts\python.exe scripts/evaluate_intake.py
.\.venv\Scripts\python.exe scripts/smoke_flow.py
```

The smoke test produces an OGG file and a Prisma transcript from synthetic Timbre speech in ignored `output/smoke/`. It is an integration check, not real-speaker acceptance. The intake evaluation runs twelve written transcripts across English and Telugu and writes `output/evaluation/intake.json`, recording measured model latency and checks for categories, amounts, unknown values and fraud. It spaces requests by 15 seconds for the development rate limit. Use `--resume` to retain passed cases and continue after a temporary provider error. Failed and partial runs are not counted as a completed evaluation.

`smoke_flow.py` exercises the running local HTTP API with synthetic Telugu speech: voice intake, missing-detail follow-up, explicit correction if a spoken date/amount was misrecognised, fresh confirmation, durable draft, protected lookup, and downloaded spoken replies. It uses test phone suffix `1234` and saves evidence in ignored `output/evaluation/`. It deliberately checks the extracted amount/date before confirming; a test must not blindly confirm a misheard value. A successful corrected flow does not mean initial transcription was accurate. Avoid running both live scripts simultaneously on a rate-limited Gemini key.

For real speech, record at least ten consenting samples for **each language claimed in the demo**, including quiet, noisy and English-mixed speech. Copy `docs/speech-manifest.example.json` into ignored `data/`, fill it with real file paths and exact human reference transcripts, and mark consent only when obtained:

```powershell
.\.venv\Scripts\python.exe scripts/evaluate_speech.py data/speech-manifest.json
```

The report records word errors and latency. Review amounts, dates, brands and references manually; whitespace-based WER has limitations across Indic languages. Adding all ten language choices does not mean all ten have passed this check. A real WhatsApp voice-note round trip and three consenting people trying the product are still required for the plan's acceptance criteria. The eight-second target must be measured end to end, not inferred from unit tests or provider marketing.

## Scope still gated

Phone calls, outbound calls, government/company portal submissions, social posting, new user-account creation, demo-video generation, and competition eligibility/deadline verification remain outside this build. Phone Phase 2 requires the user's separate confirmation. The original plan is preserved as input context, not treated as permission to publish or contact people.

See `docs/sources.md` for the official documentation checked and `docs/verification.md` for current verification status.
