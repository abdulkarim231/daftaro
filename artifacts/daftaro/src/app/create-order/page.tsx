import type { Metadata } from "next";
import OrdersUI from "../orders-ui";

export const metadata: Metadata = {
  title: "Create order | Daftaro",
  description: "Create or edit a customer order in Daftaro.",
};

export default function CreateOrderPage() {
  return <OrdersUI screen="create-order" />;
}
