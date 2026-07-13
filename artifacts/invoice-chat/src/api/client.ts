// ─── API call logic ─────────────────────────────────────────────────────────
// Everything that talks to the backend lives here. Every request goes through
// the local proxy (PROXY_BASE), which forwards it to whatever API Base URL
// the user configured (sent as the X-Api-Base header).

import { PROXY_BASE, DEFAULT_API_BASE, LS_KEY } from "../lib/constants";
import type { ChatResponse, ChatThread } from "../types";

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

async function parseApiResponse<T>(resp: Response): Promise<ApiResult<T>> {
  const ct = resp.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await resp.json() : { raw_response: await resp.text() };
  return { data: data as T, ok: resp.ok, status: resp.status };
}

export async function apiPost<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  const resp = await fetch(`${PROXY_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Base": getApiBase() },
    body: JSON.stringify(body),
  });
  return parseApiResponse<T>(resp);
}

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  const resp = await fetch(`${PROXY_BASE}${path}`, {
    headers: { "X-Api-Base": getApiBase() },
  });
  return parseApiResponse<T>(resp);
}

export async function apiDelete<T>(path: string): Promise<ApiResult<T>> {
  const resp = await fetch(`${PROXY_BASE}${path}`, {
    method: "DELETE",
    headers: { "X-Api-Base": getApiBase() },
  });
  return parseApiResponse<T>(resp);
}

// The one call this whole app is built around: POST {API_BASE_URL}/ai/chat
// (proxied as POST {PROXY_BASE}/chat -> the real API's /ai/chat route).
export async function sendChatMessage(message: string, chatId?: string, thinkingEnabled = false, temperaturePreset = "medium") {
  const body = chatId
    ? { message, chat_id: chatId, thinking_enabled: thinkingEnabled, temperature_preset: temperaturePreset }
    : { message, thinking_enabled: thinkingEnabled, temperature_preset: temperaturePreset };
  return apiPost<import("../types").ChatResponse>(
    "/chat",
    body,
  );
}

type ChatStreamEvent =
  | { type: "start"; chat_id?: string }
  | { type: "token"; content: string }
  | { type: "final"; data: ChatResponse };

function parseSseEvents(buffer: string): { events: ChatStreamEvent[]; remaining: string } {
  const events: ChatStreamEvent[] = [];
  const parts = buffer.split("\n\n");
  const remaining = parts.pop() ?? "";

  for (const part of parts) {
    const lines = part.split("\n");
    const eventName = lines.find((line) => line.startsWith("event:"))?.replace("event:", "").trim();
    const dataLine = lines.find((line) => line.startsWith("data:"))?.replace("data:", "").trim();
    if (!eventName || !dataLine) continue;
    try {
      const parsed = JSON.parse(dataLine);
      if (eventName === "start") events.push({ type: "start", chat_id: parsed.chat_id });
      if (eventName === "token") events.push({ type: "token", content: String(parsed.content ?? "") });
      if (eventName === "final") events.push({ type: "final", data: parsed as ChatResponse });
    } catch {
      /* ignore malformed stream event */
    }
  }

  return { events, remaining };
}

export async function sendChatMessageStream(
  message: string,
  chatId: string | undefined,
  thinkingEnabled: boolean,
  temperaturePreset: string,
  onEvent: (event: ChatStreamEvent) => void,
) {
  const body = chatId
    ? { message, chat_id: chatId, thinking_enabled: thinkingEnabled, temperature_preset: temperaturePreset }
    : { message, thinking_enabled: thinkingEnabled, temperature_preset: temperaturePreset };
  const resp = await fetch(`${PROXY_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Base": getApiBase() },
    body: JSON.stringify(body),
  });

  if (!resp.ok || !resp.body) {
    return parseApiResponse<ChatResponse>(resp);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalData: ChatResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseEvents(buffer);
    buffer = parsed.remaining;
    for (const event of parsed.events) {
      onEvent(event);
      if (event.type === "final") finalData = event.data;
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseEvents(`${buffer}\n\n`);
    for (const event of parsed.events) {
      onEvent(event);
      if (event.type === "final") finalData = event.data;
    }
  }

  return { data: finalData ?? { status: "llm_unavailable", message: "Stream ended without a final response." }, ok: finalData !== null, status: resp.status };
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
  return apiGet<ChatThread[]>("/chat-threads");
}

export async function persistChatError(chatId: string, message: string, retryable = true) {
  return apiPost<import("../types").StoredChatMessage>(
    `/chat-threads/${encodeURIComponent(chatId)}/errors`,
    { message, retryable },
  );
}

export async function deleteChatThread(chatId: string) {
  return apiDelete<{ status?: string; message?: string }>(`/chat-threads/${encodeURIComponent(chatId)}`);
}
