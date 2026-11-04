# Civic Sathi voice verification

Production: https://civic-sathi-nine.vercel.app

On 4 November 2026 a synthetic Telugu grievance completed a live round trip through Gnani Timbre, Prisma v3 automatic detection, Gemini triage and Timbre speech. Prisma returned `te-IN` and a nonempty transcript; Gemini returned a Telugu summary and classified the case as a consumer grievance; Timbre returned OGG audio for the response. The four provider calls took 12.5 seconds in this one run, including generation of the synthetic input. This is not a percentile or a real-speaker accuracy measurement.

A later check decoded the synthetic Telugu sample to 48 kHz mono float audio, passed it through the exact browser WAV encoder, and sent the resulting file to the deployed transcription endpoint. The endpoint returned HTTP 200, detected `te-IN`, and returned a 91-character transcript. This validates encoder-to-provider compatibility with synthetic input, not browser microphone capture or recognition accuracy for a person.

A further synthetic round-trip on 4 November 2026 used three fictional grievances. Gnani TTS and the deployed transcription endpoint both returned HTTP 200 for English, Hindi, and Telugu, and detected `en-IN`, `hi-IN`, and `te-IN` respectively. The test checked language codes and nonempty transcripts, not transcript accuracy; individual runs took approximately 11.9, 2.8, and 4.2 seconds. These are not latency benchmarks or real-speaker tests.

A second end-to-end synthetic test fed English, Hindi, and Telugu TTS through the browser WAV encoder, live Prisma detection, Gemini triage, and Timbre response generation. All three returned their expected language code, classified the fictional broken-mixer/refund grievance as consumer (`nch`), returned `gemini` mode, and produced OGG response audio. The recognizer preserved the main grievance in these examples; Hindi rendered the word mixer in Latin script, and the Telugu summary compressed the distinction between arriving broken and breaking. Users must review results. This was not a browser microphone or real-person test.

Browser verification showed the home, dashboard, Vaani controls, and a synthetic text-to-review journey. The greeting's playback request completed through the published interface. Actual microphone capture and recognition of a person speaking remain to be tested with the user's consent. The browser may require a play action if it blocks autoplay.

The portal interface is translated into English, Hindi and Telugu. Prisma supports ten language codes and passes its detected language to the AI summary and speech request, but the remaining languages have not been validated with real speakers. Recognition can be wrong; the user must review and correct the transcript and extracted details.

Gemini and Gnani can return temporary provider errors. The app retries certain transient errors once and labels the deterministic offline result when Gemini is unavailable. Case storage and status events remain the CivicBridge browser-local prototype; example records and submission references are fictional, with no real government submission or status integration.
