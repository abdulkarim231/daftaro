import type { Metadata } from "next";
import ProductsClient from "./products-client";

export const metadata: Metadata = {
  title: "Products and Costs — Daftaro",
  description: "Manage products and understand their per-unit costs and margins.",
  robots: { index: false, follow: false },
};

export default function ProductsPage() {
  return <ProductsClient />;
}
