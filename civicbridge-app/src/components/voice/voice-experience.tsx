"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Microphone, Pause, SpeakerHigh, WarningCircle, Waves, X } from "@phosphor-icons/react";
import { useApp } from "@/components/providers/app-provider";
import { checkSensitiveContent } from "@/lib/privacy/guard";
import { getDictionary } from "@/lib/i18n";
import { wavBlob } from "@/lib/voice/wav";
import type { ExecutionMode, TriageResult } from "@/lib/types";

const words = {
  en: { title: "I'm listening.", intro: "Tell me what's on your mind. We'll figure out the next step together.", idle: "Ready when you are", recording: "Listening to you", working: "Let me understand", speaking: "Vaani is speaking", tap: "Tap to speak", stop: "I'm done speaking", think: "One moment…", again: "Add more by voice", review: "Review what I heard", hear: "Listen again", consent: "I agree to send my voice and Vaani's spoken replies to Gnani, and my words to Google Gemini, for this conversation.", privacy: "Please don't share passwords, OTPs, bank details or Aadhaar numbers.", note: "Independent prototype · Your case is not filed automatically", heard: "WHAT I HEARD", reply: "VAANI'S RESPONSE", empty: "Your words will appear here so you can check them.", edit: "Edit transcript", apply: "Update understanding", language: "RESPONSE LANGUAGE", blocked: "Please remove sensitive identifiers before continuing.", micError: "I couldn't access your microphone. Check your browser permissions and try again.", failure: "I couldn't complete that request. Please try again.", long: "This conversation is too long. Please shorten the transcript before continuing.", limited: "AI is unavailable right now. This is a basic suggestion; please review it carefully.", audioError: "Audio couldn't play automatically. Use the playback control to listen.", min: "Please tell me a little more about what happened.", change: "I have read and agree to the voice and AI processing notice.", close: "Close", languageHint: "Language detected automatically; you can change the response language.", ask: "Is there anything else you'd like to add?", saved: "Your words stay on this device until you choose to process them." },
  hi: { title: "मैं सुन रही हूँ।", intro: "अपनी बात बताइए। हम मिलकर आगे का रास्ता समझेंगे।", idle: "जब आप तैयार हों", recording: "मैं सुन रही हूँ", working: "मैं समझ रही हूँ", speaking: "वाणी बोल रही है", tap: "बोलने के लिए दबाएँ", stop: "बोलना पूरा हुआ", think: "एक पल…", again: "और जानकारी बोलें", review: "सुनी हुई बात जाँचें", hear: "फिर सुनें", consent: "मैं इस बातचीत में अपनी आवाज़ और वाणी के बोले गए जवाब Gnani को और अपने शब्द Google Gemini को भेजने की सहमति देता/देती हूँ।", privacy: "पासवर्ड, OTP, बैंक या आधार नंबर न बताएँ।", note: "स्वतंत्र प्रोटोटाइप · शिकायत अपने आप दर्ज नहीं होती", heard: "मैंने यह सुना", reply: "वाणी का जवाब", empty: "आपकी बात यहाँ दिखेगी ताकि आप जाँच सकें।", edit: "लिखित विवरण सुधारें", apply: "फिर जाँचें", language: "जवाब की भाषा", blocked: "आगे बढ़ने से पहले संवेदनशील पहचान विवरण हटाएँ।", micError: "माइक्रोफ़ोन उपलब्ध नहीं है। ब्राउज़र की अनुमति जाँचकर फिर कोशिश करें।", failure: "यह अनुरोध पूरा नहीं हो सका। कृपया फिर कोशिश करें।", long: "बातचीत बहुत लंबी है। आगे बढ़ने से पहले विवरण छोटा करें।", limited: "AI अभी उपलब्ध नहीं है। यह एक बुनियादी सुझाव है; कृपया जाँचें।", audioError: "आवाज़ अपने आप नहीं चली। सुनने के लिए प्ले दबाएँ।", min: "कृपया बताइए क्या हुआ।", change: "मैंने आवाज़ और AI प्रोसेसिंग की सूचना पढ़ी और सहमति दी है।", close: "बंद करें", languageHint: "भाषा अपने आप पहचानी जाती है; जवाब की भाषा बदल सकते हैं।", ask: "क्या आप कुछ और जोड़ना चाहेंगे?", saved: "प्रोसेस करने से पहले आपके शब्द इसी डिवाइस पर रहते हैं।" },
  te: { title: "నేను వింటున్నాను.", intro: "ఏం జరిగిందో చెప్పండి. కలిసి తర్వాతి మార్గాన్ని తెలుసుకుందాం.", idle: "మీరు సిద్ధమైనప్పుడు", recording: "మీ మాట వింటున్నాను", working: "అర్థం చేసుకుంటున్నాను", speaking: "వాణి మాట్లాడుతోంది", tap: "మాట్లాడటానికి నొక్కండి", stop: "చెప్పడం పూర్తయింది", think: "ఒక్క క్షణం…", again: "మరిన్ని వివరాలు చెప్పండి", review: "నేను విన్నది పరిశీలించండి", hear: "మళ్లీ వినండి", consent: "ఈ సంభాషణలో నా వాయిస్, వాణి మాట్లాడే సమాధానాలను Gnaniకి, నా మాటలను Google Geminiకి పంపడానికి అంగీకరిస్తున్నాను.", privacy: "పాస్‌వర్డ్‌లు, OTPలు, బ్యాంకు లేదా ఆధార్ నంబర్లు చెప్పవద్దు.", note: "స్వతంత్ర ప్రోటోటైప్ · ఫిర్యాదు స్వయంగా నమోదు కాదు", heard: "నేను విన్నది", reply: "వాణి సమాధానం", empty: "మీ మాటలు పరిశీలించడానికి ఇక్కడ కనిపిస్తాయి.", edit: "వచనాన్ని సవరించండి", apply: "మళ్లీ విశ్లేషించండి", language: "సమాధాన భాష", blocked: "కొనసాగడానికి ముందు సున్నితమైన గుర్తింపు వివరాలను తొలగించండి.", micError: "మైక్రోఫోన్ అందుబాటులో లేదు. బ్రౌజర్ అనుమతిని పరిశీలించి మళ్లీ ప్రయత్నించండి.", failure: "అభ్యర్థనను పూర్తి చేయలేకపోయాం. మళ్లీ ప్రయత్నించండి.", long: "వివరణ చాలా పొడవుగా ఉంది. కొనసాగడానికి ముందు కుదించండి.", limited: "AI అందుబాటులో లేదు. ఇది ప్రాథమిక సూచన; దయచేసి పరిశీలించండి.", audioError: "వాయిస్ స్వయంగా ప్లే కాలేదు. వినడానికి ప్లే నొక్కండి.", min: "ఏం జరిగిందో ఇంకాస్త వివరించండి.", change: "వాయిస్, AI ప్రాసెసింగ్ వివరాలు చదివి అంగీకరిస్తున్నాను.", close: "మూసివేయండి", languageHint: "భాష స్వయంగా గుర్తించబడుతుంది; సమాధాన భాషను మార్చవచ్చు.", ask: "ఇంకా ఏమైనా చెప్పాలనుకుంటున్నారా?", saved: "ప్రాసెస్ చేయడానికి ముందు మీ మాటలు ఈ పరికరంలో ఉంటాయి." }
} as const;
const responseLanguages = [["en-IN", "English"], ["hi-IN", "हिन्दी"], ["te-IN", "తెలుగు"], ["ta-IN", "தமிழ்"], ["kn-IN", "ಕನ್ನಡ"], ["ml-IN", "മലയാളം"], ["mr-IN", "मराठी"], ["bn-IN", "বাংলা"], ["gu-IN", "ગુજરાતી"], ["pa-IN", "ਪੰਜਾਬੀ"]] as const;
type Phase = "idle" | "requesting" | "listening" | "thinking" | "speaking";
type Capture = { context: AudioContext; stream: MediaStream; processor: ScriptProcessorNode; chunks: Float32Array[]; timer: ReturnType<typeof setTimeout> };

