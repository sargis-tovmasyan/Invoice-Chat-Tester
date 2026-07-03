// ─── App page ───────────────────────────────────────────────────────────────
// Top-level layout: Sidebar (chat sessions) + Header + ConversationArea +
// Composer. Owns the session list and all the chat/network logic; every
// visible area is its own component under src/components/.
//
// Sessions are frontend-only and in-memory — see src/session/sessionHelpers.ts.
// API calls live in src/api/client.ts. Everything else (types, constants,
// helpers) is split out so each concern has one obvious home.

import { useState, useRef, useEffect, useCallback } from "react";
import { unlockAudio, playSend, playReceive, playSuccess, playError, playMissingFields, playConfirm, playPing } from "./lib/sounds";
import { PROXY_BASE, INVOICE_FORM_FIELDS } from "./lib/constants";
import { uid, deepClone, setNestedValue, normalizeFormValue, validateFormValues, buildInitialFormValues, responseErrorMessage, deriveSessionTitle } from "./lib/helpers";
import { apiGet, sendChatMessage, completeInvoiceDraft, getApiBase, isApiBaseConfigured } from "./api/client";
import { createEmptySession } from "./session/sessionHelpers";

import { Sidebar } from "./components/Sidebar/Sidebar";
import { Header } from "./components/Header/Header";
import { ConversationArea } from "./components/Conversation/ConversationArea";
import { Composer } from "./components/Composer/Composer";
import { SettingsPanel } from "./components/Settings/SettingsPanel";
import { SetupScreen } from "./components/Settings/SetupScreen";

import type { ChatSession, Message, PendingForm, DraftObject, CompleteResponse, ChatResponse, InvoiceListItem } from "./types";

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

  const handleNewChat = () => {
    const session = createEmptySession();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setInput("");
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    setInput("");
  };

  // ── Call /invoices/draft/complete ─────────────────────────────────────────

  const callComplete = useCallback(async (sessionId: string, draft: DraftObject) => {
    setLoadingLabel("Creating invoice…");
    const { data, ok } = await completeInvoiceDraft(draft) as { data: CompleteResponse; ok: boolean };

    if (!ok || (data.status && data.status !== "created" && !data.invoice_id)) {
      playError();
      addMsg(sessionId, {
        role: "error",
        text: `Draft complete failed: ${responseErrorMessage(data as Record<string, unknown>)}`,
        payload: { kind: "generic", raw: data },
      });
      return;
    }

    playSuccess();
    addMsg(sessionId, {
      role: "assistant",
      text: `Invoice created — ${data.invoice_number ?? `#${data.invoice_id}`}`,
      payload: { kind: "invoice", data, raw: data },
    });
  }, [addMsg]);

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
    if (!preset) setInput("");

    playSend();
    addMsg(sessionId, { role: "user", text, requestInfo: { method: "POST", endpoint: `${PROXY_BASE}/chat`, body: { message: text } } });
    setLoading(true);
    setLoadingLabel("Thinking…");

    try {
      const { data: chatData, ok } = await sendChatMessage(text) as { data: ChatResponse; ok: boolean };

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
