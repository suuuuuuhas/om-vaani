import type { Metadata } from "next";
import { VoiceExperience } from "@/components/voice/voice-experience";
export const metadata: Metadata = { title: "Talk to Vaani", description: "A voice-first space to prepare a grievance." };
export default function HomePage() { return <VoiceExperience />; }
