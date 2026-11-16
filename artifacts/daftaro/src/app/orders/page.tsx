import type { Metadata } from "next";
import OrdersUI from "../orders-ui";

export const metadata: Metadata = {
  title: "Orders | Daftarik",
  description: "Track orders and payment status in Daftarik.",
};

export default function OrdersPage() {
  return <OrdersUI screen="orders" />;
}
