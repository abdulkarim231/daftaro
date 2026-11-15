import type { Metadata } from "next";
import OrdersUI from "../orders-ui";

export const metadata: Metadata = {
  title: "Customer invoice | Daftaro",
  description: "View a Daftaro customer invoice.",
  robots: { index: false, follow: false },
};

export default function InvoicePage() {
  return <OrdersUI screen="invoice" />;
}
