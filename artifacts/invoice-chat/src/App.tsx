// ─── App page ───────────────────────────────────────────────────────────────
// Top-level layout: Sidebar (chat sessions) + Header + ConversationArea +
// Composer. Owns the session list and all the chat/network logic; every
// visible area is its own component under src/components/.
//
// Sessions are loaded from backend chat threads when available.
// API calls live in src/api/client.ts. Everything else (types, constants,
// helpers) is split out so each concern has one obvious home.

import { useState, useRef, useEffect, useCallback } from "react";
import { unlockAudio, playSend, playReceive, playSuccess, playError, playMissingFields, playConfirm, playPing } from "./lib/sounds";
import { PROXY_BASE, INVOICE_FORM_FIELDS } from "./lib/constants";
import { uid, deepClone, setNestedValue, normalizeFormValue, validateFormValues, buildInitialFormValues, responseErrorMessage, deriveSessionTitle } from "./lib/helpers";
import { apiGet, sendChatMessage, completeInvoiceDraft, getApiBase, isApiBaseConfigured, getChatThreads, getChatThread } from "./api/client";
import { createEmptySession } from "./session/sessionHelpers";

import { Sidebar } from "./components/Sidebar/Sidebar";
import { Header } from "./components/Header/Header";
import { ConversationArea } from "./components/Conversation/ConversationArea";
import { Composer } from "./components/Composer/Composer";
import { SettingsPanel } from "./components/Settings/SettingsPanel";
import { SetupScreen } from "./components/Settings/SetupScreen";

import type { ChatSession, Message, PendingForm, DraftObject, CompleteResponse, ChatResponse, InvoiceListItem, ParsedPayload, StoredChatMessage, ChatThread } from "./types";

function parseStoredPayload(raw: unknown): ParsedPayload | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const record = raw as ChatResponse;
  if (record.status === "invoice_list") {
    return { kind: "invoice_list", invoices: record.invoices ?? [], raw };
  }
  if (record.status === "missing_fields") {
    return { kind: "missing_fields", fields: INVOICE_FORM_FIELDS, draft: record.draft ?? {}, raw };
  }
  if (record.status === "created" || record.invoice_id) {
    return { kind: "invoice", data: record, raw };
  }
  if (record.status === "ai_parse_error" || record.status === "llm_unavailable") {
    return { kind: "error_status", message: record.message ?? "", status: record.status, raw };
  }
  return undefined;
}

function storedMessageToUi(message: StoredChatMessage): Message {
  const timestamp = message.created_at ? new Date(message.created_at).getTime() : Date.now();
  return {
    id: message.id,
    role: message.role === "user" || message.role === "assistant" || message.role === "system" ? message.role : "system",
    text: message.content,
    timestamp: Number.isNaN(timestamp) ? Date.now() : timestamp,
    payload: parseStoredPayload(message.metadata ?? {}),
    showRaw: false,
  };
}

function sessionFromThread(thread: ChatThread): ChatSession {
  const messages = (thread.messages ?? []).map(storedMessageToUi);
  const session: ChatSession = {
    id: thread.id,
    backendChatId: thread.id,
    title: thread.title || "New chat",
    messages,
    pendingForm: null,
    createdAt: thread.created_at ? new Date(thread.created_at).getTime() : Date.now(),
  };

  const draft = thread.session_memory?.draft;
  const missingFields = thread.session_memory?.missing_fields ?? [];
  const lastMissingMessage = [...messages].reverse().find((message) => message.payload?.kind === "missing_fields");
  if (draft && missingFields.length > 0 && lastMissingMessage) {
    session.pendingForm = {
      messageId: lastMissingMessage.id,
      chatId: thread.id,
      draft,
      fields: INVOICE_FORM_FIELDS,
      missingFields,
      values: buildInitialFormValues(draft, INVOICE_FORM_FIELDS),
      submitted: false,
    };
  }

  return session;
}

