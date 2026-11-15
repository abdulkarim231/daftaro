import { calculateFinancialSummaries, type FinancialSummary } from "./financial-summary.ts";
import { parseAmountToMilli } from "./money.ts";

export type DashboardPeriodPreset = "7d" | "30d" | "90d" | "ytd";

export type DashboardDateRange = {
  from: string;
  to: string;
};

export type DashboardTransaction = {
  id: string;
  transaction_type: "income" | "expense";
  amount: string | number;
  currency_code: string;
  transaction_date: string;
  description: string;
  category: string | null;
  created_at: string;
};

export type DashboardComparison = {
  current: FinancialSummary;
  previous: FinancialSummary;
  incomeChangePercentHundredths: bigint | null;
  expensesChangePercentHundredths: bigint | null;
  netProfitChangePercentHundredths: bigint | null;
  marginChangeHundredths: bigint | null;
};

export type DashboardTrendPoint = {
  key: string;
  label: string;
  income: number;
  expenses: number;
  incomeMilli: bigint;
  expensesMilli: bigint;
};

export type ExpenseCategoryTotal = {
  category: string;
  amountMilli: bigint;
  amount: number;
};

const ZERO_SUMMARY: Omit<FinancialSummary, "currency_code"> = {
  totalIncomeMilli: 0n,
  totalExpensesMilli: 0n,
  netProfitMilli: 0n,
  profitMarginHundredths: null,
};

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("A dashboard date must use YYYY-MM-DD format.");
  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  ) {
    throw new Error("A dashboard date is not a valid calendar date.");
  }
  return parsed;
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function addDaysToDateKey(value: string, days: number) {
  const parsed = parseDateKey(value);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toDateKey(parsed);
}

export function getDateRangeForPreset(
  preset: DashboardPeriodPreset,
  today: string,
): DashboardDateRange {
  const end = parseDateKey(today);
  const dayCount =
    preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : null;

  if (dayCount !== null) {
    return { from: addDaysToDateKey(today, 1 - dayCount), to: toDateKey(end) };
  }

  return {
    from: `${end.getUTCFullYear()}-01-01`,
    to: toDateKey(end),
  };
}

export function getPreviousDateRange(range: DashboardDateRange): DashboardDateRange {
  const from = parseDateKey(range.from);
  const to = parseDateKey(range.to);
  const dayCount = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (dayCount < 1) throw new Error("The dashboard date range is invalid.");

  const previousTo = addDaysToDateKey(range.from, -1);
  return {
    from: addDaysToDateKey(previousTo, 1 - dayCount),
    to: previousTo,
  };
}

function zeroSummary(currencyCode: string): FinancialSummary {
  return { currency_code: currencyCode, ...ZERO_SUMMARY };
}

function summarize(
  transactions: DashboardTransaction[],
  currencyCode: string,
) {
  return (
    calculateFinancialSummaries(
      transactions.filter((transaction) => transaction.currency_code === currencyCode),
      currencyCode,
    )[0] ?? zeroSummary(currencyCode)
  );
}

function percentChangeHundredths(current: bigint, previous: bigint) {
  if (previous === 0n) return null;
  const delta = current - previous;
  const absoluteDelta = delta < 0n ? -delta : delta;
  const absolutePrevious = previous < 0n ? -previous : previous;
  const rounded =
    (absoluteDelta * 10_000n + absolutePrevious / 2n) / absolutePrevious;
  return delta < 0n ? -rounded : rounded;
}

export function calculateDashboardComparison(
  currentTransactions: DashboardTransaction[],
  previousTransactions: DashboardTransaction[],
  currencyCode: string,
): DashboardComparison {
  const current = summarize(currentTransactions, currencyCode);
  const previous = summarize(previousTransactions, currencyCode);
  const currentMargin = current.profitMarginHundredths;
  const previousMargin = previous.profitMarginHundredths;

  return {
    current,
    previous,
    incomeChangePercentHundredths: percentChangeHundredths(
      current.totalIncomeMilli,
      previous.totalIncomeMilli,
    ),
    expensesChangePercentHundredths: percentChangeHundredths(
      current.totalExpensesMilli,
      previous.totalExpensesMilli,
    ),
    netProfitChangePercentHundredths: percentChangeHundredths(
      current.netProfitMilli,
      previous.netProfitMilli,
    ),
    marginChangeHundredths:
      currentMargin === null || previousMargin === null
        ? null
        : currentMargin - previousMargin,
  };
}

