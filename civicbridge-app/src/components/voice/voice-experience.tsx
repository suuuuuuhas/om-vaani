"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Microphone, Pause, SpeakerHigh, WarningCircle, Waves, X } from "@phosphor-icons/react";
import { useApp } from "@/components/providers/app-provider";
import { checkSensitiveContent } from "@/lib/privacy/guard";
import type { ExecutionMode, TriageResult } from "@/lib/types";

const words = {
  en: { title: "I'm listening.", intro: "Tell me what's on your mind. We'll figure out the next step together.", idle: "Ready when you are", recording: "Listening to you", working: "Let me understand", speaking: "Vaani is speaking", tap: "Tap to speak", stop: "I'm done speaking", think: "One moment…", again: "Add more by voice", review: "Review what I heard", hear: "Listen again", consent: "I agree to send my voice and Vaani's spoken replies to Gnani, and my words to Google Gemini, for this conversation.", privacy: "Please don't share passwords, OTPs, bank details or Aadhaar numbers.", note: "Independent prototype · Your case is not filed automatically", heard: "WHAT I HEARD", reply: "VAANI'S RESPONSE", empty: "Your words will appear here so you can check them.", edit: "Edit transcript", apply: "Update understanding", language: "RESPONSE LANGUAGE", blocked: "Please remove sensitive identifiers before continuing.", micError: "I couldn't access your microphone. Check your browser permissions and try again.", failure: "I couldn't complete that request. Please try again.", long: "This conversation is too long. Please shorten the transcript before continuing.", limited: "AI is unavailable right now. This is a basic suggestion; please review it carefully.", audioError: "Audio couldn't play automatically. Use the playback control to listen.", min: "Please tell me a little more about what happened.", change: "I have read and agree to the voice and AI processing notice.", close: "Close", languageHint: "Language detected automatically; you can change the response language.", ask: "Is there anything else you'd like to add?", saved: "Your words stay on this device until you choose to process them." },
  hi: { title: "मैं सुन रही हूँ।", intro: "अपनी बात बताइए। हम मिलकर आगे का रास्ता समझेंगे।", idle: "जब आप तैयार हों", recording: "मैं सुन रही हूँ", working: "मैं समझ रही हूँ", speaking: "वाणी बोल रही है", tap: "बोलने के लिए दबाएँ", stop: "बोलना पूरा हुआ", think: "एक पल…", again: "और जानकारी बोलें", review: "सुनी हुई बात जाँचें", hear: "फिर सुनें", consent: "मैं इस बातचीत में अपनी आवाज़ और वाणी के बोले गए जवाब Gnani को और अपने शब्द Google Gemini को भेजने की सहमति देता/देती हूँ।", privacy: "पासवर्ड, OTP, बैंक या आधार नंबर न बताएँ।", note: "स्वतंत्र प्रोटोटाइप · शिकायत अपने आप दर्ज नहीं होती", heard: "मैंने यह सुना", reply: "वाणी का जवाब", empty: "आपकी बात यहाँ दिखेगी ताकि आप जाँच सकें।", edit: "लिखित विवरण सुधारें", apply: "फिर जाँचें", language: "जवाब की भाषा", blocked: "आगे बढ़ने से पहले संवेदनशील पहचान विवरण हटाएँ।", micError: "माइक्रोफ़ोन उपलब्ध नहीं है। ब्राउज़र की अनुमति जाँचकर फिर कोशिश करें।", failure: "यह अनुरोध पूरा नहीं हो सका। कृपया फिर कोशिश करें।", long: "बातचीत बहुत लंबी है। आगे बढ़ने से पहले विवरण छोटा करें।", limited: "AI अभी उपलब्ध नहीं है। यह एक बुनियादी सुझाव है; कृपया जाँचें।", audioError: "आवाज़ अपने आप नहीं चली। सुनने के लिए प्ले दबाएँ।", min: "कृपया बताइए क्या हुआ।", change: "मैंने आवाज़ और AI प्रोसेसिंग की सूचना पढ़ी और सहमति दी है।", close: "बंद करें", languageHint: "भाषा अपने आप पहचानी जाती है; जवाब की भाषा बदल सकते हैं।", ask: "क्या आप कुछ और जोड़ना चाहेंगे?", saved: "प्रोसेस करने से पहले आपके शब्द इसी डिवाइस पर रहते हैं।" },
  te: { title: "నేను వింటున్నాను.", intro: "ఏం జరిగిందో చెప్పండి. కలిసి తర్వాతి మార్గాన్ని తెలుసుకుందాం.", idle: "మీరు సిద్ధమైనప్పుడు", recording: "మీ మాట వింటున్నాను", working: "అర్థం చేసుకుంటున్నాను", speaking: "వాణి మాట్లాడుతోంది", tap: "మాట్లాడటానికి నొక్కండి", stop: "చెప్పడం పూర్తయింది", think: "ఒక్క క్షణం…", again: "మరిన్ని వివరాలు చెప్పండి", review: "నేను విన్నది పరిశీలించండి", hear: "మళ్లీ వినండి", consent: "ఈ సంభాషణలో నా వాయిస్, వాణి మాట్లాడే సమాధానాలను Gnaniకి, నా మాటలను Google Geminiకి పంపడానికి అంగీకరిస్తున్నాను.", privacy: "పాస్‌వర్డ్‌లు, OTPలు, బ్యాంకు లేదా ఆధార్ నంబర్లు చెప్పవద్దు.", note: "స్వతంత్ర ప్రోటోటైప్ · ఫిర్యాదు స్వయంగా నమోదు కాదు", heard: "నేను విన్నది", reply: "వాణి సమాధానం", empty: "మీ మాటలు పరిశీలించడానికి ఇక్కడ కనిపిస్తాయి.", edit: "వచనాన్ని సవరించండి", apply: "మళ్లీ విశ్లేషించండి", language: "సమాధాన భాష", blocked: "కొనసాగడానికి ముందు సున్నితమైన గుర్తింపు వివరాలను తొలగించండి.", micError: "మైక్రోఫోన్ అందుబాటులో లేదు. బ్రౌజర్ అనుమతిని పరిశీలించి మళ్లీ ప్రయత్నించండి.", failure: "అభ్యర్థనను పూర్తి చేయలేకపోయాం. మళ్లీ ప్రయత్నించండి.", long: "వివరణ చాలా పొడవుగా ఉంది. కొనసాగడానికి ముందు కుదించండి.", limited: "AI అందుబాటులో లేదు. ఇది ప్రాథమిక సూచన; దయచేసి పరిశీలించండి.", audioError: "వాయిస్ స్వయంగా ప్లే కాలేదు. వినడానికి ప్లే నొక్కండి.", min: "ఏం జరిగిందో ఇంకాస్త వివరించండి.", change: "వాయిస్, AI ప్రాసెసింగ్ వివరాలు చదివి అంగీకరిస్తున్నాను.", close: "మూసివేయండి", languageHint: "భాష స్వయంగా గుర్తించబడుతుంది; సమాధాన భాషను మార్చవచ్చు.", ask: "ఇంకా ఏమైనా చెప్పాలనుకుంటున్నారా?", saved: "ప్రాసెస్ చేయడానికి ముందు మీ మాటలు ఈ పరికరంలో ఉంటాయి." }
} as const;
const responseLanguages = [["en-IN", "English"], ["hi-IN", "हिन्दी"], ["te-IN", "తెలుగు"], ["ta-IN", "தமிழ்"], ["kn-IN", "ಕನ್ನಡ"], ["ml-IN", "മലയാളം"], ["mr-IN", "मराठी"], ["bn-IN", "বাংলা"], ["gu-IN", "ગુજરાતી"], ["pa-IN", "ਪੰਜਾਬੀ"]] as const;
type Phase = "idle" | "requesting" | "listening" | "thinking" | "speaking";

