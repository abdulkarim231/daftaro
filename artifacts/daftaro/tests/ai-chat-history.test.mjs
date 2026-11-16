import test from "node:test";
import assert from "node:assert/strict";
import { mergeAiChatHistories, sanitizeAiChatHistory } from "../src/lib/ai-chat-history.ts";

const user = (content) => ({ role: "user", content });
const assistant = (content) => ({ role: "assistant", content });

test("sanitizes local history and caps it at the latest 40 messages", () => {
  const values = [
    { role: "user", content: "hello", token: "never-store" },
    { role: "system", content: "drop this" },
    { role: "assistant", content: "   " },
    { role: "assistant", content: "old answer ".repeat(500) },
    ...Array.from({ length: 42 }, (_, index) => user(`question ${index}`)),
  ];
  const cleaned = sanitizeAiChatHistory(values);
  const bounded = sanitizeAiChatHistory([{ role: "assistant", content: "old answer ".repeat(500) }]);
  assert.ok(bounded[0].content.length <= 4000);
  assert.ok(bounded[0].content.endsWith("…"));
  const history = sanitizeAiChatHistory(values);
  assert.equal(history.length, 40);
  assert.equal(history[0].content, "question 2");
  assert.equal("token" in history.at(-1), false);
});

test("uses server history when it already contains a stale local copy", () => {
  const local = [user("one"), assistant("answer one")];
  const remote = [...local, user("two"), assistant("answer two")];
  assert.deepEqual(mergeAiChatHistories(remote, local), remote);
});

test("merges a local offline tail onto the server conversation", () => {
  const server = [user("one"), assistant("answer one")];
  const local = [user("two"), assistant("answer two")];
  assert.deepEqual(mergeAiChatHistories(server, local), [...server, ...local]);
});

test("merges overlapping copies without duplicating their shared messages", () => {
  const server = [user("one"), assistant("answer one")];
  const local = [assistant("answer one"), user("two")];
  assert.deepEqual(mergeAiChatHistories(server, local), [...server, user("two")]);
});

test("keeps only the newest 40 messages after merging", () => {
  const server = Array.from({ length: 30 }, (_, index) => user(`server ${index}`));
  const local = Array.from({ length: 20 }, (_, index) => user(`local ${index}`));
  const merged = mergeAiChatHistories(server, local);
  assert.equal(merged.length, 40);
  assert.equal(merged[0].content, "server 10");
  assert.equal(merged.at(-1).content, "local 19");
});
