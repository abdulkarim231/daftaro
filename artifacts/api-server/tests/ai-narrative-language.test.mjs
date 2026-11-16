import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLocalizedAnalysisSummary,
  localizeAnalysisNarrative,
  matchesNarrativeLanguage,
} from "../src/lib/ai-narrative-language.ts";

const facts = {
  currencyCode: "KWD",
  monthToDate: {
    from: "2026-11-01",
    to: "2026-11-16",
    income: "62500.000",
    expenses: "15000.000",
    netProfit: "47500.000",
    marginPercent: "76.00",
  },
  previousMonth: { income: "0.000" },
};

test("replaces an English AI summary with a factual Arabic summary when Arabic is selected", () => {
  const result = localizeAnalysisNarrative(facts, {
    summary: "Month-to-date, the business generated 62,500 KWD.",
    recommendations: [{ evidenceId: "stock-1", advice: "Restock the best seller." }],
  }, "ar");

  assert.match(result.summary, /من بداية الشهر/);
  assert.match(result.summary, /الدخل/);
  assert.match(result.summary, /المصروفات/);
  assert.match(result.summary, /صافي الربح/);
  assert.doesNotMatch(result.summary, /Month-to-date|generated|expenses/i);
  assert.match(result.summary, /د\.ك/);
  assert.doesNotMatch(result.summary, /KWD/);
  assert.deepEqual(result.recommendations, []);
});

test("preserves narrative when its language matches the selected language", () => {
  const narrative = {
    summary: "بلغ الدخل ٦٢٬٥٠٠ د.ك خلال الفترة.",
    recommendations: [{ evidenceId: "stock-1", advice: "راجعي كمية المخزون." }],
  };

  assert.deepEqual(localizeAnalysisNarrative(facts, narrative, "ar"), narrative);
  assert.equal(matchesNarrativeLanguage("Revenue increased this month.", "en"), true);
});

test("creates a localized month-to-date comparison in English and Arabic", () => {
  const arabic = buildLocalizedAnalysisSummary(facts, "ar");
  const english = buildLocalizedAnalysisSummary(facts, "en");

  assert.match(arabic, /لم يُسجّل دخل في الشهر السابق/);
  assert.match(english, /There was no income in the previous month/);
  assert.match(english, /76% margin/);
});
