import { setBaseUrl } from "@workspace/api-client-react";

const configuredApiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

setBaseUrl(configuredApiBaseUrl || null);

export function apiUrl(path: string): string {
  return `${configuredApiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