export default function App() {
  // ── Sessions (sidebar) ────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<ChatSession[]>(() => [createEmptySession()]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0].id);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];
  const messages = activeSession.messages;
  const pendingForm = activeSession.pendingForm;

  // ── Composer / request state (shared across the active session) ──────────
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Thinking…");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiBase, setApiBase] = useState(() => getApiBase());
  const [configured, setConfigured] = useState(() => isApiBaseConfigured());

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Unlock AudioContext on first interaction (browser requirement)
  useEffect(() => {
    const unlock = () => { unlockAudio(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // ── Session helpers ────────────────────────────────────────────────────────

  const updateSession = useCallback((id: string, updater: (s: ChatSession) => ChatSession) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
  }, []);

  const addMsg = useCallback((sessionId: string, m: Omit<Message, "id" | "timestamp"> & { id?: string }) => {
    const full: Message = { id: m.id ?? uid(), timestamp: Date.now(), showRaw: false, ...m };
    updateSession(sessionId, (s) => {
      const isFirstUserMsg = s.messages.length === 0 && m.role === "user";
      return {
        ...s,
        messages: [...s.messages, full],
        title: isFirstUserMsg ? deriveSessionTitle(m.text) : s.title,
      };
    });
    return full.id;
  }, [updateSession]);

  const toggleRaw = useCallback((id: string) => {
    updateSession(activeSessionId, (s) => ({
      ...s,
      messages: s.messages.map((m) => (m.id === id ? { ...m, showRaw: !m.showRaw } : m)),
    }));
  }, [updateSession, activeSessionId]);

  const setPendingFormForActive = useCallback(
    (updater: PendingForm | null | ((f: PendingForm | null) => PendingForm | null)) => {
      updateSession(activeSessionId, (s) => ({
        ...s,
        pendingForm: typeof updater === "function" ? updater(s.pendingForm) : updater,
      }));
    },
    [updateSession, activeSessionId]
  );

  const refreshThreads = useCallback(async () => {
    const { data, ok } = await getChatThreads();
    if (!ok || !Array.isArray(data)) return;
    const loadedSessions = data.map(sessionFromThread);

    setSessions((current) => {
      const localSessions = current.filter(
        (session) => !session.backendChatId && (session.messages.length > 0 || session.id === activeSessionId),
      );
      const localIds = new Set(localSessions.map((session) => session.id));
      const loadedWithoutLocalDuplicates = loadedSessions.filter((session) => !localIds.has(session.id));

      return [...localSessions, ...loadedWithoutLocalDuplicates];
    });
  }, [activeSessionId]);

  useEffect(() => {
    void refreshThreads();
  }, [refreshThreads]);

  const handleNewChat = () => {
    const session = createEmptySession();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setInput("");
  };

  const handleSelectSession = async (id: string) => {
    setActiveSessionId(id);
    setInput("");
    const session = sessions.find((item) => item.id === id);
    if (!session?.backendChatId) return;
    const { data, ok } = await getChatThread(session.backendChatId);
    if (ok) {
      const loadedSession = sessionFromThread(data);
      setSessions((current) => current.map((item) => (item.id === id ? loadedSession : item)));
    }
  };

  // ── Call /invoices/draft/complete ─────────────────────────────────────────

  const callComplete = useCallback(async (sessionId: string, draft: DraftObject) => {
    setLoadingLabel("Creating invoice…");
    const session = sessions.find((item) => item.id === sessionId);
    const { data, ok } = await completeInvoiceDraft(draft, session?.backendChatId) as { data: CompleteResponse & { chat_id?: string }; ok: boolean };

    if (!ok || (data.status && data.status !== "created" && !data.invoice_id)) {
      playError();
      addMsg(sessionId, {
        role: "error",
        text: `Draft complete failed: ${responseErrorMessage(data as Record<string, unknown>)}`,
        payload: { kind: "generic", raw: data },
      });
      return;
    }

    if (data.chat_id) {
      updateSession(sessionId, (current) => ({
        ...current,
        backendChatId: data.chat_id,
      }));
    }

    playSuccess();
    addMsg(sessionId, {
      role: "assistant",
      text: `Invoice created — ${data.invoice_number ?? `#${data.invoice_id}`}`,
      payload: { kind: "invoice", data, raw: data },
    });
  }, [addMsg, sessions, updateSession]);

  // ── Handle missing fields form submit ─────────────────────────────────────

  const handleFormSubmit = async () => {
    if (!pendingForm || formSubmitting) return;
    const sessionId = activeSessionId;
    const validationError = validateFormValues(pendingForm.values, pendingForm.missingFields);
    if (validationError) {
      playError();
      addMsg(sessionId, { role: "error", text: validationError });
      return;
    }
    playConfirm();
    setFormSubmitting(true);

    const merged = deepClone(pendingForm.draft);
    for (const [path, value] of Object.entries(pendingForm.values)) {
      if (path === "items") {
        setNestedValue(merged, "raw_items", value);
      } else {
        setNestedValue(merged, path, normalizeFormValue(path, value));
      }
    }

    setPendingFormForActive((f) => (f ? { ...f, submitted: true } : null));
    setLoading(true);
    setLoadingLabel("Creating your invoice…");

    try {
      await callComplete(sessionId, merged);
    } catch (err) {
      addMsg(sessionId, { role: "error", text: `Network error: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setFormSubmitting(false);
      setLoading(false);
      setLoadingLabel("Thinking…");
      setPendingFormForActive(null);
    }
  };

  const handleFormChange = (field: string, value: string) => {
    setPendingFormForActive((f) => (f ? { ...f, values: { ...f.values, [field]: value } } : null));
  };

  // ── Send chat message ─────────────────────────────────────────────────────

  const sendMessage = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || loading || pendingForm !== null) return;
    const sessionId = activeSessionId;
    const session = sessions.find((item) => item.id === sessionId);
    const requestBody = session?.backendChatId ? { message: text, chat_id: session.backendChatId } : { message: text };
    if (!preset) setInput("");

    playSend();
    addMsg(sessionId, { role: "user", text, requestInfo: { method: "POST", endpoint: `${PROXY_BASE}/chat`, body: requestBody } });
    setLoading(true);
    setLoadingLabel("Thinking…");

    try {
      const { data: chatData, ok } = await sendChatMessage(text, session?.backendChatId) as { data: ChatResponse; ok: boolean };

      if (!ok) {
        playError();
        addMsg(sessionId, {
          role: "error",
          text: `Chat request failed: ${String(chatData.message ?? (chatData as Record<string, unknown>).detail ?? "Server error")}`,
          payload: { kind: "generic", raw: chatData },
        });
        return;
      }

      const status = chatData.status;
      if (chatData.chat_id) {
        updateSession(sessionId, (current) => ({
          ...current,
          backendChatId: chatData.chat_id,
        }));
      }

      if (status === "answer") {
        playReceive();
        addMsg(sessionId, { role: "assistant", text: chatData.message ?? "How can I help?" });
        return;
      }

      if (status === "invoice_list") {
        playPing();
        addMsg(sessionId, {
          role: "assistant",
          text: chatData.message ?? "Here are your invoices.",
          payload: { kind: "invoice_list", invoices: chatData.invoices ?? [], raw: chatData },
        });
        return;
      }

      if (status === "ai_parse_error") {
        playError();
        addMsg(sessionId, {
          role: "error",
          text: chatData.message ?? "Could not parse your request. Please try rephrasing.",
          payload: { kind: "error_status", message: chatData.message ?? "", status, raw: chatData },
        });
        return;
      }

      if (status === "llm_unavailable") {
        playError();
        addMsg(sessionId, {
          role: "error",
          text: chatData.message ?? "AI assistant is temporarily unavailable. Please try again later.",
          payload: { kind: "error_status", message: chatData.message ?? "", status, raw: chatData },
        });
        return;
      }

      if (status === "created" || chatData.invoice_id) {
        playSuccess();
        addMsg(sessionId, {
          role: "assistant",
          text: `Invoice created — ${chatData.invoice_number ?? `#${chatData.invoice_id}`}`,
          payload: { kind: "invoice", data: chatData, raw: chatData },
        });
        return;
      }

      if (status === "missing_fields") {
        const draft = chatData.draft ?? {};
        const missingFields = chatData.missing_fields ?? [];
        const fields = INVOICE_FORM_FIELDS;
        const formMsgId = uid();

        playMissingFields();
        addMsg(sessionId, {
          id: formMsgId,
          role: "assistant",
          text: "I need a few more details to complete your invoice:",
          payload: { kind: "missing_fields", fields, draft, raw: chatData },
        });

        updateSession(sessionId, (s) => ({
          ...s,
          pendingForm: {
            messageId: formMsgId,
            chatId: chatData.chat_id ?? session?.backendChatId,
            draft,
            fields,
            missingFields,
            values: buildInitialFormValues(draft, fields),
            submitted: false,
          },
        }));
        return;
      }

      // unknown status fallback
      playReceive();
      addMsg(sessionId, {
        role: "assistant",
        text: `Received status "${status ?? "unknown"}" from the API.`,
        payload: { kind: "generic", raw: chatData },
      });
    } catch (err) {
      playError();
      addMsg(sessionId, { role: "error", text: `Network error: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setLoading(false);
      setLoadingLabel("Thinking…");
    }
  };

  // ── Quick actions (Health / Invoices buttons) ─────────────────────────────

  const runAction = async (label: string, fn: () => Promise<{ data: unknown }>) => {
    if (loading || pendingForm !== null) return;
    const sessionId = activeSessionId;
    addMsg(sessionId, { role: "system", text: `▶ ${label}` });
    setLoading(true);
    setLoadingLabel(`${label}…`);
    try {
      const { data } = await fn();
      playPing();

      const isInvoiceList =
        Array.isArray(data) &&
        (data.length === 0 || (typeof data[0] === "object" && data[0] !== null && ("invoice_number" in data[0] || "id" in data[0])));

      if (isInvoiceList) {
        addMsg(sessionId, {
          role: "assistant",
          text: `Found ${(data as unknown[]).length} invoice${(data as unknown[]).length !== 1 ? "s" : ""}`,
          payload: { kind: "invoice_list", invoices: data as InvoiceListItem[], raw: data },
          showRaw: false,
        });
      } else {
        addMsg(sessionId, { role: "assistant", text: `Response — ${label}`, payload: { kind: "generic", raw: data }, showRaw: true });
      }
    } catch (err) {
      playError();
      addMsg(sessionId, { role: "error", text: `${label} failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setLoading(false);
      setLoadingLabel("Thinking…");
    }
  };

  const clearChat = () => {
    updateSession(activeSessionId, (s) => ({ ...s, messages: [], pendingForm: null }));
  };

  const isBlocked = loading || pendingForm !== null;

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!configured) {
    return (
      <SetupScreen
        onDone={(base) => {
          setApiBase(base);
          setConfigured(true);
        }}
      />
    );
  }

  return (
    <div className="h-screen flex bg-background">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          apiBase={apiBase}
          pendingForm={pendingForm}
          hasMessages={messages.length > 0}
          isBlocked={isBlocked}
          settingsOpen={settingsOpen}
          onRunHealth={() => runAction("GET /health", () => apiGet("/health"))}
          onRunInvoices={() => runAction("GET /invoices", () => apiGet("/invoices"))}
          onClearChat={clearChat}
          onToggleSettings={() => setSettingsOpen((o) => !o)}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
        />

        {settingsOpen && (
          <SettingsPanel
            onClose={() => setSettingsOpen(false)}
            onSave={(base) => setApiBase(base)}
          />
        )}

        <main className="flex-1 overflow-hidden flex flex-col min-h-0">
          <ConversationArea
            messages={messages}
            loading={loading}
            loadingLabel={loadingLabel}
            pendingForm={pendingForm}
            formSubmitting={formSubmitting}
            onSendExample={(p) => sendMessage(p)}
            onToggleRaw={toggleRaw}
            onFormChange={handleFormChange}
            onFormSubmit={handleFormSubmit}
          />

          <Composer
            input={input}
            onInputChange={setInput}
            onSend={sendMessage}
            loading={loading}
            isBlocked={isBlocked}
            hasPendingForm={pendingForm !== null && !pendingForm.submitted}
            hasMessages={messages.length > 0}
            textareaRef={textareaRef}
          />
        </main>
      </div>
    </div>
  );
}
