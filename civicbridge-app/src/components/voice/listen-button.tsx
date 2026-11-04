"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export function ListenButton({ text, locale, autoPlay = false }: { text: string; locale: string; autoPlay?: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const url = useRef<string | null>(null);
  const autoRequested = useRef("");
  useEffect(() => () => { if (url.current) URL.revokeObjectURL(url.current); }, []);
  const listen = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: locale.includes("-") ? locale : `${locale}-IN` }) });
      if (!response.ok) throw new Error("Could not play this summary. You can read it below.");
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(await response.blob());
      setAudioSrc(url.current);
    } catch (e) { setError(e instanceof Error ? e.message : "Playback failed."); }
    finally { setBusy(false); }
  }, [text, locale]);
  useEffect(() => {
    const key = `${locale}\u0000${text}`;
    if (autoPlay && autoRequested.current !== key) { autoRequested.current = key; void listen(); }
  }, [autoPlay, listen, locale, text]);
  return <div className="mt-2"><button type="button" onClick={() => void listen()} disabled={busy} className="rounded-control border border-line px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50">{busy ? "Preparing voice…" : "Listen with Vaani"}</button><span className="ml-2 text-xs text-ink-secondary">Uses Gnani voice</span>{audioSrc && <audio className="mt-2 max-w-full" src={audioSrc} controls autoPlay />}{error && <p role="status" className="mt-1 text-xs text-bad">{error}</p>}</div>;
}
