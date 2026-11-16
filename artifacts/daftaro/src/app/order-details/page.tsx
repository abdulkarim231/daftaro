import type { Metadata } from "next";
import OrdersUI from "../orders-ui";

export const metadata: Metadata = {
  title: "Order details | Daftarik",
  description: "Review and update an order in Daftarik.",
};

export default function OrderDetailsPage() {
  return <OrdersUI screen="order-details" />;
}
