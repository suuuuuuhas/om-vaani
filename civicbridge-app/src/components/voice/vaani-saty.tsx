"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useApp } from "@/components/providers/app-provider";

const greetings = {
  en: "Hello, I am Vaani Saty. Tell me what happened, and I will help you prepare your case.",
  hi: "नमस्ते, मैं वाणी सत्य हूँ। बताइए क्या हुआ, मैं आपकी शिकायत तैयार करने में मदद करूँगी।",
  te: "నమస్కారం, నేను వాణి సత్య. ఏమి జరిగిందో చెప్పండి, మీ ఫిర్యాదు సిద్ధం చేయడంలో సహాయం చేస్తాను."
};

const copy = {
  en: { guide: "Your voice guide · Powered by Gnani", consent: "I agree to send my voice and the spoken response to Gnani for processing. Avoid sharing passwords, OTPs and bank details.", required: "Please agree to voice processing first.", processing: "Listening to your recording…", detected: "Language detected. Please review your transcript below.", other: "Please review the transcript. The interface is available in English, Hindi, and Telugu; Vaani will try to respond in your detected language.", recording: "Recording… Stop when you are ready; maximum 27 seconds.", microphone: "Microphone access is unavailable. You can type your message.", failed: "Recording failed. Try again.", playback: "Voice playback is unavailable. Please try again.", speak: "Speak to Vaani", stop: "Stop and transcribe", listen: "Listen to Vaani", hint: "Speak in your language; Vaani will try to recognise it." },
  hi: { guide: "आपकी आवाज़ सहायक · Gnani द्वारा संचालित", consent: "मैं अपनी आवाज़ और बोले गए जवाब को प्रोसेसिंग के लिए Gnani को भेजने की सहमति देता/देती हूँ। पासवर्ड, OTP और बैंक विवरण साझा न करें।", required: "कृपया पहले आवाज़ की प्रोसेसिंग के लिए सहमति दें।", processing: "आपकी रिकॉर्डिंग सुनी जा रही है…", detected: "भाषा पहचान ली गई। कृपया नीचे लिखे विवरण की जाँच करें।", other: "कृपया लिखे विवरण की जाँच करें। इंटरफ़ेस अंग्रेज़ी, हिन्दी और तेलुगु में उपलब्ध है; वाणी आपकी पहचानी गई भाषा में जवाब देने की कोशिश करेगी।", recording: "रिकॉर्डिंग जारी है… तैयार होने पर रोकें; अधिकतम 27 सेकंड।", microphone: "माइक्रोफ़ोन उपलब्ध नहीं है। आप अपना संदेश लिख सकते हैं।", failed: "रिकॉर्डिंग विफल हुई। फिर कोशिश करें।", playback: "आवाज़ उपलब्ध नहीं है। कृपया फिर कोशिश करें।", speak: "वाणी से बोलें", stop: "रोकें और लिखित रूप पाएँ", listen: "वाणी को सुनें", hint: "अपनी भाषा में बोलें; वाणी उसे पहचानने की कोशिश करेगी।" },
  te: { guide: "మీ వాయిస్ సహాయకురాలు · Gnani ద్వారా", consent: "నా వాయిస్ మరియు మాట్లాడే సమాధానాన్ని ప్రాసెసింగ్ కోసం Gnaniకి పంపడానికి అంగీకరిస్తున్నాను. పాస్‌వర్డ్‌లు, OTPలు, బ్యాంకు వివరాలు చెప్పవద్దు.", required: "దయచేసి ముందుగా వాయిస్ ప్రాసెసింగ్‌కు అంగీకరించండి.", processing: "మీ రికార్డింగ్‌ను వింటున్నాం…", detected: "భాష గుర్తించబడింది. దయచేసి కింద ఉన్న వచనాన్ని పరిశీలించండి.", other: "వచనాన్ని పరిశీలించండి. ఇంటర్‌ఫేస్ ఇంగ్లీష్, హిందీ, తెలుగులో ఉంది; వాణి గుర్తించిన భాషలో సమాధానమివ్వడానికి ప్రయత్నిస్తుంది.", recording: "రికార్డింగ్ జరుగుతోంది… సిద్ధమైనప్పుడు ఆపండి; గరిష్ఠంగా 27 సెకన్లు.", microphone: "మైక్రోఫోన్ అందుబాటులో లేదు. మీరు సందేశాన్ని టైప్ చేయవచ్చు.", failed: "రికార్డింగ్ విఫలమైంది. మళ్లీ ప్రయత్నించండి.", playback: "వాయిస్ అందుబాటులో లేదు. మళ్లీ ప్రయత్నించండి.", speak: "వాణితో మాట్లాడండి", stop: "ఆపి వచనంగా మార్చండి", listen: "వాణిని వినండి", hint: "మీ భాషలో మాట్లాడండి; వాణి దాన్ని గుర్తించడానికి ప్రయత్నిస్తుంది." }
} as const;

