import { createHash } from "node:crypto";

const local = new Map<string, { until: number; count: number }>();

/** Shared hosted rate limit; do not log client addresses or request bodies. */
export async function allowRequest(request: Request, area: string, max: number): Promise<boolean> {
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = createHash("sha256").update(`civicsathi:${area}:${ip}`).digest("hex");
  const url = process.env.SUPABASE_URL, secret = process.env.SUPABASE_KEY;
  if (url && secret) {
    try {
      const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/consume_api_limit`, {
        method: "POST", headers: { apikey: secret, "Content-Type": "application/json", ...(secret.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${secret}` }) },
        body: JSON.stringify({ bucket_key: key, max_count: max, period_seconds: 60 }), signal: AbortSignal.timeout(5000)
      });
      return response.ok && await response.json() === true;
    } catch { return false; }
  }
  if (process.env.VERCEL === "1") return false;
  const now = Date.now(), previous = local.get(key);
  if (!previous || previous.until <= now) { local.set(key, { until: now + 60000, count: 1 }); return true; }
  previous.count += 1;
  return previous.count <= max;
}
