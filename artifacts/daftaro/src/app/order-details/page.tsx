import type { Metadata } from "next";
import OrdersUI from "../orders-ui";

export const metadata: Metadata = {
  title: "Order details | Daftaro",
  description: "Review and update an order in Daftaro.",
};

export default function OrderDetailsPage() {
  return <OrdersUI screen="order-details" />;
}
