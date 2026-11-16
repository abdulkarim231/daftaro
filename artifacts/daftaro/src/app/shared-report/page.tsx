import type { Metadata } from "next";
import SharedReportClient from "./shared-report-client";

export const metadata: Metadata = {
  title: "Shared Daftarik report",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default function SharedReportPage() {
  return <SharedReportClient />;
}
