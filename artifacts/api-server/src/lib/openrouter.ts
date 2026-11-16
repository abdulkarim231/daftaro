type OpenRouterMessage = { role: "system" | "user" | "assistant"; content: string };

const DEFAULT_FREE_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
const VERIFIED_FREE_FALLBACKS = [
  "liquid/lfm-3-1.7b:free",
  "google/gemma-4-31b-it:free",
];
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export async function completeWithOpenRouter(messages: OpenRouterMessage[]) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new OpenRouterError("AI is not configured.", 503);

  const model = process.env.OPENROUTER_MODEL || DEFAULT_FREE_MODEL;
  if (!model.endsWith(":free")) {
    throw new OpenRouterError("Only a free OpenRouter model is allowed.", 503);
  }

  const candidates = [...new Set([model, ...VERIFIED_FREE_FALLBACKS])].slice(0, 3);
  let upstreamRateLimited = false;
  for (const candidate of candidates) {
    let response: Response;
    try {
      response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "Daftaro",
        },
        body: JSON.stringify({
          model: candidate,
          messages,
          max_tokens: 8192,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new OpenRouterError("The AI request timed out. Try again.", 504);
      }
      throw new OpenRouterError("The AI service could not be reached. Try again.", 502);
    }

    if (response.status === 429) {
      upstreamRateLimited = true;
      continue;
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new OpenRouterError("The saved OpenRouter configuration was rejected.", 503);
      }
      throw new OpenRouterError("The AI service could not complete the request.", 502);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    const text = typeof content === "string"
      ? content.trim()
      : Array.isArray(content)
        ? content.map((part) => part.text ?? "").join("").trim()
        : "";
    if (!text) throw new OpenRouterError("The AI returned an empty response.", 502);
    return text;
  }
  if (upstreamRateLimited) {
    throw new OpenRouterError("Free AI providers are busy. Try again shortly.", 429);
  }
  throw new OpenRouterError("A free AI model is not available right now.", 503);
}
