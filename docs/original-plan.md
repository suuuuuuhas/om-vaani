# Voice Complaint Filer: Build Plan

Hand this file to a coding agent. It is self-contained. Where something is marked **OPEN**, ask the user before deciding. Where something is marked **VERIFY**, check the official docs because details change.

---

## 1. What we are building

A voice-first complaint assistant for people who cannot easily write a formal complaint in English. The user speaks (or types) their problem in their own Indian language. The system understands it, asks short follow-up questions if details are missing, and produces a clear, formal, correctly categorised complaint draft, plus a spoken read-back in the user's language and a complaint ID they can use to check status later.

**Contest context:** Gnani AI's "Great Indian AI Internship Challenge". Hard rules:
- Must use Gnani's voice models: **Prisma** (speech to text) and **Timbre** (text to speech, beta). Docs and keys: app.gnani.ai (3 free API keys, 5,000 programme credits).
- Final demo is a **public video** on LinkedIn or X with hashtags `#GnaniAI` and `#GreatIndianAIInternshipChallenge`.
- Contest closes **10 Nov 2026**, no extensions. Target: post the demo by **3-5 Nov**.
- Selection depends on public engagement, so a clean, easy-to-understand demo matters as much as the code.
- Award categories this project can target: regional languages, code-mixed speech, real-world impact, Tier 2/3 towns, best solo project, best 60-second demo.

**Builder:** one student developer, working solo, about 16 days. Keep scope small and demoable.

---

## 2. Scope

### Phase 1 (build now)
1. **Core engine**: audio or text in, structured complaint out, spoken reply.
2. **WhatsApp channel**: user sends a voice note or text; bot replies with text and a voice note.
3. **Website**: status lookup page (and a simple landing page explaining the service).

### Phase 2 (later, only if Phase 1 is solid)
4. **Phone call channel**: website "Call me" button triggers an outbound call (Twilio or an Indian provider). Turn-based: record, process, play reply, repeat. Spec in section 12. **Do not start this until Phase 1 is done and the user confirms.**

### Out of scope
- Actually filing complaints into government or company portals. The product **drafts** complaints and says where to send them. UI and voice copy must say "ready to submit", never "filed" or "submitted".
- Legal advice. State that this is a drafting aid.
- Payments, user accounts, admin dashboards.

---

## 3. Architecture

```
WhatsApp (voice note/text) --\
Website (status page)  -------+--> FastAPI backend --> Postgres (Supabase)
(Phase 2) Phone call  -------/        |                 File storage (audio)
                                      |
                  Engine:  Prisma (STT) -> LLM (Gemini) -> Timbre (TTS)
```

One engine, thin channel wrappers. The engine must not know which channel called it.

**Engine contract:**
```python
handle_turn(session_id, input_text: str | None, input_audio: bytes | None, language: str)
  -> TurnResult(reply_text: str, reply_audio_url: str | None, complaint_state: dict, is_complete: bool)
```

---

## 4. Tech stack

| Part | Choice | Notes |
|---|---|---|
| Backend | Python 3.11+, FastAPI | Run locally with ngrok first; later Render/Railway free tier |
| Speech to text | Gnani **Prisma** | VERIFY: supported languages, accepted audio formats, file vs streaming, max duration |
| Text to speech | Gnani **Timbre** (beta) | VERIFY: voices per language, output format, rate limits |
| LLM | Google **Gemini 3.8 Flash** (`gemini-3.8-flash`) | Thinking level **low** (`minimal` is unsupported and errors; default is `medium`). Structured JSON output. Short outputs. |
| Database | Supabase Postgres | |
| Audio storage | Supabase Storage | Needs public/signed URLs for WhatsApp and (Phase 2) Twilio |
| Audio conversion | ffmpeg | WhatsApp voice notes are OGG/Opus; STT may need WAV 16 kHz mono (VERIFY) |
| WhatsApp | Meta WhatsApp Cloud API | Use the free test number during development |
| Website | Plain HTML + JS (or minimal Next.js) | Do not spend time on design |

