import test from "node:test";
import assert from "node:assert/strict";
import { completeWithOpenRouter, OpenRouterError } from "../src/lib/openrouter.ts";

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test("retries only through verified free models after provider rate limits", async () => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  const previousModel = process.env.OPENROUTER_MODEL;
  const previousFetch = globalThis.fetch;
  const requests = [];
  process.env.OPENROUTER_API_KEY = "test-only-key";
  delete process.env.OPENROUTER_MODEL;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    requests.push({ model: body.model, authorization: init.headers.Authorization });
    if (requests.length < 3) return new Response("", { status: 429 });
    return new Response(JSON.stringify({
      choices: [{ message: { content: "OK" } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const answer = await completeWithOpenRouter([{ role: "user", content: "Reply with OK." }]);
    assert.equal(answer, "OK");
    assert.deepEqual(requests.map((request) => request.model), [
      "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      "liquid/lfm-3-1.7b:free",
      "google/gemma-4-31b-it:free",
    ]);
    assert.ok(requests.every((request) => request.model.endsWith(":free")));
    assert.ok(requests.every((request) => request.authorization === "Bearer test-only-key"));
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv("OPENROUTER_API_KEY", previousKey);
    restoreEnv("OPENROUTER_MODEL", previousModel);
  }
});

test("refuses a configured paid model without making an API request", async () => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  const previousModel = process.env.OPENROUTER_MODEL;
  const previousFetch = globalThis.fetch;
  let called = false;
  process.env.OPENROUTER_API_KEY = "test-only-key";
  process.env.OPENROUTER_MODEL = "provider/paid-model";
  globalThis.fetch = async () => {
    called = true;
    return new Response("", { status: 200 });
  };
  try {
    await assert.rejects(
      completeWithOpenRouter([{ role: "user", content: "Hello." }]),
      (error) => error instanceof OpenRouterError && error.status === 503,
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnv("OPENROUTER_API_KEY", previousKey);
    restoreEnv("OPENROUTER_MODEL", previousModel);
  }
});
