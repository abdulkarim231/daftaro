import type { Metadata } from "next";
import CallbackClient from "./callback-client";

export const metadata: Metadata = {
  title: "Confirming your account — Daftarik",
  robots: { index: false, follow: false },
};

export default function AuthCallbackPage() {
  return <CallbackClient />;
}
