import type { AiAnalysis, AiLanguage } from "./ai-api";

function matchesLanguage(value: string, language: AiLanguage) {
  const arabic = value.match(/\p{Script=Arabic}/gu)?.length ?? 0;
  const latin = value.match(/\p{Script=Latin}/gu)?.length ?? 0;
  if (language === "ar") return arabic > 0 && arabic >= latin;
  return latin > 0 && latin >= arabic;
}

function formatAmount(value: string, currency: string, language: AiLanguage) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return new Intl.NumberFormat(language === "ar" ? "ar-KW" : "en-KW", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(number);
}

function formatDate(value: string, language: AiLanguage) {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "ar" ? "ar-KW" : "en-KW", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

function formatMargin(value: string | null, language: AiLanguage) {
  if (value === null || !Number.isFinite(Number(value))) {
    return language === "ar" ? "غير متاح" : "unavailable";
  }
  const formatted = new Intl.NumberFormat(language === "ar" ? "ar-KW" : "en-KW", {
    maximumFractionDigits: 2,
  }).format(Number(value));
  return `${formatted}${language === "ar" ? "٪" : "%"}`;
}

function factBasedSummary(analysis: AiAnalysis, language: AiLanguage) {
  const { monthToDate, previousMonth } = analysis;
  const start = formatDate(monthToDate.from, language);
  const end = formatDate(monthToDate.to, language);
  const income = formatAmount(monthToDate.income, analysis.currencyCode, language);
  const expenses = formatAmount(monthToDate.expenses, analysis.currencyCode, language);
  const netProfit = formatAmount(monthToDate.netProfit, analysis.currencyCode, language);
  const margin = formatMargin(monthToDate.marginPercent, language);
  const priorIncome = Number(previousMonth.income);

  if (language === "ar") {
    const comparison = priorIncome === 0
      ? "ولم يُسجّل دخل في الشهر السابق."
      : `مقارنةً بدخل ${formatAmount(previousMonth.income, analysis.currencyCode, language)} في الشهر السابق.`;
    return `من بداية الشهر (${start}–${end})، بلغ الدخل ${income}، والمصروفات ${expenses}، وصافي الربح ${netProfit} بهامش ${margin}، ${comparison}`;
  }

  const comparison = priorIncome === 0
    ? "There was no income in the previous month."
    : `Previous-month income was ${formatAmount(previousMonth.income, analysis.currencyCode, language)}.`;
  return `Month-to-date (${start}–${end}), income was ${income}, expenses were ${expenses}, and net profit was ${netProfit} at a ${margin} margin. ${comparison}`;
}

export function getDisplayedAiNarrative(analysis: AiAnalysis, language: AiLanguage) {
  return {
    summary: matchesLanguage(analysis.ai.summary, language)
      ? analysis.ai.summary
      : factBasedSummary(analysis, language),
    recommendations: analysis.ai.recommendations.filter((item) =>
      matchesLanguage(item.advice, language),
    ),
  };
}

export function getLocalizedAiAnalysis(analysis: AiAnalysis, language: AiLanguage): AiAnalysis {
  return {
    ...analysis,
    ai: getDisplayedAiNarrative(analysis, language),
  };
}
