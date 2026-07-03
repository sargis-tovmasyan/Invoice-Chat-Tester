import type { ChatResponse } from "../chat.types";

export const PROXY_BASE = "/api/proxy";

export interface ApiResult<T> {
  data: T;
  ok: boolean;
  status: number;
}

async function parseResponse<T>(response: Response): Promise<ApiResult<T>> {
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : { raw_response: await response.text() };

  return {
    data: data as T,
    ok: response.ok,
    status: response.status,
  };
}

export async function apiPost<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  const response = await fetch(`${PROXY_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return parseResponse<T>(response);
}

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  const response = await fetch(`${PROXY_BASE}${path}`);
  return parseResponse<T>(response);
}

export async function sendChatMessage(message: string): Promise<ApiResult<ChatResponse>> {
  return apiPost<ChatResponse>("/chat", { message });
}

export function pdfProxyUrl(pdfPath: string): string {
  const path = pdfPath.startsWith("http") ? new URL(pdfPath).pathname : pdfPath;
  return `${PROXY_BASE}/pdf?path=${encodeURIComponent(path)}`;
}

export function responseErrorMessage(data: Record<string, unknown>): string {
  const detail = data.detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item !== "object" || item === null) return String(item);
        const record = item as Record<string, unknown>;
        const loc = Array.isArray(record.loc) ? record.loc.slice(2).join(".") : "field";
        return `${loc}: ${String(record.msg ?? "Invalid value")}`;
      })
      .join("; ");
  }

  return String(data.message ?? detail ?? data.error ?? "Unexpected response");
}
