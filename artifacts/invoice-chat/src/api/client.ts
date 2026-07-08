// ─── API call logic ─────────────────────────────────────────────────────────
// Everything that talks to the backend lives here. Every request goes through
// the local proxy (PROXY_BASE), which forwards it to whatever API Base URL
// the user configured (sent as the X-Api-Base header).

import { PROXY_BASE, DEFAULT_API_BASE, LS_KEY } from "../lib/constants";
import type { AuthResponse, ChatThread, UserProfile } from "../types";

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

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

function authHeaders(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export async function apiPost<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  const resp = await fetch(`${PROXY_BASE}${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Api-Base": getApiBase(), ...authHeaders() },
    body: JSON.stringify(body),
  });
  return parseApiResponse<T>(resp);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  const resp = await fetch(`${PROXY_BASE}${path}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Api-Base": getApiBase(), ...authHeaders() },
    body: JSON.stringify(body),
  });
  return parseApiResponse<T>(resp);
}

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  const resp = await fetch(`${PROXY_BASE}${path}`, {
    credentials: "same-origin",
    headers: { "X-Api-Base": getApiBase(), ...authHeaders() },
  });
  return parseApiResponse<T>(resp);
}

export async function apiDelete<T>(path: string): Promise<ApiResult<T>> {
  const resp = await fetch(`${PROXY_BASE}${path}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "X-Api-Base": getApiBase(), ...authHeaders() },
  });
  return parseApiResponse<T>(resp);
}

export async function registerUser(payload: { email: string; password: string; display_name?: string }) {
  const result = await apiPost<AuthResponse>("/auth/register", payload);
  if (result.ok) setAccessToken(result.data.access_token);
  return result;
}

export async function loginUser(payload: { email: string; password: string }) {
  const result = await apiPost<AuthResponse>("/auth/login", payload);
  if (result.ok) setAccessToken(result.data.access_token);
  return result;
}

export async function refreshSession() {
  const result = await apiPost<AuthResponse>("/auth/refresh", {});
  if (result.ok) setAccessToken(result.data.access_token);
  return result;
}

export async function logoutUser() {
  const result = await apiPost<{ status?: string }>("/auth/logout", {});
  setAccessToken(null);
  return result;
}

export async function getCurrentUser() {
  return apiGet<UserProfile>("/auth/me");
}

export async function updateProfileEmail(payload: { current_password: string; new_email: string }) {
  return apiPatch<UserProfile>("/auth/me/email", payload);
}

export async function changeProfilePassword(payload: { current_password: string; new_password: string }) {
  return apiPatch<{ status?: string }>("/auth/me/password", payload);
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
  return apiGet<ChatThread[]>("/chat-threads");
}

export async function deleteChatThread(chatId: string) {
  return apiDelete<{ status?: string; message?: string }>(`/chat-threads/${encodeURIComponent(chatId)}`);
}
