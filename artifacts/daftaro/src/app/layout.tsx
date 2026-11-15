import type { Metadata } from "next";
import "../index.css";

export const metadata: Metadata = {
  title: "Daftaro — Financial clarity for small businesses",
  description:
    "A clearer view of income, expenses, and real profit for small businesses in Kuwait and the Gulf.",
  openGraph: {
    title: "Daftaro — Financial clarity for small businesses",
    description:
      "A clearer view of income, expenses, and real profit for small businesses in Kuwait and the Gulf.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
