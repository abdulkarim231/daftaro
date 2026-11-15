export type MoneyLanguage = "ar" | "en";

export type ProductMetrics = {
  sellingPriceMilli: bigint;
  totalCostMilli: bigint;
  unitProfitMilli: bigint;
  marginHundredths: bigint;
};

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const INPUT_AMOUNT_PATTERN = /^\d{1,11}(?:\.\d{1,3})?$/;

export function normalizeMoneyInput(value: string) {
  return value
    .trim()
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace("٫", ".");
}

export function parseAmountToMilli(value: string): bigint | null {
  const normalized = normalizeMoneyInput(value);
  if (!INPUT_AMOUNT_PATTERN.test(normalized)) return null;

  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
}

export function milliToDatabaseValue(value: bigint) {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / 1000n;
  const fraction = String(absolute % 1000n).padStart(3, "0");
  return `${sign}${whole}.${fraction}`;
}

export function calculateProductMetrics(
  sellingPrice: string,
  materialsCost: string,
  packagingCost: string,
  otherCost: string,
): ProductMetrics | null {
  const sellingPriceMilli = parseAmountToMilli(sellingPrice);
  const materialsCostMilli = parseAmountToMilli(materialsCost);
  const packagingCostMilli = parseAmountToMilli(packagingCost);
  const otherCostMilli = parseAmountToMilli(otherCost);

  if (
    sellingPriceMilli === null ||
    sellingPriceMilli <= 0n ||
    materialsCostMilli === null ||
    packagingCostMilli === null ||
    otherCostMilli === null
  ) {
    return null;
  }

  const totalCostMilli =
    materialsCostMilli + packagingCostMilli + otherCostMilli;
  const unitProfitMilli = sellingPriceMilli - totalCostMilli;
  const absoluteNumerator =
    (unitProfitMilli < 0n ? -unitProfitMilli : unitProfitMilli) * 10_000n;
  const roundedMargin =
    (absoluteNumerator + sellingPriceMilli / 2n) / sellingPriceMilli;

  return {
    sellingPriceMilli,
    totalCostMilli,
    unitProfitMilli,
    marginHundredths: unitProfitMilli < 0n ? -roundedMargin : roundedMargin,
  };
}

export function formatMilliAmount(value: bigint, language: MoneyLanguage) {
  const locale = language === "ar" ? "ar-KW" : "en-KW";
  const absolute = value < 0n ? -value : value;
  const integerFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  });
  const fractionFormatter = new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumIntegerDigits: 3,
    maximumFractionDigits: 0,
  });
  const decimalSeparator =
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? ".";
  const minusSign =
    integerFormatter
      .formatToParts(-1n)
      .find((part) => part.type === "minusSign")?.value ?? "-";

  return `${value < 0n ? minusSign : ""}${integerFormatter.format(
    absolute / 1000n,
  )}${decimalSeparator}${fractionFormatter.format(Number(absolute % 1000n))}`;
}

export function formatMarginHundredths(
  value: bigint,
  language: MoneyLanguage,
) {
  const locale = language === "ar" ? "ar-KW" : "en-KW";
  const absolute = value < 0n ? -value : value;
  const integerFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  });
  const fractionFormatter = new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumIntegerDigits: 2,
    maximumFractionDigits: 0,
  });
  const decimalSeparator =
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? ".";
  const minusSign =
    integerFormatter
      .formatToParts(-1n)
      .find((part) => part.type === "minusSign")?.value ?? "-";
  const percentSign =
    new Intl.NumberFormat(locale, { style: "percent" })
      .formatToParts(0)
      .find((part) => part.type === "percentSign")?.value ?? "%";

  return `${value < 0n ? minusSign : ""}${integerFormatter.format(
    absolute / 100n,
  )}${decimalSeparator}${fractionFormatter.format(
    Number(absolute % 100n),
  )}\u00a0${percentSign}`;
}
