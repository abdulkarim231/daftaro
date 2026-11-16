import type { Metadata } from "next";
import TransactionsClient from "./transactions-client";

export const metadata: Metadata = {
  title: "Transactions — Daftarik",
  description: "Record and manage your business income and expenses.",
  robots: { index: false, follow: false },
};

export default function TransactionsPage() {
  return <TransactionsClient />;
}
