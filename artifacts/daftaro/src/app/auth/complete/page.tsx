import type { Metadata } from "next";
import CompleteClient from "./complete-client";

export const metadata: Metadata = {
  title: "Account ready — Daftaro",
  robots: { index: false, follow: false },
};

export default function AuthCompletePage() {
  return <CompleteClient />;
}
