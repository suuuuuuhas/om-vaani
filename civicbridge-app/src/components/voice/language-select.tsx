"use client";
import { useApp } from "@/components/providers/app-provider";

const languages = [
  ["en-IN", "English"], ["hi-IN", "हिन्दी"], ["te-IN", "తెలుగు"], ["ta-IN", "தமிழ்"],
  ["kn-IN", "ಕನ್ನಡ"], ["ml-IN", "മലയാളം"], ["mr-IN", "मराठी"], ["bn-IN", "বাংলা"],
  ["gu-IN", "ગુજરાતી"], ["pa-IN", "ਪੰਜਾਬੀ"]
] as const;

export function VoiceLanguageSelect({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const { locale } = useApp();
  return <label className="mt-3 block text-xs font-semibold">
    {locale === "hi" ? "जवाब की भाषा जाँचें या बदलें" : locale === "te" ? "సమాధాన భాషను పరిశీలించండి లేదా మార్చండి" : "Check or change the response language"}
    <select value={value} onChange={event => onChange(event.target.value)} disabled={disabled} className="mt-1 block min-h-11 w-full rounded-control border border-line bg-surface px-3 text-sm">
      <option value="">{locale === "hi" ? "इंटरफ़ेस की भाषा" : locale === "te" ? "ఇంటర్‌ఫేస్ భాష" : "Use interface language"}</option>
      {languages.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </select>
  </label>;
}