function dateKeyForBucket(dateKey: string, granularity: "day" | "month" | "year") {
  if (granularity === "day") return dateKey;
  if (granularity === "month") return dateKey.slice(0, 7);
  return dateKey.slice(0, 4);
}

function addBucket(
  value: string,
  granularity: "day" | "month" | "year",
) {
  if (granularity === "day") return addDaysToDateKey(value, 1);
  const date = parseDateKey(`${value.slice(0, 4)}-${value.length === 4 ? "01" : value.slice(5, 7)}-01`);
  if (granularity === "month") date.setUTCMonth(date.getUTCMonth() + 1);
  else date.setUTCFullYear(date.getUTCFullYear() + 1);
  return granularity === "month"
    ? toDateKey(date).slice(0, 7)
    : toDateKey(date).slice(0, 4);
}

function formatBucketLabel(
  bucket: string,
  granularity: "day" | "month" | "year",
  language: "ar" | "en",
) {
  const dateKey =
    granularity === "day"
      ? bucket
      : granularity === "month"
        ? `${bucket}-01`
        : `${bucket}-01-01`;
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(language === "ar" ? "ar-KW" : "en-KW", {
    ...(granularity === "day" ? { day: "numeric", month: "short" } : {}),
    ...(granularity === "month" ? { month: "short", year: "numeric" } : {}),
    ...(granularity === "year" ? { year: "numeric" } : {}),
  }).format(new Date(year, month - 1, day));
}

function toChartValue(amountMilli: bigint) {
  return Number(amountMilli) / 1000;
}

export function buildDashboardTrend(
  transactions: DashboardTransaction[],
  range: DashboardDateRange,
  currencyCode: string,
  language: "ar" | "en",
): DashboardTrendPoint[] {
  const from = parseDateKey(range.from);
  const to = parseDateKey(range.to);
  if (to < from) throw new Error("The dashboard date range is invalid.");
  const spanDays = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const granularity =
    spanDays <= 31 ? "day" : spanDays <= 730 ? "month" : "year";
  const first = dateKeyForBucket(range.from, granularity);
  const last = dateKeyForBucket(range.to, granularity);
  const totals = new Map<string, { income: bigint; expenses: bigint }>();

  for (const transaction of transactions) {
    if (transaction.currency_code !== currencyCode) continue;
    if (transaction.transaction_date < range.from || transaction.transaction_date > range.to) {
      continue;
    }
    const amountMilli = parseAmountToMilli(String(transaction.amount));
    if (amountMilli === null || amountMilli <= 0n) {
      throw new Error("A financial transaction contains an invalid amount.");
    }

    const key = dateKeyForBucket(transaction.transaction_date, granularity);
    const bucket = totals.get(key) ?? { income: 0n, expenses: 0n };
    if (transaction.transaction_type === "income") bucket.income += amountMilli;
    else if (transaction.transaction_type === "expense") bucket.expenses += amountMilli;
    else throw new Error("A financial transaction contains an invalid type.");
    totals.set(key, bucket);
  }

  const result: DashboardTrendPoint[] = [];
  for (let key = first; key <= last; key = addBucket(key, granularity)) {
    const bucket = totals.get(key) ?? { income: 0n, expenses: 0n };
    result.push({
      key,
      label: formatBucketLabel(key, granularity, language),
      income: toChartValue(bucket.income),
      expenses: toChartValue(bucket.expenses),
      incomeMilli: bucket.income,
      expensesMilli: bucket.expenses,
    });
  }
  return result;
}

export function buildExpenseCategoryTotals(
  transactions: DashboardTransaction[],
  range: DashboardDateRange,
  currencyCode: string,
): ExpenseCategoryTotal[] {
  const totals = new Map<string, bigint>();

  for (const transaction of transactions) {
    if (
      transaction.currency_code !== currencyCode ||
      transaction.transaction_type !== "expense" ||
      transaction.transaction_date < range.from ||
      transaction.transaction_date > range.to
    ) {
      continue;
    }
    const amountMilli = parseAmountToMilli(String(transaction.amount));
    if (amountMilli === null || amountMilli <= 0n) {
      throw new Error("A financial transaction contains an invalid amount.");
    }
    const category = transaction.category?.trim() || "other";
    totals.set(category, (totals.get(category) ?? 0n) + amountMilli);
  }

  return [...totals.entries()]
    .map(([category, amountMilli]) => ({
      category,
      amountMilli,
      amount: toChartValue(amountMilli),
    }))
    .sort((left, right) =>
      left.amountMilli === right.amountMilli
        ? left.category.localeCompare(right.category)
        : left.amountMilli > right.amountMilli
          ? -1
          : 1,
    );
}
