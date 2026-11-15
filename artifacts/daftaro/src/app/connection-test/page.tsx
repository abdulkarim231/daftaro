import type { Metadata } from "next";
import ConnectionTestClient from "./connection-test-client";

export const metadata: Metadata = {
  title: "Supabase connection check — Daftaro",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ConnectionTestPage() {
  return <ConnectionTestClient />;
}
