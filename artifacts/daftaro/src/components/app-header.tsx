"use client";

import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { isAppNavActive } from "../lib/navigation";
import { useHydratedPathname } from "../lib/use-hydrated-pathname";

export type AppLanguage = "ar" | "en";

type AppHeaderProps = {
  language: AppLanguage;
  onLanguageChange: () => void;
  onSignOut: () => void;
  signingOut: boolean;
  isDark?: boolean;
};

const labels = {
  ar: {
    brand: "دفترُك",
    privacy: "بياناتك خاصة وآمنة",
    transactions: "الحركات",
    products: "المنتجات",
    orders: "الطلبات",
    customers: "العملاء",
    profile: "ملف النشاط",
    insights: "الرؤى الذكية",
    language: "EN",
    signOut: "تسجيل الخروج",
    signingOut: "جارٍ الخروج…",
    navigation: "التنقل",
    switchLanguage: "Switch to English",
  },
  en: {
    brand: "Daftaro",
    privacy: "Private to your account",
    transactions: "Transactions",
    products: "Products",
    orders: "Orders",
    customers: "Customers",
    profile: "Business profile",
    insights: "AI insights",
    language: "العربية",
    signOut: "Sign out",
    signingOut: "Signing out…",
    navigation: "Navigation",
    switchLanguage: "Switch to Arabic",
  },
} satisfies Record<AppLanguage, Record<string, string>>;

export function AppHeader({
  language,
  onLanguageChange,
  onSignOut,
  signingOut,
  isDark = false,
}: AppHeaderProps) {
  const pathname = useHydratedPathname();
  const text = labels[language];
  const baseLink = "rounded-full border px-3 py-2 text-xs font-bold transition hover:border-[#d6b878]";
  const linkClass = (href: string) => {
    if (isAppNavActive(pathname, href)) {
      return `${baseLink} ${
        isDark
          ? "border-[#d6b878] bg-[#d6b878]/15 text-[#f0d99d] ring-1 ring-[#d6b878]/30"
          : "border-[#167b70] bg-[#e8f3f0] text-[#12665e] ring-1 ring-[#167b70]/15"
      }`;
    }
    return `${baseLink} ${
      isDark
        ? "border-white/15 bg-white/5 text-[#d9dfeb]"
        : "border-[#dfe5e7] bg-white text-[#526174]"
    }`;
  };
  const buttonClass = `rounded-full border px-3 py-2 text-xs font-bold transition hover:border-[#d6b878] disabled:opacity-60 ${
    isDark
      ? "border-white/15 bg-white/5 text-[#d9dfeb]"
      : "border-[#dfe5e7] bg-white text-[#526174]"
  }`;
  const headerTheme = isDark
    ? "border-white/10 bg-[#121e31]/95"
    : "border-[#e3e8e5] bg-[#f8f9f6]/95";

  return (
    <header className={`print:hidden sticky top-0 z-40 border-b shadow-sm backdrop-blur ${headerTheme}`}>
      <div className="mx-auto flex min-h-[72px] max-w-[1320px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7">
        <Link
          href="/dashboard"
          aria-label={text.brand}
          aria-current={isAppNavActive(pathname, "/dashboard") ? "page" : undefined}
          className={`flex items-center gap-3 rounded-xl transition ${
            isAppNavActive(pathname, "/dashboard")
              ? isDark
                ? "ring-1 ring-[#d6b878]/50"
                : "ring-1 ring-[#167b70]/25"
              : "hover:opacity-80"
          }`}
          data-testid="link-dashboard-brand"
        >
          <span className="relative grid size-10 place-items-center rounded-[13px] bg-[#101b30]">
            <span className="absolute inset-[5px] rounded-[9px] border border-[#d6b878]/70" />
            <span className="relative text-xl font-semibold text-[#d6b878]">د</span>
          </span>
          <span className="flex flex-col">
            <span className={`text-lg font-extrabold tracking-[-.045em] ${isDark ? "text-[#f4f0e7]" : "text-[#101b30]"}`}>
              {text.brand}
            </span>
            <span className="hidden items-center gap-1.5 text-[10px] font-semibold text-[#778596] sm:inline-flex">
              <ShieldCheck size={12} className="text-[#168d78]" />
              {text.privacy}
            </span>
          </span>
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <nav className="flex flex-wrap items-center gap-2" aria-label={text.navigation}>
            <Link href="/transactions" aria-current={isAppNavActive(pathname, "/transactions") ? "page" : undefined} className={linkClass("/transactions")} data-testid="link-transactions">{text.transactions}</Link>
            <Link href="/products" aria-current={isAppNavActive(pathname, "/products") ? "page" : undefined} className={linkClass("/products")} data-testid="link-products">{text.products}</Link>
            <Link href="/orders" aria-current={isAppNavActive(pathname, "/orders") ? "page" : undefined} className={linkClass("/orders")} data-testid="link-orders">{text.orders}</Link>
            <Link href="/customers" aria-current={isAppNavActive(pathname, "/customers") ? "page" : undefined} className={linkClass("/customers")} data-testid="link-customers">{text.customers}</Link>
            <Link href="/insights" aria-current={isAppNavActive(pathname, "/insights") ? "page" : undefined} className={linkClass("/insights")} data-testid="link-ai-insights">{text.insights}</Link>
            <Link href="/auth/complete" aria-current={isAppNavActive(pathname, "/auth/complete") ? "page" : undefined} className={linkClass("/auth/complete")} data-testid="link-business-profile">{text.profile}</Link>
          </nav>
          <button
            type="button"
            onClick={onLanguageChange}
            className={buttonClass}
            aria-label={language === "ar" ? text.switchLanguage : "التبديل إلى العربية"}
            data-testid="button-language"
          >
            {text.language}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            aria-label={signingOut ? text.signingOut : text.signOut}
            className={`inline-flex items-center gap-1.5 ${buttonClass}`}
            data-testid="button-sign-out"
          >
            <LogOut size={14} />
            <span>{signingOut ? text.signingOut : text.signOut}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
