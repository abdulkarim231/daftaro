import { useMemo, useState } from "react";
import { Activity, BarChart3 } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildDashboardTrend,
  getDateRangeForPreset,
  type DashboardPeriodPreset,
  type DashboardTransaction,
} from "@/lib/dashboard-data";
import { formatMilliAmount } from "@/lib/money";

type Language = "ar" | "en";

export type TransactionsAnalyticsProps = {
  transactions: DashboardTransaction[];
  language: Language;
  currency: string;
};

const PERIODS: DashboardPeriodPreset[] = ["7d", "30d", "90d", "ytd"];

const COPY = {
  en: {
    eyebrow: "CASH FLOW",
    title: "Income & expenses",
    period: "Period",
    periods: {
      "7d": "7 days",
      "30d": "30 days",
      "90d": "90 days",
      ytd: "Year to date",
    },
    income: "Income",
    expenses: "Expenses",
    empty: "No transactions in this period and currency.",
    noRows: "Add a transaction to see your cash flow trend.",
  },
  ar: {
    eyebrow: "حركة النقد",
    title: "الدخل والمصروفات",
    period: "الفترة",
    periods: {
      "7d": "٧ أيام",
      "30d": "٣٠ يومًا",
      "90d": "٩٠ يومًا",
      ytd: "منذ بداية السنة",
    },
    income: "الدخل",
    expenses: "المصروفات",
    empty: "لا توجد معاملات بهذه العملة خلال هذه الفترة.",
    noRows: "أضف معاملة لعرض اتجاه حركة النقد.",
  },
} as const;

function todayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function TransactionsAnalytics({
  transactions,
  language,
  currency,
}: TransactionsAnalyticsProps) {
  const [period, setPeriod] = useState<DashboardPeriodPreset>("30d");
  const rtl = language === "ar";
  const text = COPY[language];
  const range = useMemo(
    () => getDateRangeForPreset(period, todayDateKey()),
    [period],
  );
  const trend = useMemo(
    () => buildDashboardTrend(transactions, range, currency, language),
    [transactions, range, currency, language],
  );
  const hasMatchingTransactions = useMemo(
    () =>
      transactions.some(
        (transaction) =>
          transaction.currency_code === currency &&
          transaction.transaction_date >= range.from &&
          transaction.transaction_date <= range.to,
      ),
    [transactions, currency, range],
  );
  const locale = rtl ? "ar-KW" : "en-KW";
  const tickColor = "#738091";
  const lineColor = "#e2e7ed";

  return (
    <section
      dir={rtl ? "rtl" : "ltr"}
      className="overflow-hidden rounded-[22px] border border-[#e2e7ed] bg-[#fffefa]"
      data-testid="transactions-analytics"
      aria-labelledby="transactions-analytics-title"
    >
      <header className="flex flex-col gap-4 px-5 pb-1 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[#167b70]">
            <Activity size={16} aria-hidden="true" />
            <span className="text-[10px] font-extrabold tracking-[.12em]">
              {text.eyebrow}
            </span>
          </div>
          <h2
            id="transactions-analytics-title"
            className="text-base font-extrabold text-[#101b30]"
          >
            {text.title}
          </h2>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-[#59677c]">
          <span>{text.period}</span>
          <select
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value as DashboardPeriodPreset)
            }
            className="min-h-10 rounded-xl border border-[#dfe5e7] bg-[#fffefa] px-3 text-xs font-bold text-[#172639] outline-none transition focus:border-[#168d78] focus:ring-2 focus:ring-[#168d78]/15"
            data-testid="select-analytics-period"
          >
            {PERIODS.map((value) => (
              <option key={value} value={value}>
                {text.periods[value]}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="px-2 pb-5 pt-4 sm:px-4">
        {!transactions.length ? (
          <div
            className="grid min-h-[290px] place-items-center px-6 text-center"
            data-testid="transactions-analytics-empty"
          >
            <div className="max-w-xs">
              <span className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-[#edf3ef] text-[#167b70]">
                <BarChart3 size={20} aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold text-[#59677c]">{text.noRows}</p>
            </div>
          </div>
        ) : !hasMatchingTransactions || trend.length === 0 ? (
          <div
            className="grid min-h-[290px] place-items-center px-6 text-center text-sm text-[#738091]"
            data-testid="transactions-analytics-empty"
          >
            {text.empty}
          </div>
        ) : (
          <div data-testid="transactions-analytics-chart">
            <ResponsiveContainer width="100%" height={290}>
              <AreaChart
                data={trend}
                margin={{ top: 12, right: rtl ? 0 : 12, left: rtl ? 12 : 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="transaction-income-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#167b70" stopOpacity={0.23} />
                    <stop offset="100%" stopColor="#167b70" stopOpacity={0.015} />
                  </linearGradient>
                  <linearGradient id="transaction-expense-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#bd805c" stopOpacity={0.19} />
                    <stop offset="100%" stopColor="#bd805c" stopOpacity={0.015} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke={lineColor}
                  strokeDasharray="3 5"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: tickColor }}
                  stroke={lineColor}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  orientation={rtl ? "right" : "left"}
                  width={52}
                  tick={{ fontSize: 10, fill: tickColor }}
                  stroke={lineColor}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) =>
                    new Intl.NumberFormat(locale, {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(value)
                  }
                />
                <Tooltip
                  isAnimationActive={false}
                  cursor={{ stroke: "#bac4be", strokeDasharray: "3 3" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: `1px solid ${lineColor}`,
                    background: "#fffefa",
                    color: "#172639",
                    fontSize: 12,
                  }}
                  formatter={(value, name, entry) => {
                    const point = entry?.payload;
                    const amountMilli =
                      name === text.income
                        ? point?.incomeMilli
                        : point?.expensesMilli;
                    return [
                      `${formatMilliAmount(
                        typeof amountMilli === "bigint" ? amountMilli : 0n,
                        language,
                      )} ${currency}`,
                      name,
                    ];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  name={text.income}
                  stroke="#167b70"
                  strokeWidth={2.5}
                  fill="url(#transaction-income-fill)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name={text.expenses}
                  stroke="#bd805c"
                  strokeWidth={2.5}
                  strokeDasharray="5 3"
                  fill="url(#transaction-expense-fill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-1 flex justify-center gap-5 text-xs text-[#59677c]">
              <span className="inline-flex items-center gap-2">
                <i className="h-2 w-2 rounded-full bg-[#167b70]" aria-hidden="true" />
                {text.income}
              </span>
              <span className="inline-flex items-center gap-2">
                <i className="h-2 w-2 rounded-full bg-[#bd805c]" aria-hidden="true" />
                {text.expenses}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
