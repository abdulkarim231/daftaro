import type { Metadata } from "next";
import OrdersUI from "../orders-ui";

export const metadata: Metadata = {
  title: "Create order | Daftarik",
  description: "Create or edit a customer order in Daftarik.",
};

export default function CreateOrderPage() {
  return <OrdersUI screen="create-order" />;
}