**LLM isolation:** put all LLM calls behind one function, `llm_next_turn(state, user_text, language) -> dict`, so the model can be swapped (for example to Gnani's Evon) in one place.

---

## 5. Environment variables (`.env`, never commit)

```
GNANI_API_KEY=
GEMINI_API_KEY=            # from Google AI Studio (a chat subscription alone does not provide API access)
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=     # any string you choose; must match Meta webhook config
SUPABASE_URL=
SUPABASE_KEY=
PUBLIC_BASE_URL=           # ngrok or deployed URL
DEFAULT_LANGUAGE=          # OPEN: confirm with user (default suggestion: Telugu, "te")
```
Also create `.env.example` with the same keys and empty values.

---

## 6. Data model (Supabase / Postgres)

```sql
create table complaints (
  id uuid primary key default gen_random_uuid(),
  short_code text unique not null,          -- e.g. GC-4F7K2Q, read aloud to the user
  phone text not null,
  language text not null,
  category text not null,                   -- see section 8
  fields jsonb not null,                    -- extracted fields per category
  summary_user_language text,
  complaint_text_en text,                   -- formal draft
  where_to_send jsonb,                      -- ordered list of next steps
  status text not null default 'drafted',   -- drafted | ready_to_submit | submitted_by_user | resolved
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  channel text not null,                    -- whatsapp | web | phone
  phone text not null,
  language text,
  state jsonb not null default '{}',        -- partial extraction so far
  turns jsonb not null default '[]',        -- [{role, text, ts}]
  complaint_id uuid references complaints(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table status_events (
  id bigserial primary key,
  complaint_id uuid references complaints(id),
  status text not null,
  note text,
  created_at timestamptz default now()
);
```

---

## 7. Conversation flow (engine)

1. **Greet** in the user's language. Say the service drafts complaints and is not legal advice.
2. **Listen**: user describes the problem (voice or text).
3. **Extract**: LLM fills the schema in section 9 and picks a category.
4. **Follow up**: if required fields are missing, ask **one short question at a time** (max 1-2 sentences, spoken-friendly). Never ask more than about 4 follow-ups total.
5. **Confirm**: read back a short summary in the user's language and ask "Is this correct?" (yes/no). Do not finalise without a yes.
6. **Finalise**: create the complaint row, generate the formal English draft, and generate the `where_to_send` steps.
7. **Reply**: send the draft text, the complaint ID, and a Timbre voice note in the user's language containing the summary and the ID.
8. **Later**: if the user messages "status" or sends their ID, return the current status.

**Safety branch (important):** if the text describes an in-progress scam or cyber fraud (money just taken via a fake link, OTP shared, remote-access app, account hacked), do **not** just draft a complaint. Immediately tell the user, in their language, to call their bank and the official cybercrime helpline and report on the official cybercrime portal right away (VERIFY the current helpline number before hardcoding), then offer to draft the complaint afterwards.

---

## 8. Complaint categories (v1: four)

| key | Examples | Required fields |
|---|---|---|
| `ecommerce_product` | Fake, damaged or wrong product, refund not received | platform, seller (if known), product, amount, order date, order ID (optional), what went wrong, what user wants (refund/replace) |
| `delivery_or_food` | Order not delivered, wrong food, money deducted | platform, order date, amount, what went wrong, what user wants |
| `upi_payment_failure` | Money debited but not received, wrong transfer | app/bank, amount, date and time, transaction ID (optional), receiver (optional), what went wrong |
| `defective_goods_or_overcharge` | Local shop sold defective item, charged above MRP, warranty refused | shop name and place, item, amount, date, what went wrong, bill available (yes/no) |

Add more categories later (telecom, insurance, government services, farming inputs) by adding entries to a config file, not by changing engine code. Keep categories in `categories.yaml`: key, required fields, follow-up question hints, routing steps.

### Routing hints (`where_to_send`), VERIFY each before shipping
- `ecommerce_product`, `delivery_or_food`: company grievance officer or in-app support first, then the National Consumer Helpline, then the consumer commission.
- `upi_payment_failure`: bank or payment app complaint first, then the RBI Ombudsman complaint portal.
- `defective_goods_or_overcharge`: shop or manufacturer first, then NCH, then the consumer commission.

---

## 9. LLM contract

**Model:** `gemini-3.8-flash`, thinking level `low`, structured output (JSON schema), low max output tokens. Latency matters more than depth. Keep `reply` to one or two short spoken sentences.

**System prompt (starting point):**
```
You are a complaint-intake assistant for people in India who may not write formal English.
The user speaks {language}; they may mix in English words. Always reply in {language}, in simple spoken words, 1-2 short sentences.
Your job: understand the problem, fill the schema, and ask ONE short follow-up question for the most important missing required field.
Never invent facts. If a value is unknown, leave it null.
If the user describes an ongoing scam or fraud, set "urgent_fraud": true.
You draft complaints. You do not give legal advice and you do not claim anything was filed.
Return only JSON matching the schema.
```

**Response schema:**
```json
{
  "category": "ecommerce_product | delivery_or_food | upi_payment_failure | defective_goods_or_overcharge | unknown",
  "fields": { "...category-specific, null if unknown..." },
  "missing_required": ["field_name"],
  "urgent_fraud": false,
  "ready_to_confirm": false,
  "reply": "next spoken line in the user's language",
  "formal_complaint_en": "only filled when ready_to_confirm is true; formal English, factual, no exaggeration"
}
```
The backend merges `fields` into `session.state` each turn so earlier answers are never lost. Pass the merged state back into the next call.

---

## 10. WhatsApp channel

**Setup (VERIFY against Meta's current docs):**
1. Meta developer account, create a Business app, add the WhatsApp product.
2. Use the free **test phone number**; add your own and a few friends' numbers as allowed recipients.
3. Expose the backend publicly (ngrok), set the webhook URL to `/whatsapp/webhook`, and set the verify token.
4. Subscribe to the `messages` webhook field.

**Endpoints:**
- `GET /whatsapp/webhook`: verification handshake (echo `hub.challenge` if `hub.verify_token` matches).
- `POST /whatsapp/webhook`: parse incoming messages. Handle `text` and `audio` types. Return 200 quickly and process in a background task (Meta retries slow webhooks, so de-duplicate by message ID).

**Voice note in:** webhook gives a media ID, so call the Graph API to get the media URL, download with the bearer token, convert with ffmpeg to the format Prisma needs, then transcribe.

**Reply out:**
- Send the text message.
- Generate speech with Timbre, convert to **OGG/Opus** (`audio/ogg; codecs=opus`) so it shows as a playable voice note, upload it as WhatsApp media, and send it as an audio message.

**Rules:** the user always messages first, so replies fall inside the free 24-hour window and no templates are needed. Do not build any proactive or broadcast messaging in Phase 1.

---

## 11. Website

Two pages, plain HTML + JS:
1. **Landing**: one paragraph on what it does, a "Chat on WhatsApp" button (`wa.me` link to the test number), and the disclaimer ("drafting aid, not legal advice").
2. **Status**: input for complaint ID plus last 4 digits of the phone number (simple verification so strangers cannot read complaints). Calls `GET /status/{short_code}?pin=XXXX` and shows status timeline, category, the formal English draft, and the `where_to_send` steps.

Mobile-first layout. No login system.

---

## 12. Phase 2: Phone call (do not start without user confirmation)

Website form (phone number, language, consent checkbox) with a **Call me** button. Backend calls the telephony provider's REST API to dial the user. Turn-based loop:
1. `POST /voice/answer`: play a cached Timbre greeting, then record until silence.
2. `POST /voice/recording`: download the recording, then Prisma, the LLM, Timbre, and return a play-and-record-again instruction.
3. Loop until `is_complete`, then read out the complaint ID and hang up. Send the summary on WhatsApp if the user has opened a chat.

**Notes:** trial accounts usually only call verified numbers and play a trial notice (VERIFY). Cache the greeting audio. Keep replies short to limit silence between turns. Say at the start of the call that it is recorded. Only call numbers whose owner requested it.

---

## 13. Suggested repo structure

```
/app
  main.py                 # FastAPI app, routes
  engine.py               # handle_turn()
  llm.py                  # llm_next_turn() (Gemini)
  stt.py                  # Prisma wrapper
  tts.py                  # Timbre wrapper
  audio.py                # ffmpeg conversion helpers
  categories.yaml         # categories, required fields, routing
  channels/whatsapp.py
  channels/voice.py       # Phase 2
  db.py                   # Supabase access
/web
  index.html
  status.html
/tests
  transcripts/            # sample complaints per language
  test_engine.py
.env.example
README.md
```

---

## 14. Build order and milestones

| When | Milestone | Done when |
|---|---|---|
| Day 1 | Gnani keys working | One Prisma transcription and one Timbre audio file produced from a script |
| Day 1-2 | Language and quality check | 10-15 real voice samples (recorded on a phone, including code-mixed speech) transcribed; note errors. If quality is poor in the chosen language, tell the user immediately. |
| Day 2-3 | LLM extraction | Gemini returns valid schema JSON for 10 sample transcripts across all 4 categories; per-turn latency measured |
| Day 3-5 | Engine with state | `handle_turn` completes a full conversation in the terminal and writes a complaint row |
| Day 5-8 | WhatsApp end to end | A real voice note in produces a text draft plus voice note reply, via the test number |
| Day 8-10 | Website status page | Status lookup works with ID + PIN |
| Day 10-12 | Polish and real-user testing | 3+ people try it; fix confusing questions and slow replies |
| Day 12-14 | Demo video | 60-90 second video recorded (see section 16) |
| By 3-5 Nov | Post | Posted publicly with required hashtags |
| Only if time remains | Phase 2 phone call | Per section 12 |

---

## 15. Testing and acceptance criteria

- **Transcription:** at least 10 sample voice notes per target language; record errors. Include noisy audio and English words mixed in.
- **Extraction:** all 4 categories produce valid JSON and sensible follow-ups; no invented values.
- **Latency:** voice note in to reply out in about 8 seconds or less in normal conditions (measure and report; flag anything slower).
- **Confirmation gate:** a complaint is never finalised without an explicit yes from the user.
- **Fraud branch:** a sample scam message triggers the urgent warning instead of a normal draft.
- **Wording audit:** search the code and copy for "filed" or "submitted"; replace with "ready to submit".
- **Privacy:** no logging of full phone numbers in console output; test accounts only for demo; do not store anything beyond what the flow needs.

---

## 16. Demo video requirements (shapes some product decisions)

- 60-90 seconds, vertical-friendly, readable captions (many viewers watch muted).
- Hook in the first 3 seconds: a real person with a real, relatable problem.
- Show: person speaks in their language, bot replies with a voice note, a formal complaint appears, and the status page shows the same complaint.
- Use test data and consenting people only.
- On-screen text states: built with Gnani AI Prisma and Timbre. Include the hashtags `#GnaniAI` and `#GreatIndianAIInternshipChallenge`.

---

## 17. OPEN decisions: ask the user

1. Primary language (default suggestion: Telugu) and any second language for the demo.
2. Do they already have Meta developer access and a test number set up?
3. Which hosting to use (laptop + ngrok vs Render/Railway)?
4. Whether to try Gnani's Evon as an alternative LLM after Gemini is working.

## 18. Working rules for the agent

- Build in the order of section 14. Show the user a working result at the end of each milestone.
- Do not skip the Day 1-2 quality check; the whole idea depends on speech quality in the chosen language.
- Never hardcode secrets. Never commit `.env`.
- Keep it small: one language, four categories, one polished flow. Ask before adding scope.
- When docs for Gnani, Meta or Google conflict with this file, follow the docs and tell the user what changed.
