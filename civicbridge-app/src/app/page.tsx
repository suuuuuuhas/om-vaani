import type { Metadata } from "next";
import { IntakeSection } from "@/components/intake/intake-section";

export const metadata: Metadata = {
  title: "Civic Sathi - grievance navigator prototype",
  description:
    "Describe a grievance in your own words. Civic Sathi identifies the right system, prepares the case, tracks it, and suggests sourced next steps."
};

export default function HomePage() {
  return <IntakeSection />;
}
