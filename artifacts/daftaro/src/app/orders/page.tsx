import type { Metadata } from "next";
import OrdersUI from "../orders-ui";

export const metadata: Metadata = {
  title: "Orders | Daftaro",
  description: "Track orders and payment status in Daftaro.",
};

export default function OrdersPage() {
  return <OrdersUI screen="orders" />;
}
