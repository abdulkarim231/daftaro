import assert from "node:assert/strict";
import test from "node:test";
import {
  getDisplayedAiNarrative,
  getLocalizedAiAnalysis,
} from "../src/lib/ai-narrative-display.ts";

const analysis = {
  period: "30d",
  currencyCode: "KWD",
  from: "2026-10-18",
  to: "2026-11-16",
  previousFrom: "2026-09-18",
  previousTo: "2026-10-17",
  monthToDate: {
    from: "2026-11-01",
    to: "2026-11-16",
    income: "62500.000",
    expenses: "15000.000",
    netProfit: "47500.000",
    marginPercent: "76.00",
  },
  previousMonth: {
    from: "2026-10-01",
    to: "2026-10-31",
    income: "0.000",
    expenses: "0.000",
    netProfit: "0.000",
    marginPercent: null,
  },
  ai: {
    summary: "Month-to-date, the business generated 62,500 KWD income.",
    recommendations: [
      { evidenceId: "stock-1", advice: "Restock the best seller." },
      { evidenceId: "stock-2", advice: "راجعي كمية المخزون." },
    ],
  },
};

test("shows a fact-based Arabic explanation instead of stale English output", () => {
  const result = getDisplayedAiNarrative(analysis, "ar");

  assert.match(result.summary, /من بداية الشهر/);
  assert.match(result.summary, /د\.ك/);
  assert.match(result.summary, /لم يُسجّل دخل في الشهر السابق/);
  assert.doesNotMatch(result.summary, /Month-to-date|generated|income/i);
  assert.deepEqual(result.recommendations, [
    { evidenceId: "stock-2", advice: "راجعي كمية المخزون." },
  ]);
});

test("preserves an AI explanation already written in the selected language", () => {
  const english = {
    ...analysis,
    ai: {
      summary: "Revenue and expenses were reviewed for this month.",
      recommendations: [{ evidenceId: "finance-1", advice: "Keep monitoring expenses." }],
    },
  };

  assert.deepEqual(getDisplayedAiNarrative(english, "en"), english.ai);
  assert.equal(getLocalizedAiAnalysis(english, "en").ai.summary, english.ai.summary);
});
