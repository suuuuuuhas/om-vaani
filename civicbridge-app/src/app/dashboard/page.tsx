import type { Metadata } from "next";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const metadata: Metadata = {
  title: "My cases"
};

export default function DashboardPage() {
  return <DashboardClient />;
}