function Face({ phase }: { phase: Phase }) {
  return <div className={`vaani-face vaani-face--${phase}`} aria-hidden="true">
    <div className="vaani-hair-back"/><div className="vaani-neck"/><div className="vaani-shoulders"/>
    <div className="vaani-head"><div className="vaani-hair-top"/><div className="vaani-bindi"/><div className="vaani-brow vaani-brow--left"/><div className="vaani-brow vaani-brow--right"/><div className="vaani-eye vaani-eye--left"><i/></div><div className="vaani-eye vaani-eye--right"><i/></div><div className="vaani-nose"/><div className="vaani-blush vaani-blush--left"/><div className="vaani-blush vaani-blush--right"/><div className="vaani-mouth"/></div>
    <div className="vaani-ear vaani-ear--left"/><div className="vaani-ear vaani-ear--right"/>
  </div>;
}

export function VoiceExperience() {
  const router = useRouter();
  const { locale, setLocale, saveDraft } = useApp();
  const t = words[locale];
  const [phase, setPhase] = useState<Phase>("idle");
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [editing, setEditing] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState("");
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [spokenReply, setSpokenReply] = useState("");
  const [analysedLanguage, setAnalysedLanguage] = useState("");
  const [analysedText, setAnalysedText] = useState("");
  const [mode, setMode] = useState<ExecutionMode>("fallback");
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioBlocked, setAudioBlocked] = useState(false);
  const capture = useRef<Capture | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const mounted = useRef(false);
  const transcriptRef = useRef("");
  const localeRef = useRef(locale); localeRef.current = locale;
  const languageRef = useRef(voiceLanguage); languageRef.current = voiceLanguage;
  const analysing = useRef(false);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; const c = capture.current; if (c) { clearTimeout(c.timer); c.processor.disconnect(); c.stream.getTracks().forEach(track => track.stop()); void c.context.close(); capture.current = null; } audio.current?.pause(); if (url.current) URL.revokeObjectURL(url.current); }; }, []);
  function updateText(value: string) { transcriptRef.current = value; setTranscript(value); }
  async function analyse(text: string, lang: string, nextLocale = localeRef.current) {
    if (analysing.current) return;
    if (text.trim().length < 20) { setError(words[nextLocale].min); setPhase("idle"); return; }
    if (text.length > 4000) { setError(words[nextLocale].long); setPhase("idle"); return; }
    if (!checkSensitiveContent(text).ok) { setError(words[nextLocale].blocked); setPhase("idle"); return; }
    analysing.current = true; setError(""); setPhase("thinking"); setAudioBlocked(false);
    try {
      const response = await fetch("/api/ai/triage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.trim(), locale: nextLocale, voiceLanguage: lang || undefined }) });
      if (!response.ok) throw new Error("analysis");
      const result = await response.json() as { data: TriageResult; mode: ExecutionMode };
      if (!mounted.current) return;
      setTriage(result.data); setAnalysedText(text.trim()); setAnalysedLanguage(lang); setMode(result.mode);
      const safeFollowups = ["merchant", "productName", "amount", "purchaseDate", "journeyDate"];
      const missing = result.data.missingFields.find(key => safeFollowups.includes(key));
      const label = missing ? (getDictionary(nextLocale).fields as Record<string, string>)[missing] : undefined;
      const question = label ? (nextLocale === "hi" ? `क्या आप ${label} बता सकते हैं?` : nextLocale === "te" ? `దయచేసి ${label} చెప్పగలరా?` : `Could you tell me the ${label.toLowerCase()}?`) : words[nextLocale].ask;
      const proposedReply = result.mode !== "fallback" ? result.data.assistantReply : undefined;
      const answer = proposedReply && checkSensitiveContent(proposedReply).ok ? proposedReply : result.data.summary + (lang && !["en-IN", "hi-IN", "te-IN"].includes(lang) ? "" : ` ${question}`);
      setSpokenReply(answer);
      const speech = await fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: answer, language: result.mode === "fallback" ? `${nextLocale}-IN` : lang || `${nextLocale}-IN` }) });
      if (!speech.ok) { setError(words[nextLocale].audioError); return; }
      const blob = await speech.blob(); if (!mounted.current) return;
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(blob); setAudioUrl(url.current);
      const player = new Audio(url.current); audio.current = player;
      player.onended = () => { if (mounted.current) setPhase("idle"); };
      setPhase("speaking");
      try { await player.play(); } catch { setAudioBlocked(true); setPhase("idle"); }
    } catch { if (mounted.current) setError(words[nextLocale].failure); }
    finally { analysing.current = false; if (mounted.current) setPhase(current => current === "speaking" ? current : "idle"); }
  }
  async function finishRecording() {
    const current = capture.current; if (!current) return;
    capture.current = null; clearTimeout(current.timer); current.processor.disconnect(); current.stream.getTracks().forEach(track => track.stop());
    setPhase("thinking");
    try {
      const wav = wavBlob(current.chunks, current.context.sampleRate); await current.context.close();
      const form = new FormData(); form.append("audio", wav, "recording.wav");
      const response = await fetch("/api/voice/transcribe", { method: "POST", body: form });
      const result = await response.json() as { transcript?: string; language?: string | null; error?: string };
      if (!response.ok || !result.transcript) throw new Error("transcription");
      if (!mounted.current) return;
      const combined = [transcriptRef.current.trim(), result.transcript.trim()].filter(Boolean).join(" ");
      if (combined.length > 4000) { setError(words[localeRef.current].long); setPhase("idle"); return; }
      updateText(combined);
      const lang = result.language || languageRef.current;
      if (result.language) setVoiceLanguage(result.language);
      const detected = result.language?.slice(0, 2);
      const nextLocale = detected === "en" || detected === "hi" || detected === "te" ? detected : localeRef.current;
      if (nextLocale !== localeRef.current) setLocale(nextLocale);
      await analyse(combined, lang, nextLocale);
    } catch { if (mounted.current) { setError(words[localeRef.current].failure); setPhase("idle"); } }
  }
  async function startRecording() {
    if (!consent) { setNotice(true); return; }
    setError(""); setPhase("requesting"); audio.current?.pause();
    if (url.current) { URL.revokeObjectURL(url.current); url.current = null; setAudioUrl(""); }
    let stream: MediaStream | undefined; let context: AudioContext | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { stream.getTracks().forEach(track => track.stop()); return; }
      context = new AudioContext(); const source = context.createMediaStreamSource(stream), processor = context.createScriptProcessor(4096, 1, 1), chunks: Float32Array[] = [];
      processor.onaudioprocess = event => chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      const mute = context.createGain(); mute.gain.value = 0; source.connect(processor); processor.connect(mute); mute.connect(context.destination);
      const timer = setTimeout(() => void finishRecording(), 27000);
      capture.current = { context, stream, processor, chunks, timer }; setPhase("listening");
    } catch { stream?.getTracks().forEach(track => track.stop()); if (context) void context.close(); if (mounted.current) { setError(words[localeRef.current].micError); setPhase("idle"); } }
  }
  function review() {
    if (!triage || transcript.trim() !== analysedText) return;
    audio.current?.pause(); saveDraft({ text: transcript.trim(), locale, voiceLanguage: voiceLanguage || undefined, triage, mode }); router.push("/review");
  }
  const status = phase === "listening" ? t.recording : phase === "thinking" ? t.working : phase === "speaking" ? t.speaking : t.idle;
  const canReview = Boolean(triage && transcript.trim() === analysedText && voiceLanguage === analysedLanguage);
  return <div className="voice-experience">
    <header className="voice-topbar"><Link href="/" className="voice-brand"><span className="voice-brand-mark">ॐ</span><span>Civic Sathi<small>PROJECT OM SATY</small></span></Link><div className="voice-top-actions"><div className="voice-locale" aria-label="Interface language">{(["en", "hi", "te"] as const).map(l => <button key={l} type="button" className={locale === l ? "active" : ""} onClick={() => setLocale(l)}>{l === "en" ? "EN" : l === "hi" ? "हिं" : "తె"}</button>)}</div><Link className="voice-dashboard-link" href="/dashboard">{locale === "hi" ? "मेरे मामले" : locale === "te" ? "నా కేసులు" : "My cases"} <ArrowRight size={15}/></Link></div></header>
    <div className="voice-layout"><section className="voice-stage" aria-label="Vaani voice assistant"><div className="voice-stage-inner"><div className="voice-eyebrow"><span className="voice-spark">✳</span> {locale === "hi" ? "आपकी नागरिक साथी" : locale === "te" ? "మీ పౌర సహచరి" : "YOUR CIVIC COMPANION"}</div><div className="voice-orbit"><div className="voice-orbit-ring voice-orbit-ring--one"/><div className="voice-orbit-ring voice-orbit-ring--two"/><div className="voice-orbit-glow"/><Face phase={phase}/><div className="voice-avatar-label"><span className="voice-status-dot"/> VAANI SATY</div></div><div className="voice-state" role="status"><span className={`voice-status-dot ${phase === "listening" ? "is-live" : ""}`}/>{status}</div><h1>{phase === "listening" ? t.recording : phase === "thinking" ? t.working : phase === "speaking" ? t.speaking : t.title}</h1><p className="voice-intro">{t.intro}</p><button className={`voice-mic ${phase === "listening" ? "is-listening" : ""}`} type="button" disabled={phase === "requesting" || phase === "thinking"} onClick={phase === "listening" ? () => void finishRecording() : () => void startRecording()} aria-label={phase === "listening" ? t.stop : t.tap}>{phase === "listening" ? <Pause size={27} weight="fill"/> : <Microphone size={27} weight="fill"/>}</button><p className="voice-mic-label">{phase === "listening" ? t.stop : phase === "thinking" || phase === "requesting" ? t.think : transcript ? t.again : t.tap}</p><p className="voice-mic-meta">{t.privacy}</p></div></section>
    <aside className="voice-conversation"><div className="conversation-top"><div><p className="conversation-kicker">{locale === "hi" ? "आपकी बातचीत" : locale === "te" ? "మీ సంభాషణ" : "YOUR CONVERSATION"}</p><h2>{locale === "hi" ? "वाणी के साथ" : locale === "te" ? "వాణితో" : "With Vaani"}<span className="conversation-star">✳</span></h2></div><span className="voice-live-badge"><span/> LIVE ASSISTANT</span></div><div className="conversation-body"><div className="conversation-intro"><div className="mini-avatar">✳</div><div><strong>Vaani Saty</strong><p>{t.intro}</p></div></div><div className="conversation-divider"/><div className="conversation-section"><span className="conversation-label">{t.heard}</span>{transcript ? <><p className="conversation-transcript">{transcript}</p><button className="voice-text-link" type="button" onClick={() => setEditing(!editing)}>{t.edit}</button>{editing && <><textarea aria-label={t.edit} value={transcript} maxLength={4000} onChange={e => updateText(e.target.value)} rows={5}/><button className="voice-secondary" type="button" disabled={phase !== "idle" || !consent} onClick={() => void analyse(transcript, voiceLanguage)}>{t.apply} <ArrowRight size={16}/></button></>}</> : <p className="conversation-empty">{t.empty}</p>}</div>{triage && <div className="conversation-section response-section"><span className="conversation-label">{t.reply}</span><p>{spokenReply || triage.summary}</p>{mode === "fallback" && <p className="voice-warning"><WarningCircle size={16}/> {t.limited}</p>}{audioUrl && <audio controls src={audioUrl} className="voice-audio" aria-label={t.hear}/ >}{audioBlocked && <p className="voice-warning">{t.audioError}</p>}</div>}{voiceLanguage && <label className="voice-language">{t.language}<select value={voiceLanguage} onChange={e => setVoiceLanguage(e.target.value)}>{responseLanguages.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><small>{t.languageHint}</small>{voiceLanguage !== analysedLanguage && <button className="voice-secondary" type="button" disabled={phase !== "idle"} onClick={() => void analyse(transcript, voiceLanguage)}>{t.apply} <ArrowRight size={16}/></button>}</label>}{error && <p role="alert" className="voice-error"><WarningCircle size={18}/> {error}</p>}</div><div className="conversation-bottom"><button type="button" className="voice-review" disabled={!canReview || phase === "thinking" || phase === "listening" || phase === "requesting"} onClick={review}>{t.review}<ArrowRight size={18}/></button><div className="voice-trust"><Waves size={18}/><p>{t.note}</p></div></div></aside></div>
    <footer className="voice-footer"><span>Designed to make your voice heard.</span><button type="button" onClick={() => setNotice(true)}>Privacy &amp; consent</button><span>EN / हिन्दी / తెలుగు</span></footer>
    {notice && <div className="voice-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setNotice(false); }}><div role="dialog" aria-modal="true" aria-labelledby="voice-consent-title" className="voice-modal"><button type="button" className="voice-modal-close" aria-label={t.close} onClick={() => setNotice(false)}><X size={19}/></button><span className="voice-modal-icon"><SpeakerHigh size={25}/></span><h2 id="voice-consent-title">{locale === "hi" ? "बात करने से पहले" : locale === "te" ? "మాట్లాడే ముందు" : "Before we talk"}</h2><p>{t.consent}</p><p>{t.privacy}</p><p className="voice-modal-disclaimer">{t.note}</p><label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>{t.change}</span></label><button type="button" disabled={!consent} className="voice-review" onClick={() => setNotice(false)}>{locale === "hi" ? "आगे बढ़ें" : locale === "te" ? "కొనసాగండి" : "Continue"} <ArrowRight size={18}/></button></div></div>}
  </div>;
}
