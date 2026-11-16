import test from "node:test";
import assert from "node:assert/strict";
import { buildAiAnalysis } from "../src/lib/ai-analysis.ts";
import { buildPrintableAiReport } from "../../daftaro/src/lib/printable-ai-report.ts";
import {
  buildShareableAiReport,
  createReportShareToken,
  hashReportShareToken,
  isReportShareExpiryDays,
  isReportShareToken,
  sanitizeShareNarrative,
} from "../src/lib/ai-report-share.ts";

function emptyAnalysis() {
  return buildAiAnalysis({
    transactions: [],
    orders: [],
    items: [],
    products: [],
    currencyCode: "KWD",
    period: "30d",
    today: "2026-11-16",
  });
}

test("report share tokens use unguessable URL-fragment-safe values and hashed storage", () => {
  const token = createReportShareToken();
  assert.equal(isReportShareToken(token), true);
  assert.equal(token.length, 43);
  assert.match(hashReportShareToken(token), /^[0-9a-f]{64}$/);
  assert.notEqual(hashReportShareToken(token), token);
  assert.equal(hashReportShareToken(token), hashReportShareToken(token));
  assert.equal(isReportShareToken(`${token}a`), false);
  assert.equal(isReportShareToken(""), false);
});

test("link expiration accepts only the supported day choices", () => {
  assert.equal(isReportShareExpiryDays(1), true);
  assert.equal(isReportShareExpiryDays(7), true);
  assert.equal(isReportShareExpiryDays(30), true);
  assert.equal(isReportShareExpiryDays(0), false);
  assert.equal(isReportShareExpiryDays(31), false);
  assert.equal(isReportShareExpiryDays("7"), false);
});

test("shared snapshots whitelist report fields and drop internal and customer details", () => {
  const analysis = emptyAnalysis();
  analysis.evidence = [{
    id: "stock-private-product-uuid",
    label: "restock signal",
    details: {
      product: "Coffee sampler",
      availableQuantity: 2,
      customerEmail: "customer@example.com",
      privateRecordId: "internal-uuid",
    },
  }];
  analysis.customerEmail = "owner@example.com";
  const narrative = sanitizeShareNarrative({
    summary: "  Stock is low.  ",
    recommendations: [
      { evidenceId: "stock-private-product-uuid", advice: "Review replenishment." },
      { evidenceId: "unknown-internal-id", advice: "This unsupported recommendation is dropped." },
    ],
  }, analysis.evidence);
  const snapshot = buildShareableAiReport(analysis, narrative);
  const serialized = JSON.stringify(snapshot);

  assert.equal(snapshot.ai.summary, "Stock is low.");
  assert.equal(snapshot.ai.recommendations.length, 1);
  assert.equal(snapshot.evidence[0].details.product, "Coffee sampler");
  assert.equal("customerEmail" in snapshot.evidence[0].details, false);
  assert.equal("privateRecordId" in snapshot.evidence[0].details, false);
  assert.equal("customerEmail" in snapshot, false);
  assert.equal(serialized.includes("owner@example.com"), false);
  assert.equal(serialized.includes("customer@example.com"), false);
  assert.equal(serialized.includes("stock-private-product-uuid"), false);
  assert.equal(serialized.includes("internal-uuid"), false);
  assert.equal(serialized.includes("unknown-internal-id"), false);
});

test("server-created snapshots match the report that owners preview and print", () => {
  const analysis = emptyAnalysis();
  const narrative = { summary: "Stable figures.", recommendations: [] };
  const serverReport = buildShareableAiReport(analysis, narrative);
  const printableReport = buildPrintableAiReport({ ...analysis, ai: narrative });
  assert.deepEqual(serverReport, printableReport);
});

test("share narrative limits text and only retains recommendations tied to evidence", () => {
  const evidence = [{ id: "financial-profit", label: "ledger net profit", details: {} }];
  const narrative = sanitizeShareNarrative({
    summary: "x".repeat(2_000),
    recommendations: Array.from({ length: 8 }, (_, index) => ({
      evidenceId: "financial-profit",
      advice: `advice ${index} ${"y".repeat(600)}`,
    })),
  }, evidence);
  assert.equal(narrative.summary.length, 1_500);
  assert.equal(narrative.recommendations.length, 5);
  assert.equal(narrative.recommendations[0].advice.length, 500);
});
