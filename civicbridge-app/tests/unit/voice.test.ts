import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as transcribe } from "@/app/api/voice/transcribe/route";
import { POST as speak } from "@/app/api/voice/speak/route";
import { generateJson } from "@/lib/ai/client";
import { wavBlob } from "@/lib/voice/wav";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Gnani voice endpoints", () => {
  it("asks Prisma v3 to detect speech language and returns its transcript", async () => {
    vi.stubEnv("GNANI_STT_API_KEY", "test-stt-key");
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect((init.body as FormData).get("model")).toBe("prisma-v3.0");
      expect((init.body as FormData).get("language_code")).toBe("indic-auto");
      return Response.json({ success: true, transcript: "నా సమస్య", detected_language_code: "te-IN" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData(); form.append("audio", new File([new Uint8Array(200)], "voice.wav", { type: "audio/wav" }));
    const response = await transcribe(new Request("http://localhost/api/voice/transcribe", { method: "POST", body: form }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ transcript: "నా సమస్య", language: "te-IN" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a truncated transcript rather than silently using incomplete facts", async () => {
    vi.stubEnv("GNANI_STT_API_KEY", "test-stt-key");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: true, transcript: "partial", truncated: true })));
    const form = new FormData(); form.append("audio", new File([new Uint8Array(200)], "voice.wav", { type: "audio/wav" }));
    const response = await transcribe(new Request("http://localhost/api/voice/transcribe", { method: "POST", body: form }));
    expect(response.status).toBe(422);
  });

  it("does not pass an unsupported detected language to downstream services", async () => {
    vi.stubEnv("GNANI_STT_API_KEY", "test-stt-key");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: true, transcript: "hello", detected_language_code: "unknown" })));
    const form = new FormData(); form.append("audio", new File([new Uint8Array(200)], "voice.wav", { type: "audio/wav" }));
    const response = await transcribe(new Request("http://localhost/api/voice/transcribe", { method: "POST", body: form }));
    expect(await response.json()).toEqual({ transcript: "hello", language: null });
  });

  it("returns playable audio without exposing the provider key", async () => {
    vi.stubEnv("GNANI_TTS_API_KEY", "test-tts-key");
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(String(init.body))).toMatchObject({ voice: "Shivani", language: "te-IN" });
      return new Response("OggStest", { status: 200 });
    }));
    const response = await speak(new Request("http://localhost/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "నమస్కారం", language: "te-IN" }) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/ogg");
    expect(await response.text()).toBe("OggStest");
  });
});

describe("Gemini resilience", () => {
  it("retries a temporary 503 and returns the structured answer", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(Response.json({
      candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"answer":"ok"}' }] } }]
    }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateJson({ schemaName: "test", jsonSchema: { type: "object" }, systemPrompt: "Test.", userPayload: "Synthetic." });
    expect(result).toEqual({ answer: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});


describe("microphone audio encoding", () => {
  it("encodes 48 kHz capture as mono 16 kHz PCM WAV with the correct length", async () => {
    const samples = new Float32Array(48000).fill(0.5);
    const blob = wavBlob([samples.subarray(0, 24000), samples.subarray(24000)], 48000);
    const bytes = await blob.arrayBuffer();
    const view = new DataView(bytes);
    expect(blob.type).toBe("audio/wav");
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE");
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(32000);
    expect(bytes.byteLength).toBe(32044);
    expect(view.getInt16(44, true)).toBeCloseTo(16383, 0);
  });
});
