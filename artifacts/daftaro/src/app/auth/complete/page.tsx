import type { Metadata } from "next";
import CompleteClient from "./complete-client";

export const metadata: Metadata = {
  title: "Business profile — Daftarik",
  description: "Set up your Daftarik business profile.",
  robots: { index: false, follow: false },
};

export default function AuthCompletePage() {
  return <CompleteClient />;
}
