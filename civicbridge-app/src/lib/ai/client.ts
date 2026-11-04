import OpenAI from "openai";

/**
 * Server-only AI access. The key never reaches the browser: this module is
 * imported exclusively by route handlers running on the server.
 *
 * Default model: ox-alpha (openrouter/stealth/ox-alpha). If your key targets an
 * OpenRouter-compatible gateway instead of api.openai.com, set OPENAI_BASE_URL
 * (for example https://openrouter.ai/api/v1).
 */

export const MODEL_NAME =
  process.env.OPENAI_MODEL && process.env.OPENAI_MODEL.length > 0
    ? process.env.OPENAI_MODEL
    : "openrouter/stealth/ox-alpha";

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 1200;

export function hasApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 0);
}

function resolveBaseUrl(): string | undefined {
  const url = process.env.OPENAI_BASE_URL;
  return url && url.length > 0 ? url : undefined;
}

export function getClient(): OpenAI | null {
  if (!hasApiKey()) return null;
  // Lazy construction keeps no-key deployments fully functional offline.
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: resolveBaseUrl(),
    timeout: DEFAULT_TIMEOUT_MS,
    maxRetries: 0
  });
}

/** Structural subset used by services; lets tests inject deterministic fakes. */
export interface ChatCompletionShape {
  choices?: Array<{ message?: { content?: string | null } }>;
}

export interface ResponsesLike {
  responses?: {
    create(
      body: Record<string, unknown>,
      options?: Record<string, unknown>
    ): Promise<{ output_text?: string }>;
  };
  chat?: {
    completions: {
      create(
        body: Record<string, unknown>,
        options?: Record<string, unknown>
      ): Promise<ChatCompletionShape>;
    };
  };
}

export interface GenerateJsonOptions {
  client?: ResponsesLike | null;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  systemPrompt: string;
  userPayload: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

function tryParseJson(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    const parsed = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Calls ox-alpha with Structured Outputs and returns the parsed JSON object,
 * or null on ANY failure (missing key, timeout, rate limit, malformed output),
 * so callers can degrade to the deterministic fallback.
 *
 * Two transport attempts:
 *  1. Responses API with text.format json_schema (native OpenAI endpoint).
 *  2. Chat Completions with response_format json_schema - used automatically
 *     when the endpoint does not serve /responses (e.g. OpenRouter gateways).
 */
export async function generateJson(
  opts: GenerateJsonOptions
): Promise<Record<string, unknown> | null> {
  if (!opts.client && process.env.GEMINI_API_KEY) {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const requestBody = JSON.stringify({
        systemInstruction: { parts: [{ text: opts.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: opts.userPayload }] }],
        generationConfig: { thinkingConfig: { thinkingLevel: "LOW" }, maxOutputTokens: opts.maxOutputTokens ?? 1200,
          responseMimeType: "application/json", responseJsonSchema: opts.jsonSchema }
      });
      const send = () => fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: requestBody,
        signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
      });
      let response = await send();
      if ([502, 503, 504].includes(response.status)) {
        await new Promise(resolve => setTimeout(resolve, 500));
        response = await send();
      }
      if (!response.ok) { console.warn("Gemini request unavailable", response.status); return null; }
      const result = await response.json();
      if (result.candidates?.[0]?.finishReason !== "STOP") { console.warn("Gemini response incomplete"); return null; }
      return tryParseJson(result.candidates?.[0]?.content?.parts?.map((part: {text?: string}) => part.text ?? "").join(""));
    } catch (error) { console.warn("Gemini request failed", error instanceof Error ? error.name : "unknown"); return null; }
  }
  const injected: ResponsesLike | null = opts.client ?? null;
  const sdkClient = injected ?? getClient();
  if (!sdkClient) return null;
  // Normalize to the structural interface so both injected test fakes and the
  // real SDK instance flow through identical code paths.
  const client = sdkClient as unknown as ResponsesLike;

  const messages = [
    { role: "system", content: opts.systemPrompt },
    { role: "user", content: opts.userPayload }
  ];
  const reqOptions = { timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS };

  // Path 1: Responses API.
  try {
    const response = await client.responses?.create(
      {
        model: MODEL_NAME,
        input: messages,
        reasoning: { effort: "low" },
        store: false,
        max_output_tokens: opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        text: {
          format: {
            type: "json_schema",
            name: opts.schemaName,
            schema: opts.jsonSchema,
            strict: true
          }
        }
      },
      reqOptions
    );
    const parsed = tryParseJson(response?.output_text);
    if (parsed) return parsed;
  } catch {
    // Endpoint may not implement /responses (or transient failure): try path 2.
  }

  // Path 2: Chat Completions structured outputs.
  try {
    if (!client.chat?.completions) return null;
    const completion = await client.chat.completions.create(
      {
        model: MODEL_NAME,
        messages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: opts.schemaName,
            strict: true,
            schema: opts.jsonSchema
          }
        },
        max_tokens: opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
      },
      reqOptions
    );
    return tryParseJson(completion?.choices?.[0]?.message?.content ?? null);
  } catch {
    // Rate limits, timeouts and malformed payloads all degrade to fallback mode.
    return null;
  }
}
