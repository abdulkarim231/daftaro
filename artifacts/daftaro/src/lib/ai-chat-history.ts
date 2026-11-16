import type { AiChatMessage } from "./ai-api";

export const MAX_AI_CHAT_HISTORY_MESSAGES = 40;

function isChatMessage(value: unknown): value is AiChatMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as { role?: unknown; content?: unknown };
  return (item.role === "user" || item.role === "assistant")
    && typeof item.content === "string"
    && item.content.trim().length > 0;
}

function boundContent(content: string) {
  if (content.length <= 4000) return content;
  let bounded = content.slice(0, 4000);
  const lastUnit = bounded.charCodeAt(bounded.length - 1);
  if (lastUnit >= 0xd800 && lastUnit <= 0xdbff) bounded = bounded.slice(0, -1);
  const lastSpace = bounded.lastIndexOf(" ");
  if (lastSpace > bounded.length - 1500) bounded = bounded.slice(0, lastSpace);
  return `${bounded.trimEnd()}…`;
}

export function sanitizeAiChatHistory(value: unknown): AiChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isChatMessage)
    .map(({ role, content }) => ({ role, content: boundContent(content) }))
    .slice(-MAX_AI_CHAT_HISTORY_MESSAGES);
}

function sameMessage(left: AiChatMessage, right: AiChatMessage) {
  return left.role === right.role && left.content === right.content;
}

function sameHistory(left: AiChatMessage[], right: AiChatMessage[]) {
  return left.length === right.length && left.every((message, index) => sameMessage(message, right[index]));
}

function isPrefix(shorter: AiChatMessage[], longer: AiChatMessage[]) {
  return shorter.length <= longer.length && shorter.every((message, index) => sameMessage(message, longer[index]));
}

function isSuffix(shorter: AiChatMessage[], longer: AiChatMessage[]) {
  const offset = longer.length - shorter.length;
  return offset >= 0 && shorter.every((message, index) => sameMessage(message, longer[offset + index]));
}

export function mergeAiChatHistories(
  serverMessages: AiChatMessage[],
  localMessages: AiChatMessage[],
): AiChatMessage[] {
  const remote = sanitizeAiChatHistory(serverMessages);
  const local = sanitizeAiChatHistory(localMessages);
  if (remote.length === 0) return local;
  if (local.length === 0 || sameHistory(remote, local)) return remote;
  if (isPrefix(local, remote) || isSuffix(local, remote)) return remote;
  if (isPrefix(remote, local) || isSuffix(remote, local)) return local;

  for (let overlap = Math.min(remote.length, local.length); overlap > 0; overlap -= 1) {
    const remoteTail = remote.slice(-overlap);
    const localHead = local.slice(0, overlap);
    if (sameHistory(remoteTail, localHead)) {
      return [...remote, ...local.slice(overlap)].slice(-MAX_AI_CHAT_HISTORY_MESSAGES);
    }
  }
  return [...remote, ...local].slice(-MAX_AI_CHAT_HISTORY_MESSAGES);
}
