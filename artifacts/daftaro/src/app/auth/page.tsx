import type { Metadata } from "next";
import AuthClient from "./auth-client";

export const metadata: Metadata = {
  title: "Sign in — Daftaro",
  description: "Sign in or create your Daftaro account.",
  robots: { index: false, follow: false },
};

export default function AuthPage() {
  return <AuthClient />;
}
