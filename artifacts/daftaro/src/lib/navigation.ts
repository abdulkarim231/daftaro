const ORDER_AREA_PATHS = new Set(["/orders", "/create-order", "/order-details", "/invoice"]);

export function isAppNavActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/orders") return ORDER_AREA_PATHS.has(pathname);
  return pathname === href;
}
