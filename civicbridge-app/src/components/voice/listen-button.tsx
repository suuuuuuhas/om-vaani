"use client";
import { useEffect, useRef, useState } from "react";

export function ListenButton({ text, locale }: { text: string; locale: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const url = useRef<string | null>(null);
  useEffect(() => () => { if (url.current) URL.revokeObjectURL(url.current); }, []);
  async function listen() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: locale.includes("-") ? locale : `${locale}-IN` }) });
      if (!response.ok) throw new Error("Could not play this summary. You can read it below.");
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(await response.blob());
      await new Audio(url.current).play();
    } catch (e) { setError(e instanceof Error ? e.message : "Playback failed."); }
    finally { setBusy(false); }
  }
  return <div className="mt-2"><button type="button" onClick={() => void listen()} disabled={busy} className="rounded-control border border-line px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50">{busy ? "Preparing voice…" : "Listen with Vaani"}</button><span className="ml-2 text-xs text-ink-secondary">Uses Gnani voice</span>{error && <p role="status" className="mt-1 text-xs text-bad">{error}</p>}</div>;
}
