import type { Metadata } from "next";
import CompleteClient from "./complete-client";

export const metadata: Metadata = {
  title: "Business profile — Daftaro",
  description: "Set up your Daftaro business profile.",
  robots: { index: false, follow: false },
};

export default function AuthCompletePage() {
  return <CompleteClient />;
}
