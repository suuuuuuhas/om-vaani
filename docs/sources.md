# Official sources checked

Checked during implementation on 24–25 October 2026. These are implementation references; contest claims in the original plan have not been independently verified.

| Area | Source | Implementation consequence |
|---|---|---|
| Prisma REST | https://docs.gnani.ai/api/STT/speech-to-text | X-API-Key-ID; multipart audio_file; language_code; ten supported languages; 60-second cap; OGG accepted; ITN format. |
| Timbre REST | https://docs.gnani.ai/api/TTS/tts-inference | Current v3.0 available; model/voice pairing; binary OGG/Opus output; language parameter. |
| Timbre voice catalog | https://docs.gnani.ai/api/TTS/available-voices | Shivani belongs to v3.0; v3.0 voices cover all ten supported languages. |
| Gemini structured output | https://ai.google.dev/gemini-api/docs/structured-output | Interactions response_format text/application-json/schema; validate output on the server. |
| Gemini thinking | https://ai.google.dev/gemini-api/docs/thinking | gemini-3.8-flash supports low, medium and high; use low. |
| Gemini Interactions | https://ai.google.dev/api/interactions-api | Parse model_output steps; system_instruction; store=false. |
| Gemini generateContent | https://ai.google.dev/api/generate-content | Supported alternate transport; generationConfig.responseFormat text/JSON/schema and thinkingConfig LOW; used locally with responding 3.6 Flash after 3.8 failures. |
| Timbre text normalization | https://docs.gnani.ai/api/TTS/tts-input-formating | Current guide says numbers/dates are automatically normalised, unlike older notes on the REST page. Synthetic round-trip tests still exposed an unclear date and a changed amount; do not assume number accuracy without listening and real-speaker evaluation. |
| Meta media | https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media | Verified in Chrome after search-tool access failed: authenticated media download, media upload then send; OGG must be mono Opus; v26.0 examples. |
| Cybercrime portal | https://cybercrime.gov.in/Webform/cyber_suspect.aspx | Official financial-cybercrime warning points to 1930 and cybercrime.gov.in. |
| Consumer helpline | https://consumerhelpline.gov.in/public/contact | 1915 and official consumer portal. |
| NCH role | https://consumerhelpline.gov.in/public/about | Pre-litigation service; appropriate Consumer Commission is a possible next step; no guaranteed remedy. |
| RBI ombudsman FAQ | https://old.rbi.org.in/commonman/english/scripts/faqs.aspx?id=3407 | Raise with regulated entity first; applicability/waiting periods and dissatisfaction route matter; refer to CMS, not unconditional immediate escalation. |
| Supabase keys | https://supabase.com/docs/guides/getting-started/api-keys | Server secret key, public/client keys prohibited for this private repository; new secret keys are not JWTs. |

Routing is limited to general official resources. It does not assert eligibility, legal outcomes, a compensation amount, or a filing deadline for an individual case. Re-check sources before a public demo or production rollout.
