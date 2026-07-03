import { useCallback, useState } from "react";
import { apiGet, responseErrorMessage, sendChatMessage } from "./api/chatApi";
import type { ChatResponse, InvoiceListItem } from "./chat.types";
import type { useChatSessions } from "./useChatSessions";

type SessionApi = ReturnType<typeof useChatSessions>;

const FALLBACK_FIELDS = ["invoice_number", "issue_date", "due_date", "currency", "business.name", "client.name", "items"];

export function useChatActions(sessions: SessionApi, input: string, setInput: (value: string) => void) {
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Thinking...");

  const addError = useCallback((text: string, raw?: unknown) => {
    sessions.addMessage({ role: "error", text, payload: raw ? { kind: "generic", raw } : undefined });
  }, [sessions]);

  const handleChatResponse = useCallback((data: ChatResponse) => {
    if (data.status === "answer") {
      sessions.addMessage({ role: "assistant", text: data.message ?? "How can I help?" });
      return;
    }
    if (data.status === "invoice_list") {
      sessions.addMessage({ role: "assistant", text: data.message ?? "Here are your invoices.", payload: { kind: "invoice_list", invoices: data.invoices ?? [], raw: data } });
      return;
    }
    if (data.status === "created" || data.invoice_id) {
      sessions.addMessage({ role: "assistant", text: `Invoice created — ${data.invoice_number ?? `#${data.invoice_id}`}`, payload: { kind: "invoice", data, raw: data } });
      return;
    }
    if (data.status === "missing_fields") {
      sessions.addMessage({ role: "assistant", text: "I need a few more details before I can create the invoice.", payload: { kind: "missing_fields", fields: data.missing_fields?.length ? data.missing_fields : FALLBACK_FIELDS, draft: data.draft ?? {}, raw: data } });
      return;
    }
    if (data.status === "ai_parse_error" || data.status === "llm_unavailable") {
      addError(data.message ?? "The AI service returned an error.", data);
      return;
    }
    sessions.addMessage({ role: "assistant", text: `Received status "${data.status ?? "unknown"}" from the API.`, payload: { kind: "generic", raw: data } });
  }, [addError, sessions]);

  const sendMessage = useCallback(async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || loading) return;
    if (!preset) setInput("");
    sessions.addMessage({ role: "user", text, requestInfo: { method: "POST", endpoint: "/api/proxy/chat", body: { message: text } } });
    setLoading(true);
    setLoadingLabel("Thinking...");
    try {
      const { data, ok } = await sendChatMessage(text);
      if (!ok) {
        addError(`Chat request failed: ${responseErrorMessage(data as Record<string, unknown>)}`, data);
        return;
      }
      handleChatResponse(data);
    } catch (error) {
      addError(`Network error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [addError, handleChatResponse, input, loading, sessions, setInput]);

  const runHealthCheck = useCallback(async () => {
    if (loading) return;
    sessions.addMessage({ role: "system", text: "Checking backend health..." });
    setLoading(true);
    setLoadingLabel("Checking health...");
    try {
      const { data } = await apiGet<Record<string, unknown>>("/health");
      sessions.addMessage({ role: "assistant", text: "Backend health check completed.", payload: { kind: "generic", raw: data } });
    } catch (error) {
      addError(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [addError, loading, sessions]);

  const listInvoices = useCallback(async () => {
    if (loading) return;
    sessions.addMessage({ role: "system", text: "Loading invoices..." });
    setLoading(true);
    setLoadingLabel("Loading invoices...");
    try {
      const { data } = await apiGet<InvoiceListItem[]>("/invoices");
      sessions.addMessage({ role: "assistant", text: `Found ${Array.isArray(data) ? data.length : 0} invoices.`, payload: { kind: "invoice_list", invoices: Array.isArray(data) ? data : [], raw: data } });
    } catch (error) {
      addError(`Invoice list failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [addError, loading, sessions]);

  return { loading, loadingLabel, sendMessage, runHealthCheck, listInvoices };
}
