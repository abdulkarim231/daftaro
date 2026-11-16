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
