// ─── API call logic ─────────────────────────────────────────────────────────
// Everything that talks to the backend lives here. Every request goes through
// the local proxy (PROXY_BASE), which forwards it to whatever API Base URL
// the user configured (sent as the X-Api-Base header).

import { PROXY_BASE, DEFAULT_API_BASE, LS_KEY } from "../lib/constants";
import type { ChatThread } from "../types";

export function getApiBase(): string {
  try {
    return localStorage.getItem(LS_KEY) ?? DEFAULT_API_BASE;
  } catch {
    return DEFAULT_API_BASE;
  }
}

export function isApiBaseConfigured(): boolean {
  try {
    return localStorage.getItem(LS_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveApiBase(base: string) {
  try {
    localStorage.setItem(LS_KEY, base);
  } catch {
    /* ignore */
  }
}

export function resetApiBase() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

interface ApiResult<T> {
  data: T;
  ok: boolean;
  status: number;
}

export async function apiPost<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  const resp = await fetch(`${PROXY_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Base": getApiBase() },
    body: JSON.stringify(body),
  });
  const ct = resp.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await resp.json() : { raw_response: await resp.text() };
  return { data: data as T, ok: resp.ok, status: resp.status };
}

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  const resp = await fetch(`${PROXY_BASE}${path}`, {
    headers: { "X-Api-Base": getApiBase() },
  });
  const ct = resp.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await resp.json() : { raw_response: await resp.text() };
  return { data: data as T, ok: resp.ok, status: resp.status };
}

// The one call this whole app is built around: POST {API_BASE_URL}/ai/chat
// (proxied as POST {PROXY_BASE}/chat -> the real API's /ai/chat route).
export async function sendChatMessage(message: string, chatId?: string) {
  return apiPost<import("../types").ChatResponse>(
    "/chat",
    chatId ? { message, chat_id: chatId } : { message },
  );
}

// Used after a "missing_fields" response once the user fills in the form.
export async function completeInvoiceDraft(draft: unknown, chatId?: string) {
  return apiPost<import("../types").CompleteResponse>(
    "/complete",
    chatId ? { draft, chat_id: chatId } : { draft },
  );
}

export async function getChatThread(chatId: string) {
  return apiGet<ChatThread>(`/chat-threads/${encodeURIComponent(chatId)}`);
}

export async function getChatThreads() {
  const result = await apiGet<ChatThread[]>("/chat-threads");
  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return result;

  const hydratedThreads = await Promise.all(
    result.data.map(async (thread) => {
      const detail = await getChatThread(thread.id);
      return detail.ok ? detail.data : thread;
    }),
  );

  return { ...result, data: hydratedThreads };
}
