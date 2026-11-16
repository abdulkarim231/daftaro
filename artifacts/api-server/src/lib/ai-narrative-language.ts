import type { AiLanguage } from "./ai-analysis";

type MonthlyTotals = {
  from: string;
  to: string;
  income: string;
  expenses: string;
  netProfit: string;
  marginPercent: string | null;
};

export type AnalysisLanguageFacts = {
  currencyCode: string;
  monthToDate: MonthlyTotals;
  previousMonth: Pick<MonthlyTotals, "income">;
};

export type AiNarrative = {
  summary: string;
  recommendations: Array<{ evidenceId: string; advice: string }>;
};

function letterCounts(value: string) {
  return {
    arabic: value.match(/\p{Script=Arabic}/gu)?.length ?? 0,
    latin: value.match(/\p{Script=Latin}/gu)?.length ?? 0,
  };
}

export function matchesNarrativeLanguage(value: string, language: AiLanguage) {
  const { arabic, latin } = letterCounts(value);
  if (language === "ar") return arabic > 0 && arabic >= latin;
  return latin > 0 && latin >= arabic;
}

function localeFor(language: AiLanguage) {
  return language === "ar" ? "ar-KW" : "en-KW";
}

function formattedAmount(value: string, currencyCode: string, language: AiLanguage) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return value;
  return new Intl.NumberFormat(localeFor(language), {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(numericValue);
}

function formattedDate(value: string, language: AiLanguage) {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(localeFor(language), {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

function formattedMargin(value: string | null, language: AiLanguage) {
  if (value === null || !Number.isFinite(Number(value))) {
    return language === "ar" ? "غير متاح" : "unavailable";
  }
  const formatted = new Intl.NumberFormat(localeFor(language), {
    maximumFractionDigits: 2,
  }).format(Number(value));
  return `${formatted}${language === "ar" ? "٪" : "%"}`;
}

export function buildLocalizedAnalysisSummary(
  analysis: AnalysisLanguageFacts,
  language: AiLanguage,
) {
  const { monthToDate, previousMonth, currencyCode } = analysis;
  const start = formattedDate(monthToDate.from, language);
  const end = formattedDate(monthToDate.to, language);
  const income = formattedAmount(monthToDate.income, currencyCode, language);
  const expenses = formattedAmount(monthToDate.expenses, currencyCode, language);
  const netProfit = formattedAmount(monthToDate.netProfit, currencyCode, language);
  const margin = formattedMargin(monthToDate.marginPercent, language);
  const previousIncome = Number(previousMonth.income);

  if (language === "ar") {
    const comparison = previousIncome === 0
      ? "ولم يُسجّل دخل في الشهر السابق."
      : `مقارنةً بدخل ${formattedAmount(previousMonth.income, currencyCode, language)} في الشهر السابق.`;
    return `من بداية الشهر (${start}–${end})، بلغ الدخل ${income}، والمصروفات ${expenses}، وصافي الربح ${netProfit} بهامش ${margin}، ${comparison}`;
  }

  const comparison = previousIncome === 0
    ? "There was no income in the previous month."
    : `Previous-month income was ${formattedAmount(previousMonth.income, currencyCode, language)}.`;
  return `Month-to-date (${start}–${end}), income was ${income}, expenses were ${expenses}, and net profit was ${netProfit} at a ${margin} margin. ${comparison}`;
}

export function localizeAnalysisNarrative(
  analysis: AnalysisLanguageFacts,
  narrative: AiNarrative,
  language: AiLanguage,
): AiNarrative {
  return {
    summary: matchesNarrativeLanguage(narrative.summary, language)
      ? narrative.summary
      : buildLocalizedAnalysisSummary(analysis, language),
    recommendations: narrative.recommendations.filter((item) =>
      matchesNarrativeLanguage(item.advice, language),
    ),
  };
}