function wavBlob(chunks: Float32Array[], sampleRate: number): Blob {
  const inputCount = chunks.reduce((n, part) => n + part.length, 0);
  const input = new Float32Array(inputCount); let cursor = 0;
  for (const part of chunks) { input.set(part, cursor); cursor += part.length; }
  const outputRate = 16000, count = Math.floor(inputCount * outputRate / sampleRate);
  const buffer = new ArrayBuffer(44 + count * 2), view = new DataView(buffer);
  const label = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  label(0, "RIFF"); view.setUint32(4, 36 + count * 2, true); label(8, "WAVE"); label(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, outputRate, true); view.setUint32(28, outputRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); label(36, "data"); view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const first = Math.floor(i * sampleRate / outputRate), end = Math.max(first + 1, Math.floor((i + 1) * sampleRate / outputRate));
    let total = 0; for (let n = first; n < end; n++) total += input[n] || 0;
    const s = Math.max(-1, Math.min(1, total / (end - first))); view.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function VaaniSaty({ onTranscript }: { onTranscript: (text: string, language: string | null) => void }) {
  const { locale, setLocale } = useApp();
  const words = copy[locale];
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "recording" | "processing" | "speaking">("idle");
  const [message, setMessage] = useState("");
  const capture = useRef<{ context: AudioContext; stream: MediaStream; processor: ScriptProcessorNode; chunks: Float32Array[]; timer: ReturnType<typeof setTimeout> } | null>(null);
  const audioUrl = useRef<string | null>(null);

  useEffect(() => () => {
    const active = capture.current;
    if (active) { clearTimeout(active.timer); active.processor.disconnect(); active.stream.getTracks().forEach(t => t.stop()); void active.context.close(); }
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
  }, []);

  async function stop() {
    const active = capture.current;
    if (!active) return;
    capture.current = null; clearTimeout(active.timer); active.processor.disconnect(); active.stream.getTracks().forEach(t => t.stop());
    const wav = wavBlob(active.chunks, active.context.sampleRate); await active.context.close();
    setState("processing"); setMessage(words.processing);
    try {
      const form = new FormData(); form.append("audio", wav, "recording.wav");
      const response = await fetch("/api/voice/transcribe", { method: "POST", body: form });
      const result = await response.json(); if (!response.ok) throw new Error(locale === "en" ? result.error : words.failed);
      onTranscript(result.transcript, result.language);
      const detected = String(result.language || "").slice(0, 2);
      if (detected === "en" || detected === "hi" || detected === "te") { setLocale(detected); setMessage(copy[detected].detected); }
      else setMessage(words.other);
    } catch (error) { setMessage(error instanceof Error ? error.message : words.failed); }
    finally { setState("idle"); }
  }

  async function record() {
    if (!consent) { setMessage(words.required); return; }
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      context = new AudioContext(); const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1); const chunks: Float32Array[] = [];
      processor.onaudioprocess = event => chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      source.connect(processor); processor.connect(context.destination);
      const timer = setTimeout(() => void stop(), 27000);
      capture.current = { context, stream, processor, chunks, timer };
      setState("recording"); setMessage(words.recording);
    } catch { stream?.getTracks().forEach(track => track.stop()); if (context) void context.close(); setMessage(words.microphone); }
  }

  async function speak() {
    if (!consent) { setMessage(words.required); return; }
    setState("speaking");
    try {
      const response = await fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: greetings[locale], language: `${locale}-IN` }) });
      if (!response.ok) throw new Error(words.playback);
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = URL.createObjectURL(await response.blob());
      const player = new Audio(audioUrl.current); await player.play();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Voice playback failed."); }
    finally { setState("idle"); }
  }

  return <div className="mt-5 rounded-card border border-accent/30 bg-accent-soft p-4">
    <div className="flex items-center gap-3"><Image src="/vaani-saty.png" alt="" width={56} height={56} className="size-14 shrink-0 rounded-full object-cover object-top" /><div><p className="font-bold">Vaani Saty</p><p className="text-xs text-ink-secondary">{words.guide}</p></div></div>
    <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" /> <span>{words.consent}</span></label>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={state === "recording" ? () => void stop() : () => void record()} disabled={state !== "idle" && state !== "recording"} className="min-h-11 rounded-control bg-accent px-4 text-sm font-semibold text-onaccent disabled:opacity-50">{state === "recording" ? words.stop : words.speak}</button><button type="button" onClick={() => void speak()} disabled={state !== "idle"} className="min-h-11 rounded-control border border-line bg-surface px-4 text-sm font-semibold disabled:opacity-50">{words.listen}</button></div>
    <p role="status" className="mt-2 text-xs text-ink-secondary">{message || words.hint}</p>
  </div>;
}
