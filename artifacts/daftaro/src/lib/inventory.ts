const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
export const MAX_INVENTORY_COUNT = 2_147_483_647;

export function parseInventoryCount(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)));
  if (!/^\d+$/.test(normalized)) return null;

  const count = Number(normalized);
  return Number.isSafeInteger(count) && count <= MAX_INVENTORY_COUNT
    ? count
    : null;
}

export function isLowStock(
  availableQuantity: number,
  lowStockThreshold: number,
): boolean {
  return (
    Number.isInteger(availableQuantity)
    && Number.isInteger(lowStockThreshold)
    && availableQuantity >= 0
    && lowStockThreshold >= 0
    && availableQuantity <= lowStockThreshold
  );
}

export interface StockBalance {
  id: string;
  available_quantity: number;
  low_stock_threshold?: number;
}

export interface ReservedStockItem {
  product_id: string | null;
  quantity: number;
}

export interface StockRequestItem {
  product_id: string;
  quantity: number;
}

export interface StockShortage {
  product_id: string;
  requested: number;
  available: number;
}

export interface StockLowWarning {
  product_id: string;
  requested: number;
  available: number;
  remaining: number;
  threshold: number;
}

function requestedQuantityByProduct(requestedItems: StockRequestItem[]) {
  const requestedByProduct = new Map<string, number>();
  for (const item of requestedItems) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) continue;
    requestedByProduct.set(
      item.product_id,
      (requestedByProduct.get(item.product_id) ?? 0) + item.quantity,
    );
  }
  return requestedByProduct;
}

export function availableQuantityForOrder(
  productId: string,
  products: StockBalance[],
  reservedItems: ReservedStockItem[] = [],
): number | null {
  const product = products.find((candidate) => candidate.id === productId);
  if (!product) return null;

  const alreadyReserved = reservedItems
    .filter((item) => item.product_id === productId)
    .reduce((total, item) => total + item.quantity, 0);
  return product.available_quantity + alreadyReserved;
}

export function findStockShortages(
  requestedItems: StockRequestItem[],
  products: StockBalance[],
  reservedItems: ReservedStockItem[] = [],
): StockShortage[] {
  return [...requestedQuantityByProduct(requestedItems)].flatMap(([productId, requested]) => {
    const available = availableQuantityForOrder(productId, products, reservedItems);
    return available !== null && requested > available
      ? [{ product_id: productId, requested, available }]
      : [];
  });
}

export function findLowStockWarnings(
  requestedItems: StockRequestItem[],
  products: StockBalance[],
  reservedItems: ReservedStockItem[] = [],
): StockLowWarning[] {
  return [...requestedQuantityByProduct(requestedItems)].flatMap(([productId, requested]) => {
    const product = products.find((candidate) => candidate.id === productId);
    const available = availableQuantityForOrder(productId, products, reservedItems);
    const threshold = product?.low_stock_threshold;
    if (
      available === null
      || !Number.isInteger(threshold)
      || threshold === undefined
      || requested > available
    ) return [];

    const remaining = available - requested;
    return isLowStock(remaining, threshold)
      ? [{ product_id: productId, requested, available, remaining, threshold }]
      : [];
  });
}
