import { useState, useRef, useEffect, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const PROXY_BASE = "/api/proxy";
const STORAGE_KEY = "invoice_chat_messages_v2";

const EXAMPLE_PROMPTS = [
  "Create an invoice for Acme Corp for 5 hours of consulting at $150/hr, due in 30 days",
  "Generate an invoice: logo design $800, homepage $1,200 for TechStart Ltd",
  "Invoice for John Smith: 3 × Product A at $99, 2 × Product B at $45",
];

// ─── Types ───────────────────────────────────────────────────────────────────

type MessageRole = "user" | "assistant" | "system" | "error";

interface InvoiceData {
  invoice_id?: string | number;
  invoice_number?: string;
  subtotal?: number | string;
  total?: number | string;
  currency?: string;
  pdf_url?: string;
  [key: string]: unknown;
}

interface ExtractResponse {
  status?: string;
  missing_fields?: string[];
  message?: string;
  draft?: Record<string, unknown>;
  [key: string]: unknown;
}

type ParsedResponse =
  | { kind: "invoice"; data: InvoiceData; raw: unknown }
  | { kind: "missing_fields"; fields: string[]; message: string; draft: Record<string, unknown>; raw: unknown }
  | { kind: "api_error"; message: string; raw: unknown }
  | { kind: "generic"; raw: unknown };

interface Message {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: number;
  parsed?: ParsedResponse;
  showRaw?: boolean;
}

interface ConversationState {
  pendingDraft: Record<string, unknown> | null;
  pendingMissingFields: string[];
  originalMessage: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return crypto.randomUUID();
}

function formatCurrency(value: number | string | undefined, currency = "USD") {
  if (value === undefined || value === null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(num);
  } catch {
    return `${currency ?? ""} ${typeof num === "number" ? num.toFixed(2) : num}`;
  }
}

function pdfProxyUrl(rawPdfUrl: string): string {
  // Convert any http:// VPS URL or bare path into a proxy URL
  try {
    const parsed = new URL(rawPdfUrl);
    return `${PROXY_BASE}/pdf?path=${encodeURIComponent(parsed.pathname + parsed.search)}`;
  } catch {
    // It's already a bare path
    return `${PROXY_BASE}/pdf?path=${encodeURIComponent(rawPdfUrl)}`;
  }
}

function classifyExtractResponse(data: unknown, raw: unknown): ParsedResponse {
  if (typeof data !== "object" || data === null) {
    return { kind: "api_error", message: "Unexpected response format", raw };
  }
  const obj = data as Record<string, unknown>;

  // Completed invoice (has invoice_number or invoice_id + total)
  if (
    (obj.invoice_id !== undefined || obj.invoice_number !== undefined) &&
    (obj.total !== undefined || obj.pdf_url !== undefined)
  ) {
    return { kind: "invoice", data: obj as InvoiceData, raw };
  }

  // Missing fields
  if (obj.status === "missing_fields" || Array.isArray(obj.missing_fields)) {
    const fields = Array.isArray(obj.missing_fields) ? (obj.missing_fields as string[]) : [];
    const message =
      typeof obj.message === "string"
        ? obj.message
        : "Please provide the missing details below.";
    const draft = (typeof obj.draft === "object" && obj.draft !== null)
      ? (obj.draft as Record<string, unknown>)
      : (obj as Record<string, unknown>);
    return { kind: "missing_fields", fields, message, draft, raw };
  }

  // Complete / ready — but no invoice fields yet; treat as generic
  if (obj.status === "complete" || obj.status === "ready") {
    // draft complete was called elsewhere; treat this as an invoice if it has data
    if (obj.total !== undefined || obj.pdf_url !== undefined) {
      return { kind: "invoice", data: obj as InvoiceData, raw };
    }
  }

  // Error payload
  if (obj.error !== undefined || obj.detail !== undefined) {
    return {
      kind: "api_error",
      message: String(obj.error ?? obj.detail ?? obj.message ?? "Unknown error"),
      raw,
    };
  }

  return { kind: "generic", raw };
}

async function apiPost<T = unknown>(path: string, body: unknown): Promise<{ data: T; status: number }> {
  const resp = await fetch(`${PROXY_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const ct = resp.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await resp.json() : { raw_response: await resp.text() };
  return { data: data as T, status: resp.status };
}

async function apiGet<T = unknown>(path: string): Promise<{ data: T; status: number }> {
  const resp = await fetch(`${PROXY_BASE}${path}`, { method: "GET" });
  const ct = resp.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await resp.json() : { raw_response: await resp.text() };
  return { data: data as T, status: resp.status };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RawToggle({ raw, showRaw, onToggle }: { raw: unknown; showRaw: boolean; onToggle: () => void }) {
  return (
    <div className="mt-2">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg className={`w-3 h-3 transition-transform ${showRaw ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {showRaw ? "Hide" : "Show"} raw JSON
      </button>
      {showRaw && (
        <div className="mt-1.5 rounded-lg border border-border bg-muted p-3 overflow-auto max-h-60">
          <pre className="font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-all">
            {JSON.stringify(raw, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function InvoiceCard({ data, raw, showRaw, onToggle }: { data: InvoiceData; raw: unknown; showRaw: boolean; onToggle: () => void }) {
  const proxyPdf = data.pdf_url ? pdfProxyUrl(data.pdf_url) : null;

  return (
    <div className="mt-3 w-full max-w-sm">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Invoice Created</div>
            {data.invoice_number && <div className="text-sm font-bold text-emerald-900">{data.invoice_number}</div>}
            {data.invoice_id && !data.invoice_number && <div className="text-sm font-bold text-emerald-900">#{String(data.invoice_id)}</div>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-lg bg-white/60 px-2.5 py-2">
            <div className="text-[10px] text-emerald-600 font-medium mb-0.5 uppercase">Subtotal</div>
            <div className="text-sm font-semibold text-emerald-900">{formatCurrency(data.subtotal, data.currency)}</div>
          </div>
          <div className="rounded-lg bg-white/60 px-2.5 py-2">
            <div className="text-[10px] text-emerald-600 font-medium mb-0.5 uppercase">Total</div>
            <div className="text-sm font-bold text-emerald-700">{formatCurrency(data.total, data.currency)}</div>
          </div>
          <div className="rounded-lg bg-white/60 px-2.5 py-2">
            <div className="text-[10px] text-emerald-600 font-medium mb-0.5 uppercase">Currency</div>
            <div className="text-sm font-semibold text-emerald-900">{data.currency ?? "—"}</div>
          </div>
        </div>

        {proxyPdf ? (
          <div className="flex gap-2">
            <a href={proxyPdf} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium py-2 px-3 hover:bg-emerald-700 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open PDF
            </a>
            <a href={proxyPdf} download="invoice.pdf"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-700 text-sm font-medium py-2 px-3 hover:bg-emerald-50 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
          </div>
        ) : data.pdf_url ? (
          <div className="text-xs text-emerald-700 italic break-all">PDF: {data.pdf_url}</div>
        ) : null}
      </div>
      <RawToggle raw={raw} showRaw={showRaw} onToggle={onToggle} />
    </div>
  );
}

function MissingFieldsCard({
  fields,
  message,
  raw,
  showRaw,
  onToggle,
}: {
  fields: string[];
  message: string;
  raw: unknown;
  showRaw: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-3 w-full max-w-sm">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">Missing Information</div>
            <div className="text-sm text-amber-900">{message}</div>
          </div>
        </div>
        {fields.length > 0 && (
          <ul className="mt-2 space-y-1 pl-9">
            {fields.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-amber-800">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="font-medium">{f}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-amber-700 font-medium pl-9">
          Reply with these details to continue.
        </p>
      </div>
      <RawToggle raw={raw} showRaw={showRaw} onToggle={onToggle} />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-4">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-card border border-border px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5 h-4">
          <div className="typing-dot w-2 h-2 rounded-full bg-muted-foreground" />
          <div className="typing-dot w-2 h-2 rounded-full bg-muted-foreground" />
          <div className="typing-dot w-2 h-2 rounded-full bg-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved) as Message[];
    } catch {}
    return [];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Thinking…");

  // Tracks whether we're waiting for missing field answers
  const [convState, setConvState] = useState<ConversationState>({
    pendingDraft: null,
    pendingMissingFields: [],
    originalMessage: "",
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const addMsg = useCallback((m: Omit<Message, "id" | "timestamp">) => {
    const full: Message = { ...m, id: uid(), timestamp: Date.now() };
    setMessages((prev) => [...prev, full]);
    return full.id;
  }, []);

  const toggleRaw = useCallback((id: string) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, showRaw: !m.showRaw } : m));
  }, []);

  const clearChat = () => {
    setMessages([]);
    setConvState({ pendingDraft: null, pendingMissingFields: [], originalMessage: "" });
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  // ── Core send flow ────────────────────────────────────────────────────────

  const sendMessage = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || loading) return;
    if (!preset) setInput("");

    addMsg({ role: "user", text });
    setLoading(true);

    try {
      const hasPending = convState.pendingDraft !== null && convState.pendingMissingFields.length > 0;

      if (hasPending) {
        // Step 2 onward: user is providing missing field values
        // Re-call extract with combined context, then check if complete
        setLoadingLabel("Extracting details…");
        const { data: extractData } = await apiPost<unknown>("/extract", {
          message: `${convState.originalMessage}\n\nAdditional details: ${text}`,
        });

        const parsed = classifyExtractResponse(extractData, extractData);

        if (parsed.kind === "missing_fields") {
          // Still missing something
          setConvState((s) => ({
            ...s,
            pendingDraft: parsed.draft,
            pendingMissingFields: parsed.fields,
          }));
          addMsg({
            role: "assistant",
            text: parsed.message,
            parsed,
            showRaw: false,
          });
          return;
        }

        // Fields are complete — call draft complete
        setLoadingLabel("Completing invoice…");
        const draftToComplete =
          parsed.kind === "generic" || parsed.kind === "invoice"
            ? (typeof extractData === "object" && extractData !== null ? extractData as Record<string, unknown> : {})
            : convState.pendingDraft ?? {};

        const { data: completeData } = await apiPost<unknown>("/complete", draftToComplete);
        const completeParsed = classifyExtractResponse(completeData, completeData);

        setConvState({ pendingDraft: null, pendingMissingFields: [], originalMessage: "" });

        if (completeParsed.kind === "invoice") {
          addMsg({ role: "assistant", text: "Invoice completed successfully.", parsed: completeParsed, showRaw: false });
        } else if (completeParsed.kind === "missing_fields") {
          addMsg({ role: "assistant", text: completeParsed.message, parsed: completeParsed, showRaw: false });
          setConvState({ pendingDraft: completeParsed.draft, pendingMissingFields: completeParsed.fields, originalMessage: text });
        } else {
          addMsg({
            role: "assistant",
            text: "Draft complete call returned an unexpected response.",
            parsed: completeParsed,
            showRaw: false,
          });
        }

      } else {
        // Step 1: fresh extraction
        setLoadingLabel("Extracting invoice details…");
        const { data: extractData } = await apiPost<unknown>("/extract", { message: text });
        const parsed = classifyExtractResponse(extractData, extractData);

        if (parsed.kind === "missing_fields") {
          setConvState({
            pendingDraft: parsed.draft,
            pendingMissingFields: parsed.fields,
            originalMessage: text,
          });
          addMsg({ role: "assistant", text: parsed.message, parsed, showRaw: false });
          return;
        }

        if (parsed.kind === "invoice") {
          addMsg({ role: "assistant", text: "Invoice created successfully.", parsed, showRaw: false });
          setConvState({ pendingDraft: null, pendingMissingFields: [], originalMessage: "" });
          return;
        }

        // extract returned complete draft but not an invoice yet — call complete
        if (parsed.kind === "generic") {
          setLoadingLabel("Completing invoice…");
          const draftPayload =
            typeof extractData === "object" && extractData !== null
              ? (extractData as Record<string, unknown>)
              : {};
          const { data: completeData } = await apiPost<unknown>("/complete", draftPayload);
          const completeParsed = classifyExtractResponse(completeData, completeData);

          if (completeParsed.kind === "invoice") {
            addMsg({ role: "assistant", text: "Invoice created successfully.", parsed: completeParsed, showRaw: false });
          } else if (completeParsed.kind === "missing_fields") {
            setConvState({
              pendingDraft: completeParsed.draft,
              pendingMissingFields: completeParsed.fields,
              originalMessage: text,
            });
            addMsg({ role: "assistant", text: completeParsed.message, parsed: completeParsed, showRaw: false });
          } else {
            addMsg({ role: "assistant", text: "Received response from API.", parsed: completeParsed, showRaw: false });
          }
          return;
        }

        // api_error
        addMsg({
          role: "error",
          text: parsed.kind === "api_error" ? parsed.message : "Unexpected API response.",
          parsed,
          showRaw: false,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      addMsg({ role: "error", text: `Could not reach the API proxy: ${msg}`, showRaw: false });
    } finally {
      setLoading(false);
      setLoadingLabel("Thinking…");
    }
  };

  // ── Quick actions ─────────────────────────────────────────────────────────

  const runQuickAction = async (label: string, action: () => Promise<{ data: unknown }>) => {
    if (loading) return;
    addMsg({ role: "system", text: `▶ ${label}` });
    setLoading(true);
    setLoadingLabel(`${label}…`);
    try {
      const { data } = await action();
      addMsg({ role: "assistant", text: `Response for: ${label}`, parsed: { kind: "generic", raw: data }, showRaw: true });
    } catch (err) {
      addMsg({ role: "error", text: `${label} failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setLoading(false);
      setLoadingLabel("Thinking…");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-background">

      {/* ── Header ── */}
      <header className="flex-shrink-0 border-b border-border bg-card shadow-sm z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">Invoice AI Tester</div>
              <div className="text-xs text-muted-foreground leading-tight hidden sm:block">
                {convState.pendingMissingFields.length > 0
                  ? `⚠ Waiting for: ${convState.pendingMissingFields.join(", ")}`
                  : "Proxy → http://161.153.29.155:8000"}
              </div>
            </div>
          </div>

          {/* Quick-action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => runQuickAction("GET /health", () => apiGet("/health"))}
              disabled={loading}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-secondary hover:bg-accent transition-colors disabled:opacity-40"
              title="GET /health"
            >
              Health
            </button>
            <button
              onClick={() => runQuickAction("POST /ai/test", () => apiPost("/ai-test", {}))}
              disabled={loading}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-secondary hover:bg-accent transition-colors disabled:opacity-40"
              title="POST /ai/test"
            >
              AI Test
            </button>
            <button
              onClick={() => runQuickAction("GET /invoices", () => apiGet("/invoices"))}
              disabled={loading}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-secondary hover:bg-accent transition-colors disabled:opacity-40"
              title="GET /invoices"
            >
              Invoices
            </button>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Messages ── */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto chat-scroll">
          <div className="max-w-3xl mx-auto px-4 py-6">

            {/* Empty state */}
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold mb-1">Invoice AI Tester</h2>
                <p className="text-sm text-muted-foreground max-w-xs mb-2">
                  Type a natural-language invoice request. The app calls{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">/ai/invoice/extract</code> then{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">/invoices/draft/complete</code>{" "}
                  via a secure server-side proxy.
                </p>
                <p className="text-xs text-muted-foreground mb-6">
                  Use the <strong>Health</strong>, <strong>AI Test</strong>, and <strong>Invoices</strong> buttons above to ping individual endpoints.
                </p>
                <div className="w-full max-w-sm space-y-2 text-left">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Try an example:</div>
                  {EXAMPLE_PROMPTS.map((p, i) => (
                    <button key={i} onClick={() => sendMessage(p)}
                      className="w-full text-left text-sm px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/30 transition-all leading-snug">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg) => {
              const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              const isUser = msg.role === "user";
              const isSystem = msg.role === "system";
              const isError = msg.role === "error";
              const parsed = msg.parsed;

              // System messages (action labels)
              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center mb-3">
                    <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full border border-border font-mono">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              // User messages
              if (isUser) {
                return (
                  <div key={msg.id} className="flex justify-end mb-4">
                    <div className="max-w-[72%] flex flex-col items-end">
                      <div className="rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-3 text-sm leading-relaxed shadow-sm">
                        {msg.text}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 px-1">{time}</div>
                    </div>
                  </div>
                );
              }

              // Assistant / error messages
              return (
                <div key={msg.id} className="flex items-start gap-2 mb-4">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isError ? "bg-destructive/10" : "bg-primary/10"}`}>
                    {isError ? (
                      <svg className="w-3.5 h-3.5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                  </div>

                  <div className="max-w-[72%] flex flex-col items-start">
                    {/* Main bubble */}
                    <div className={`rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      isError
                        ? "bg-red-50 border border-red-200 text-red-800"
                        : "bg-card border border-border text-card-foreground"
                    }`}>
                      {msg.text}
                    </div>

                    {/* Structured content */}
                    {parsed?.kind === "invoice" && (
                      <InvoiceCard data={parsed.data} raw={parsed.raw} showRaw={msg.showRaw ?? false} onToggle={() => toggleRaw(msg.id)} />
                    )}

                    {parsed?.kind === "missing_fields" && (
                      <MissingFieldsCard
                        fields={parsed.fields}
                        message={parsed.message}
                        raw={parsed.raw}
                        showRaw={msg.showRaw ?? false}
                        onToggle={() => toggleRaw(msg.id)}
                      />
                    )}

                    {parsed?.kind === "api_error" && (
                      <RawToggle raw={parsed.raw} showRaw={msg.showRaw ?? false} onToggle={() => toggleRaw(msg.id)} />
                    )}

                    {parsed?.kind === "generic" && (
                      <RawToggle raw={parsed.raw} showRaw={msg.showRaw ?? false} onToggle={() => toggleRaw(msg.id)} />
                    )}

                    {isError && !parsed && (
                      <div className="mt-1 text-xs text-muted-foreground px-1">Check the proxy is running and the VPS is reachable.</div>
                    )}

                    <div className="text-xs text-muted-foreground mt-1 px-1">{time}</div>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-end gap-2 mb-4">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-primary animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="rounded-2xl rounded-bl-sm bg-card border border-border px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="typing-dot w-2 h-2 rounded-full bg-muted-foreground" />
                      <div className="typing-dot w-2 h-2 rounded-full bg-muted-foreground" />
                      <div className="typing-dot w-2 h-2 rounded-full bg-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground">{loadingLabel}</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* ── Input area ── */}
        <div className="flex-shrink-0 border-t border-border bg-card">
          <div className="max-w-3xl mx-auto px-4 pt-3 pb-3">
            {/* Pending missing fields reminder */}
            {convState.pendingMissingFields.length > 0 && !loading && (
              <div className="mb-2 flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-amber-700 font-medium">Still needed:</span>
                {convState.pendingMissingFields.map((f, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-800 font-medium">{f}</span>
                ))}
              </div>
            )}

            {/* Example chips when chat has content */}
            {messages.length > 0 && convState.pendingMissingFields.length === 0 && !loading && (
              <div className="flex gap-2 mb-2.5 overflow-x-auto scrollbar-none pb-0.5">
                <span className="text-xs text-muted-foreground flex-shrink-0 self-center">Try:</span>
                {EXAMPLE_PROMPTS.map((p, i) => (
                  <button key={i} onClick={() => sendMessage(p)}
                    className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full border border-border bg-secondary text-secondary-foreground hover:bg-accent hover:border-primary/30 transition-all">
                    {p.length > 38 ? p.slice(0, 38) + "…" : p}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  convState.pendingMissingFields.length > 0
                    ? `Provide: ${convState.pendingMissingFields.join(", ")}…`
                    : "Describe the invoice you want to create…"
                }
                disabled={loading}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 leading-relaxed"
                style={{ minHeight: "42px", maxHeight: "160px" }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-35 disabled:cursor-not-allowed transition-opacity"
              >
                {loading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 text-center">
              Enter to send · Shift+Enter for new line · All API calls route through the HTTPS proxy
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
