import { parseAmountToMilli } from "./money.ts";

export type FinancialTransaction = {
  transaction_type: "income" | "expense";
  amount: string | number;
  currency_code: string;
};

export type FinancialSummary = {
  currency_code: string;
  totalIncomeMilli: bigint;
  totalExpensesMilli: bigint;
  netProfitMilli: bigint;
  profitMarginHundredths: bigint | null;
};

type Accumulator = {
  currency_code: string;
  totalIncomeMilli: bigint;
  totalExpensesMilli: bigint;
};

function calculateMarginHundredths(
  netProfitMilli: bigint,
  totalIncomeMilli: bigint,
) {
  if (totalIncomeMilli === 0n) return null;

  const absoluteNumerator =
    (netProfitMilli < 0n ? -netProfitMilli : netProfitMilli) * 10_000n;
  const roundedMargin =
    (absoluteNumerator + totalIncomeMilli / 2n) / totalIncomeMilli;

  return netProfitMilli < 0n ? -roundedMargin : roundedMargin;
}

export function calculateFinancialSummaries(
  transactions: FinancialTransaction[],
  primaryCurrency?: string,
): FinancialSummary[] {
  const byCurrency = new Map<string, Accumulator>();

  for (const transaction of transactions) {
    const amountMilli = parseAmountToMilli(String(transaction.amount));
    if (amountMilli === null || amountMilli <= 0n) {
      throw new Error("A financial transaction contains an invalid amount.");
    }
    if (!transaction.currency_code) {
      throw new Error("A financial transaction is missing its currency.");
    }

    const summary = byCurrency.get(transaction.currency_code) ?? {
      currency_code: transaction.currency_code,
      totalIncomeMilli: 0n,
      totalExpensesMilli: 0n,
    };

    if (transaction.transaction_type === "income") {
      summary.totalIncomeMilli += amountMilli;
    } else if (transaction.transaction_type === "expense") {
      summary.totalExpensesMilli += amountMilli;
    } else {
      throw new Error("A financial transaction contains an invalid type.");
    }

    byCurrency.set(transaction.currency_code, summary);
  }

  return [...byCurrency.values()]
    .map((summary) => {
      const netProfitMilli =
        summary.totalIncomeMilli - summary.totalExpensesMilli;
      return {
        ...summary,
        netProfitMilli,
        profitMarginHundredths: calculateMarginHundredths(
          netProfitMilli,
          summary.totalIncomeMilli,
        ),
      };
    })
    .sort((left, right) => {
      if (left.currency_code === primaryCurrency) return -1;
      if (right.currency_code === primaryCurrency) return 1;
      return left.currency_code.localeCompare(right.currency_code);
    });
}
