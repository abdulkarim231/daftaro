import type { Metadata } from "next";
import OrdersUI from "../orders-ui";

export const metadata: Metadata = {
  title: "Customers | Daftarik",
  description: "Manage customer details and order history in Daftarik.",
};

export default function CustomersPage() {
  return <OrdersUI screen="customers" />;
}
