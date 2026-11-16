import type { Metadata } from "next";
import AuthClient from "../auth-client";

export const metadata: Metadata = {
  title: "Create an account — Daftarik",
  description: "Create your Daftarik account.",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return <AuthClient mode="signup" />;
}
