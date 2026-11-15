import type { Metadata } from "next";
import OrdersUI from "../orders-ui";

export const metadata: Metadata = {
  title: "Customers | Daftaro",
  description: "Manage customer details and order history in Daftaro.",
};

export default function CustomersPage() {
  return <OrdersUI screen="customers" />;
}
