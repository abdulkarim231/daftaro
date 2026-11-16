import type { Metadata } from "next";
import InvoiceScannerClient from "./invoice-scanner-client";

export const metadata: Metadata = {
  title: "Invoice reader — Daftaro",
  description: "Read supplier invoices, review their details, and update stock safely.",
  robots: { index: false, follow: false },
};

export default function InvoiceScannerPage() {
  return <InvoiceScannerClient />;
}
