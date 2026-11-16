export type AiChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export function boundAiChatAnswer(answer: string) {
  if (answer.length <= 4000) return answer;
  let bounded = answer.slice(0, 4000);
  const lastUnit = bounded.charCodeAt(bounded.length - 1);
  if (lastUnit >= 0xd800 && lastUnit <= 0xdbff) bounded = bounded.slice(0, -1);
  const lastSpace = bounded.lastIndexOf(" ");
  if (lastSpace > bounded.length - 1500) bounded = bounded.slice(0, lastSpace);
  return `${bounded.trimEnd()}…`;
}

export function normalizeAiChatHistoryMessages(
  value: unknown,
  allowEmpty = false,
): AiChatHistoryMessage[] | null {
  if (!Array.isArray(value) || value.length > 40 || (!allowEmpty && value.length === 0)) return null;
  const messages: AiChatHistoryMessage[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const item = candidate as { role?: unknown; content?: unknown };
    if (
      (item.role !== "user" && item.role !== "assistant")
      || typeof item.content !== "string"
      || item.content.trim().length === 0
      || item.content.length > 4000
    ) return null;
    messages.push({ role: item.role, content: item.content });
  }
  return messages;
}
