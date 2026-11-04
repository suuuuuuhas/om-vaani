import type { Metadata } from "next";
import { ReviewClient } from "@/components/review/review-client";

export const metadata: Metadata = {
  title: "Review"
};

export default function ReviewPage() {
  return <ReviewClient />;
}