function Face({ phase }: { phase: Phase }) {
  return <div className={`vaani-face vaani-face--${phase}`} aria-hidden="true">
    <div className="vaani-hair-back"/><div className="vaani-neck"/><div className="vaani-shoulders"/>
    <div className="vaani-head"><div className="vaani-hair-top"/><div className="vaani-bindi"/><div className="vaani-brow vaani-brow--left"/><div className="vaani-brow vaani-brow--right"/><div className="vaani-eye vaani-eye--left"><i/></div><div className="vaani-eye vaani-eye--right"><i/></div><div className="vaani-nose"/><div className="vaani-blush vaani-blush--left"/><div className="vaani-blush vaani-blush--right"/><div className="vaani-mouth"/></div>
    <div className="vaani-ear vaani-ear--left"/><div className="vaani-ear vaani-ear--right"/>
  </div>;
}

type ChatMessage = { id: number; role: "user" | "assistant"; text: string };
type ServerEvent = { type: string; text?: string; language?: string; audio?: string; sampleRate?: number; code?: string; mode?: ExecutionMode; data?: TriageResult };

export function VoiceExperience() {
  const router = useRouter();
  const { locale, setLocale, saveDraft, dict } = useApp();
  const t = words[locale];
  const [phase, setPhase] = useState<Phase | "error">("idle");
  const [connected, setConnected] = useState(false);
  const [textOnly, setTextOnly] = useState(false);
  const [showText, setShowText] = useState(false);
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState(false);
  const [pendingVoice, setPendingVoice] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partial, setPartial] = useState("");
  const [transcript, setTranscript] = useState("");
  const [editing, setEditing] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [voiceLanguage, setVoiceLanguage] = useState("");
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [mode, setMode] = useState<ExecutionMode>("fallback");
  const [error, setError] = useState("");
  const [latency, setLatency] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const processor = useRef<AudioWorkletNode | null>(null);
  const playback = useRef<AudioBufferSourceNode[]>([]);
  const playbackEnd = useRef(0);
  const replyDone = useRef(false);
  const mounted = useRef(false);
  const msgId = useRef(0);
  const assistantId = useRef<number | null>(null);
  const providerReady = useRef(false);
  const speechTime = useRef(0);
  const speechEnded = useRef(0);
  const audioStarted = useRef(false);
  const heardSpeech = useRef(false);
  const languageLocked = useRef(false);
  const localeRef = useRef(locale); localeRef.current = locale;
  const languageRef = useRef(voiceLanguage); languageRef.current = voiceLanguage;
  const transcriptRef = useRef("");
  const detailRef = useRef<TriageResult | null>(null);
  const detailTextRef = useRef("");
  const detailModeRef = useRef<ExecutionMode>("fallback");
  const pendingSend = useRef("");
  const chatBottom = useRef<HTMLDivElement | null>(null);

  function stopAudio() {
    for (const node of playback.current) { try { node.stop(); } catch { /* already stopped */ } }
    playback.current = []; playbackEnd.current = 0; replyDone.current = false; audioStarted.current = false;
  }
  const closeSession = useCallback(() => {
    const active = socket.current; socket.current = null;
    if (active && (active.readyState === WebSocket.OPEN || active.readyState === WebSocket.CONNECTING)) active.close();
    providerReady.current = false;
    processor.current?.disconnect(); processor.current = null;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    stopAudio(); const audioContext = context.current; context.current = null; if (audioContext && audioContext.state !== "closed") void audioContext.close();
    if (mounted.current) { setConnected(false); setPhase("idle"); }
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; closeSession(); }; }, [closeSession]);
  useEffect(() => { if (messages.length || partial) chatBottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [messages, partial]);
  function setFullText(value: string) { transcriptRef.current = value; setTranscript(value); }
  function send(event: Record<string, unknown>) { if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(event)); }
  function playChunk(encoded: string, sampleRate: number) {
    const ctx = context.current; if (!ctx || ctx.state === "closed") return;
    try {
      const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
      const length = Math.floor(bytes.byteLength / 2), view = new DataView(bytes.buffer);
      const buffer = ctx.createBuffer(1, length, sampleRate), out = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) out[i] = view.getInt16(i * 2, true) / 32768;
      const node = ctx.createBufferSource(); node.buffer = buffer; node.connect(ctx.destination);
      const at = Math.max(ctx.currentTime + 0.04, playbackEnd.current); playbackEnd.current = at + buffer.duration;
      playback.current.push(node); node.onended = () => {
        playback.current = playback.current.filter(source => source !== node);
        if (replyDone.current && playback.current.length === 0 && mounted.current) setPhase("listening");
      };
      if (!audioStarted.current) {
        audioStarted.current = true;
        if (speechEnded.current > 0) setLatency(Math.max(0, Math.round(performance.now() - speechEnded.current + (at - ctx.currentTime) * 1000)));
      }
      setPhase("speaking"); node.start(at);
    } catch { setError(words[localeRef.current].audioError); }
  }
  function messageHandler(event: MessageEvent) {
    let data: ServerEvent; try { data = JSON.parse(String(event.data)); } catch { return; }
    if (data.type === "ready") {
      providerReady.current = true; setConnected(true); setPhase("listening");
      if (languageRef.current) send({ type: "language", language: languageRef.current });
      if (pendingSend.current) { const text = pendingSend.current; pendingSend.current = ""; send({ type: "text", text }); }
    } else if (data.type === "speech_start") {
      heardSpeech.current = true; stopAudio(); setLatency(null); setPhase("listening");
    } else if (data.type === "speech_end") {
      speechEnded.current = speechTime.current || performance.now(); setPhase("thinking");
    } else if (data.type === "transcript" && data.text) {
      setPartial(previous => [previous, data.text].filter(Boolean).join(" "));
      if (!languageLocked.current && data.language) {
        languageRef.current = data.language; setVoiceLanguage(data.language);
        const detected = data.language.slice(0, 2); if (detected === "en" || detected === "hi" || detected === "te") setLocale(detected);
      }
    } else if (data.type === "user_final" && data.text) {
      const combined = [transcriptRef.current.trim(), data.text].filter(Boolean).join(" "); setFullText(combined); setPartial(""); setTriage(null); detailRef.current = null;
      setMessages(previous => [...previous, { id: ++msgId.current, role: "user", text: data.text! }]);
    } else if (data.type === "thinking") { stopAudio(); assistantId.current = null; setError(""); setPhase("thinking"); }
    else if (data.type === "assistant_delta" && data.text) {
      const part = data.text;
      if (assistantId.current === null) assistantId.current = ++msgId.current;
      const id = assistantId.current;
      setMessages(previous => {
        const index = previous.findIndex(message => message.id === id);
        if (index < 0) return [...previous, { id, role: "assistant", text: part }];
        return previous.map(message => message.id === id ? { ...message, text: message.text + part } : message);
      });
    } else if (data.type === "audio" && data.audio) playChunk(data.audio, data.sampleRate || 24000);
    else if (data.type === "response_complete") { replyDone.current = true; if (!playback.current.length) setPhase("listening"); }
    else if (data.type === "interrupted") { stopAudio(); replyDone.current = true; setPhase("listening"); }
    else if (data.type === "details" && data.data) { detailRef.current = data.data; setTriage(data.data); detailTextRef.current = transcriptRef.current; detailModeRef.current = data.mode || "fallback"; setMode(detailModeRef.current); }
    else if (data.type === "privacy_blocked") { setPartial(data.text || ""); setError(words[localeRef.current].blocked); setPhase("error"); }
    else if (data.type === "details_unavailable") { setError(words[localeRef.current].limited); }
    else if (data.type === "error") {
      const message = data.code === "ai_quota" ? (localeRef.current === "hi" ? "Gemini की सीमा पूरी हो गई है। कृपया बाद में फिर कोशिश करें।" : localeRef.current === "te" ? "Gemini పరిమితి ముగిసింది. దయచేసి తర్వాత ప్రయత్నించండి." : "Gemini's usage limit has been reached. Please try again later.") : words[localeRef.current].failure;
      setError(message); setPhase("error");
    }
  }
  async function startSession(voice: boolean, initialText = "", consentGranted = false) {
    if (!consent && !consentGranted) { setPendingVoice(voice); pendingSend.current = initialText; setNotice(true); return; }
    setNotice(false); setError(""); setPhase("requesting"); setTextOnly(!voice); pendingSend.current = initialText;
    try {
      const audioContext = new AudioContext(); context.current = audioContext; await audioContext.resume();
      if (voice) stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (!mounted.current) { stream.current?.getTracks().forEach(track => track.stop()); void audioContext.close(); return; }
      const scheme = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${scheme}//${location.host}/api/voice/session`); socket.current = ws;
      ws.onmessage = messageHandler;
      ws.onerror = () => { if (mounted.current) { setError(words[localeRef.current].failure); setPhase("error"); } };
      ws.onclose = () => { if (socket.current === ws && mounted.current) { closeSession(); setError(words[localeRef.current].failure); setPhase("error"); } };
      await new Promise<void>((resolve, reject) => { ws.addEventListener("open", () => resolve(), { once: true }); ws.addEventListener("error", () => reject(new Error("socket")), { once: true }); });
      ws.send(JSON.stringify({ type: "start", locale: localeRef.current, textOnly: !voice }));
      if (voice && stream.current) {
        await audioContext.audioWorklet.addModule("/vaani-capture.js");
        const source = audioContext.createMediaStreamSource(stream.current), node = new AudioWorkletNode(audioContext, "vaani-capture"), mute = audioContext.createGain();
        processor.current = node; mute.gain.value = 0; source.connect(node); node.connect(mute); mute.connect(audioContext.destination);
        node.port.onmessage = event => {
          if (event.data.type !== "frame" || !providerReady.current || ws.readyState !== WebSocket.OPEN) return;
          if (heardSpeech.current && event.data.rms > 0.015) speechTime.current = performance.now();
          if (ws.bufferedAmount < 65536) ws.send(event.data.pcm);
        };
      }
    } catch { closeSession(); if (mounted.current) { setError(voice ? words[localeRef.current].micError : words[localeRef.current].failure); setPhase("error"); } }
  }
  function start(voice: boolean, text = "") { void startSession(voice, text); }
  function interrupt() { send({ type: "interrupt" }); stopAudio(); setPhase("listening"); }
  function sendText() {
    const text = typedText.trim(); if (!text) return;
    if (!checkSensitiveContent(text).ok) { setError(t.blocked); return; }
    setTypedText(""); speechEnded.current = 0;
    if (!connected) start(false, text); else { interrupt(); send({ type: "text", text }); }
  }
  async function review() {
    const text = transcript.trim(); if (!text || reviewing) return;
    if (!checkSensitiveContent(text).ok) { setError(t.blocked); return; }
    setReviewing(true); stopAudio();
    try {
      let result = detailRef.current, resultMode = detailModeRef.current;
      if (!result || detailTextRef.current !== text) {
        const response = await fetch("/api/ai/triage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, locale, voiceLanguage: voiceLanguage || undefined }) });
        if (!response.ok) throw new Error("review");
        const data = await response.json() as { data: TriageResult; mode: ExecutionMode }; result = data.data; resultMode = data.mode;
      }
      closeSession(); saveDraft({ text, locale, voiceLanguage: voiceLanguage || undefined, triage: result, mode: resultMode }); router.push("/review");
    } catch { setError(t.failure); setReviewing(false); }
  }
  const status = phase === "listening" ? (connected ? t.recording : t.idle) : phase === "thinking" ? t.working : phase === "speaking" ? t.speaking : phase === "error" ? t.failure : t.idle;
  const facePhase: Phase = phase === "error" ? "idle" : phase;
  const buttonLabel = phase === "speaking" ? (locale === "hi" ? "वाणी को रोकें" : locale === "te" ? "వాణిని ఆపండి" : "Interrupt Vaani") : connected ? (locale === "hi" ? "बातचीत बंद करें" : locale === "te" ? "సంభాషణ ఆపండి" : "End conversation") : t.tap;
  return <div className="voice-experience">
    <header className="voice-topbar"><Link href="/" className="voice-brand"><span className="voice-brand-mark">ॐ</span><span>Civic Sathi<small>PROJECT OM SATY</small></span></Link><div className="voice-top-actions"><div className="voice-locale" aria-label="Interface language">{(["en", "hi", "te"] as const).map(l => <button key={l} type="button" className={locale === l ? "active" : ""} onClick={() => setLocale(l)}>{l === "en" ? "EN" : l === "hi" ? "हिं" : "తె"}</button>)}</div><Link className="voice-dashboard-link" href="/dashboard">{locale === "hi" ? "मेरे मामले" : locale === "te" ? "నా కేసులు" : "My cases"} <ArrowRight size={15}/></Link></div></header>
    <div className="voice-layout"><section className="voice-stage" aria-label="Vaani voice assistant"><div className="voice-stage-inner"><div className="voice-eyebrow"><span className="voice-spark">✳</span> {locale === "hi" ? "आपकी नागरिक साथी" : locale === "te" ? "మీ పౌర సహచరి" : "YOUR CIVIC COMPANION"}</div><div className="voice-orbit"><div className="voice-orbit-ring voice-orbit-ring--one"/><div className="voice-orbit-ring voice-orbit-ring--two"/><div className="voice-orbit-glow"/><Face phase={facePhase}/><div className="voice-avatar-label"><span className="voice-status-dot"/> VAANI SATY</div></div><div className="voice-state" role="status"><span className={`voice-status-dot ${phase === "listening" ? "is-live" : ""}`}/>{status}</div><h1>{phase === "listening" ? t.recording : phase === "thinking" ? t.working : phase === "speaking" ? t.speaking : t.title}</h1><p className="voice-intro">{connected ? (locale === "hi" ? "जब आप रुकेंगे तो मैं जवाब दूँगी। आप मुझे बीच में रोक भी सकते हैं।" : locale === "te" ? "మీరు ఆగినప్పుడు నేను సమాధానం ఇస్తాను. మధ్యలో నన్ను ఆపవచ్చు." : "Pause when you're ready; I'll respond. You can interrupt me too.") : t.intro}</p><button className={`voice-mic ${phase === "listening" ? "is-listening" : ""}`} type="button" disabled={phase === "requesting"} onClick={phase === "speaking" ? interrupt : connected ? closeSession : () => start(true)} aria-label={buttonLabel}>{phase === "speaking" ? <Pause size={27} weight="fill"/> : <Microphone size={27} weight="fill"/>}</button><p className="voice-mic-label">{phase === "requesting" ? t.think : buttonLabel}</p><p className="voice-mic-meta">{t.privacy}</p>{latency !== null && <p className="voice-latency">{locale === "hi" ? "जवाब शुरू होने तक" : locale === "te" ? "సమాధానం ప్రారంభమయ్యే వరకు" : "Reply began in"} {(latency / 1000).toFixed(1)}s <span>· approx.</span></p>}</div></section>
    <aside className="voice-conversation"><div className="conversation-top"><div><p className="conversation-kicker">{locale === "hi" ? "आपकी बातचीत" : locale === "te" ? "మీ సంభాషణ" : "YOUR CONVERSATION"}</p><h2>{locale === "hi" ? "वाणी के साथ" : locale === "te" ? "వాణితో" : "With Vaani"}<span className="conversation-star">✳</span></h2></div><span className="voice-live-badge"><span/> {connected ? "CONNECTED" : "VOICE ASSISTANT"}</span></div><div className="conversation-body"><div className="conversation-intro"><div className="mini-avatar">✳</div><div><strong>Vaani Saty</strong><p>{t.intro}</p></div></div><div className="conversation-divider"/><div className="conversation-history" aria-live="polite">{messages.map(message => <div className={`voice-message voice-message--${message.role}`} key={message.id}><span className="conversation-label">{message.role === "user" ? t.heard : t.reply}</span><p>{message.text}</p></div>)}{partial && <div className="voice-message voice-message--user"><span className="conversation-label">{t.heard}</span><p>{partial}</p></div>}{!messages.length && !partial && <p className="conversation-empty">{t.empty}</p>}<div ref={chatBottom}/></div>
    {voiceLanguage && <label className="voice-language">{t.language}<select value={voiceLanguage} onChange={e => { languageLocked.current = true; languageRef.current = e.target.value; setVoiceLanguage(e.target.value); send({ type: "language", language: e.target.value }); }}><option value="">{locale === "hi" ? "स्वचालित" : locale === "te" ? "స్వయంచాలకంగా" : "Automatic"}</option>{responseLanguages.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><small>{t.languageHint}</small></label>}
    {triage && <details className="voice-facts"><summary>{locale === "hi" ? "तैयार विवरण" : locale === "te" ? "సిద్ధమైన వివరాలు" : "Details gathered"}</summary><p>{triage.summary}</p>{Object.entries(triage.extractedFields).filter(([,value]) => value).map(([key,value]) => <p key={key}><strong>{(dict.fields as Record<string,string>)[key] || key}:</strong> {value}</p>)}{mode === "fallback" && <p className="voice-warning">{t.limited}</p>}</details>}
    {transcript && <details className="voice-facts" open={editing} onToggle={event => setEditing(event.currentTarget.open)}><summary>{t.edit}</summary><textarea aria-label={t.edit} value={transcript} maxLength={4000} onChange={event => setFullText(event.target.value)} rows={5}/><p className="voice-small">{locale === "hi" ? "जाँचते समय इस संशोधित विवरण का उपयोग होगा।" : locale === "te" ? "సమీక్షలో ఈ సవరించిన వివరణ ఉపయోగిస్తాం." : "Your corrected description will be used for review."}</p></details>}
    <details className="voice-text-fallback" open={textOnly || showText} onToggle={event => setShowText(event.currentTarget.open)}><summary>{locale === "hi" ? "लिखकर बात करें" : locale === "te" ? "టైప్ చేసి మాట్లాడండి" : "Type instead"}</summary><div><textarea value={typedText} onChange={event => setTypedText(event.target.value.slice(0, 1000))} aria-label={locale === "hi" ? "अपना संदेश लिखें" : locale === "te" ? "మీ సందేశాన్ని టైప్ చేయండి" : "Type your message"} rows={3}/><button type="button" className="voice-secondary" disabled={!typedText.trim() || phase === "requesting"} onClick={sendText}>{locale === "hi" ? "भेजें" : locale === "te" ? "పంపండి" : "Send"} <ArrowRight size={16}/></button></div></details>
    {error && <p role="alert" className="voice-error"><WarningCircle size={18}/> {error}</p>}</div><div className="conversation-bottom"><button type="button" className="voice-review" disabled={!transcript.trim() || reviewing} onClick={() => void review()}>{reviewing ? t.think : t.review}<ArrowRight size={18}/></button><div className="voice-trust"><Waves size={18}/><p>{t.note}</p></div></div></aside></div>
    <footer className="voice-footer"><span>Designed to make your voice heard.</span><button type="button" onClick={() => { setPendingVoice(false); setNotice(true); }}>Privacy &amp; consent</button><span>EN / हिन्दी / తెలుగు</span></footer>
    {notice && <div className="voice-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setNotice(false); }}><div role="dialog" aria-modal="true" aria-labelledby="voice-consent-title" className="voice-modal"><button type="button" className="voice-modal-close" aria-label={t.close} onClick={() => setNotice(false)}><X size={19}/></button><span className="voice-modal-icon"><SpeakerHigh size={25}/></span><h2 id="voice-consent-title">{locale === "hi" ? "बात करने से पहले" : locale === "te" ? "మాట్లాడే ముందు" : "Before we talk"}</h2><p>{t.consent}</p><p>{t.privacy}</p><p className="voice-modal-disclaimer">{t.note}</p><label><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/><span>{t.change}</span></label><button type="button" disabled={!consent} className="voice-review" onClick={() => { setNotice(false); if (pendingVoice || pendingSend.current) void startSession(pendingVoice, pendingSend.current, true); }}>{locale === "hi" ? "आगे बढ़ें" : locale === "te" ? "కొనసాగండి" : "Continue"} <ArrowRight size={18}/></button></div></div>}
  </div>;
}
