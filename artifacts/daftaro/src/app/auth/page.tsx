import type { Metadata } from "next";
import AuthClient from "./auth-client";

export const metadata: Metadata = {
  title: "Sign in — Daftarik",
  description: "Sign in or create your Daftarik account.",
  robots: { index: false, follow: false },
};

export default function AuthPage() {
  return <AuthClient mode="signin" />;
}
