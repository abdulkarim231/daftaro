import test from "node:test";
import assert from "node:assert/strict";
import { boundAiChatAnswer, normalizeAiChatHistoryMessages } from "../src/lib/ai-chat-history.ts";

test("normalizes only message roles and text while dropping extra fields", () => {
  const messages = normalizeAiChatHistoryMessages([
    { role: "user", content: "How were sales?", apiKey: "never-store", userId: "other-user" },
    { role: "assistant", content: "Sales were steady.", metadata: { customerEmail: "customer@example.com" } },
  ]);
  assert.deepEqual(messages, [
    { role: "user", content: "How were sales?" },
    { role: "assistant", content: "Sales were steady." },
  ]);
});

test("accepts an empty stored history but not an empty save", () => {
  assert.deepEqual(normalizeAiChatHistoryMessages([], true), []);
  assert.equal(normalizeAiChatHistoryMessages([]), null);
});

test("rejects invalid, empty, oversized, and overlong chat histories", () => {
  assert.equal(normalizeAiChatHistoryMessages([{ role: "system", content: "no" }]), null);
  assert.equal(normalizeAiChatHistoryMessages([{ role: "user", content: "" }]), null);
  assert.equal(normalizeAiChatHistoryMessages([{ role: "user", content: "x".repeat(4001) }]), null);
  assert.equal(normalizeAiChatHistoryMessages(Array.from({ length: 41 }, () => ({ role: "user", content: "x" }))), null);
  assert.equal(normalizeAiChatHistoryMessages([{ role: "user", content: "x".repeat(4001) }], true), null);
});

test("bounds long AI responses so saved messages stay within storage limits", () => {
  const answer = boundAiChatAnswer(`${"word ".repeat(900)}😀`);
  assert.ok(answer.length <= 4000);
  assert.ok(answer.endsWith("…"));
  assert.doesNotMatch(answer, /[\uD800-\uDBFF]$/);
});
