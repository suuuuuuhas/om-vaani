import type { Metadata } from "next";
import { CaseClient } from "@/components/case/case-client";

export const metadata: Metadata = {
  title: "Case detail"
};

export default async function CasePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CaseClient caseId={id} />;
}
