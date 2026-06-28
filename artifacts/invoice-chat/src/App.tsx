import { useState, useRef, useEffect, useCallback } from "react";

const STORAGE_KEY_BASE_URL = "invoice_chat_base_url";
const STORAGE_KEY_MESSAGES = "invoice_chat_messages";

const EXAMPLE_PROMPTS = [
  "Create an invoice for Acme Corp for 5 hours of consulting at $150/hr, due in 30 days",
  "Generate an invoice for web design services: logo design $800, homepage $1200, client is TechStart Ltd",
  "Invoice for John Smith: 3 units of Product A at $99 each and 2 units of Product B at $45",
];

type MessageRole = "user" | "assistant" | "error";

interface InvoiceResult {
  invoice_number?: string;
  subtotal?: number | string;
  total?: number | string;
  currency?: string;
  pdf_path?: string;
  [key: string]: unknown;
}

interface MissingFieldsResult {
  missing_fields?: string[];
  message?: string;
  [key: string]: unknown;
}

type ApiResponse =
  | { type: "invoice"; data: InvoiceResult; raw: unknown }
  | { type: "missing_fields"; data: MissingFieldsResult; raw: unknown }
  | { type: "ai_error"; message: string; raw: unknown }
  | { type: "server_error"; message: string; raw: unknown };

interface Message {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: number;
  apiResponse?: ApiResponse;
  showRaw?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number | string | undefined, currency = "USD") {
  if (value === undefined || value === null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}

function parseApiResponse(data: unknown): ApiResponse {
  if (typeof data !== "object" || data === null)
    return { type: "server_error", message: "Unexpected response format", raw: data };

  const obj = data as Record<string, unknown>;

  // Missing fields
  if (Array.isArray(obj.missing_fields) || (obj.missing_fields !== undefined && typeof obj.message === "string"))
    return { type: "missing_fields", data: obj as MissingFieldsResult, raw: data };

  // Invoice — has at least one of these keys
  if (obj.invoice_number !== undefined || obj.total !== undefined || obj.pdf_path !== undefined || obj.subtotal !== undefined)
    return { type: "invoice", data: obj as InvoiceResult, raw: data };

  // Error response
  if (obj.error !== undefined || obj.detail !== undefined) {
    const msg = String(obj.error ?? obj.detail ?? obj.message ?? "Unknown error");
    return { type: "ai_error", message: msg, raw: data };
  }

  return { type: "server_error", message: "Could not interpret API response", raw: data };
}

function getAssistantText(resp: ApiResponse): string {
  switch (resp.type) {
    case "invoice":
      return `Invoice created successfully${resp.data.invoice_number ? ` — ${resp.data.invoice_number}` : ""}.`;
    case "missing_fields":
      return resp.data.message ?? "I need a few more details to generate your invoice.";
    case "ai_error":
      return `The AI returned an error: ${resp.message}`;
    case "server_error":
      return `Server error: ${resp.message}`;
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function RawToggle({ raw, showRaw, onToggle }: { raw: unknown; showRaw: boolean; onToggle: () => void }) {
  return (
    <div className="mt-2">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg className={`w-3 h-3 transition-transform ${showRaw ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {showRaw ? "Hide" : "Show"} raw JSON
      </button>
      {showRaw && (
        <div className="mt-2 rounded-lg border border-border bg-muted p-3 overflow-auto max-h-64">
          <pre className="json-pre font-mono text-xs text-muted-foreground">{JSON.stringify(raw, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function InvoiceCard({
  data,
  raw,
  showRaw,
  onToggleRaw,
}: {
  data: InvoiceResult;
  raw: unknown;
  showRaw: boolean;
  onToggleRaw: () => void;
}) {
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem(STORAGE_KEY_BASE_URL) ?? "");

  useEffect(() => {
    const sync = () => setBaseUrl(localStorage.getItem(STORAGE_KEY_BASE_URL) ?? "");
    window.addEventListener("storage", sync);
    window.addEventListener("baseurlchanged", sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("baseurlchanged", sync); };
  }, []);

  const pdfUrl = data.pdf_path && baseUrl
    ? `${baseUrl.replace(/\/$/, "")}${data.pdf_path.startsWith("/") ? "" : "/"}${data.pdf_path}`
    : null;

  return (
    <div className="mt-3 w-full max-w-sm">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Invoice Created</div>
            {data.invoice_number && <div className="text-sm font-semibold">{data.invoice_number}</div>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-lg bg-muted px-3 py-2">
            <div className="text-xs text-muted-foreground mb-0.5">Subtotal</div>
            <div className="text-sm font-semibold">{formatCurrency(data.subtotal, data.currency)}</div>
          </div>
          <div className="rounded-lg bg-muted px-3 py-2">
            <div className="text-xs text-muted-foreground mb-0.5">Total</div>
            <div className="text-sm font-bold text-primary">{formatCurrency(data.total, data.currency)}</div>
          </div>
          <div className="rounded-lg bg-muted px-3 py-2">
            <div className="text-xs text-muted-foreground mb-0.5">Currency</div>
            <div className="text-sm font-semibold">{data.currency || "—"}</div>
          </div>
        </div>

        {pdfUrl ? (
          <div className="flex gap-2">
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium py-2 px-3 hover:opacity-90 transition-opacity">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open PDF
            </a>
            <a href={pdfUrl} download
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary text-secondary-foreground text-sm font-medium py-2 px-3 hover:bg-accent transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
          </div>
        ) : data.pdf_path ? (
          <div className="text-xs text-muted-foreground italic">
            PDF path: {data.pdf_path}
            {!baseUrl && <span className="text-amber-600 ml-1">(configure API Base URL to generate full link)</span>}
          </div>
        ) : null}
      </div>
      <RawToggle raw={raw} showRaw={showRaw} onToggle={onToggleRaw} />
    </div>
  );
}

function MissingFieldsCard({ data }: { data: MissingFieldsResult }) {
  const fields = data.missing_fields ?? [];
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 w-full max-w-sm">
      <div className="flex items-start gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">Missing Information</div>
          {data.message && <div className="text-sm text-amber-900">{data.message}</div>}
        </div>
      </div>
      {fields.length > 0 && (
        <ul className="space-y-1 mb-3">
          {fields.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="font-medium">{f}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="text-sm text-amber-800 font-medium">Please provide the missing details in your next message.</div>
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

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem(STORAGE_KEY_BASE_URL) ?? "");
  const [baseUrlInput, setBaseUrlInput] = useState(() => localStorage.getItem(STORAGE_KEY_BASE_URL) ?? "");
  const [baseUrlOpen, setBaseUrlOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MESSAGES);
      if (saved) return JSON.parse(saved) as Message[];
    } catch {}
    return [];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages)); } catch {}
  }, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const saveBaseUrl = () => {
    const trimmed = baseUrlInput.trim().replace(/\/$/, "");
    setBaseUrl(trimmed);
    localStorage.setItem(STORAGE_KEY_BASE_URL, trimmed);
    window.dispatchEvent(new Event("baseurlchanged"));
    setBaseUrlOpen(false);
  };

  const toggleRaw = useCallback((id: string) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, showRaw: !m.showRaw } : m));
  }, []);

  const sendMessage = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || loading) return;
    if (!preset) setInput("");

    if (!baseUrl) {
      setBaseUrlInput("");
      setBaseUrlOpen(true);
      return;
    }

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const resp = await fetch(`${baseUrl}/api/invoice/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      let data: unknown;
      const ct = resp.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        data = await resp.json();
      } else {
        const body = await resp.text();
        data = { error: body || `HTTP ${resp.status}` };
      }

      if (!resp.ok) {
        const obj = typeof data === "object" && data !== null ? data as Record<string, unknown> : {};
        const errMsg = String(obj.error ?? obj.detail ?? obj.message ?? `HTTP ${resp.status}`);
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          role: "error",
          text: `Request failed (${resp.status}): ${errMsg}`,
          timestamp: Date.now(),
          apiResponse: { type: "server_error", message: errMsg, raw: data },
          showRaw: false,
        }]);
        return;
      }

      const parsed = parseApiResponse(data);
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        text: getAssistantText(parsed),
        timestamp: Date.now(),
        apiResponse: parsed,
        showRaw: false,
      }]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Network error";
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "error",
        text: `Could not reach the API: ${errMsg}`,
        timestamp: Date.now(),
        apiResponse: { type: "server_error", message: errMsg, raw: null },
        showRaw: false,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY_MESSAGES); } catch {}
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* ── Header ── */}
      <header className="border-b border-border bg-card shadow-sm flex-shrink-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">Invoice AI Tester</div>
              <div className="text-xs text-muted-foreground leading-tight hidden sm:block">Chat with your invoice generation API</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button onClick={clearChat} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors">
                Clear chat
              </button>
            )}
            <button
              onClick={() => { setBaseUrlInput(baseUrl); setBaseUrlOpen((v) => !v); }}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                baseUrl
                  ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                  : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 animate-pulse"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {baseUrl ? "API configured" : "Set API URL"}
            </button>
          </div>
        </div>

        {/* API URL panel */}
        {baseUrlOpen && (
          <div className="border-t border-border bg-muted/40">
            <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">API Base URL</label>
                <input
                  type="url"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveBaseUrl()}
                  placeholder="https://your-api.example.com"
                  className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-input bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <button onClick={saveBaseUrl} className="text-sm font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity whitespace-nowrap">
                  Save
                </button>
                <button onClick={() => setBaseUrlOpen(false)} className="text-sm px-2 py-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
                  Cancel
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Saved in your browser. Messages are sent to{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{baseUrlInput || "{baseUrl}"}/api/invoice/generate</code>{" "}
                as <code className="bg-muted px-1 py-0.5 rounded text-[11px]">POST {"{ message }"}</code>.
              </p>
            </div>
          </div>
        )}
      </header>

      {/* ── Chat messages ── */}
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
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  Describe the invoice you want to create in plain language. The AI will extract the details and generate it.
                </p>

                {!baseUrl && (
                  <div className="mb-6 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800 max-w-sm text-left">
                    <strong>First step:</strong> Configure your API URL using the button in the top right.
                  </div>
                )}

                <div className="w-full max-w-sm space-y-2 text-left">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Try an example:</div>
                  {EXAMPLE_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(p)}
                      className="w-full text-left text-sm px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/30 transition-all leading-snug"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              const isError = msg.role === "error";
              const resp = msg.apiResponse;
              const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

              if (isUser) {
                return (
                  <div key={msg.id} className="flex items-end justify-end gap-2 mb-4">
                    <div className="max-w-[72%] flex flex-col items-end">
                      <div className="rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-3 text-sm leading-relaxed shadow-sm">
                        {msg.text}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 px-1">{time}</div>
                    </div>
                  </div>
                );
              }

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
                    <div className={`rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      isError
                        ? "bg-red-50 border border-red-200 text-red-800"
                        : "bg-card border border-border text-card-foreground"
                    }`}>
                      {msg.text}
                    </div>

                    {resp?.type === "invoice" && (
                      <InvoiceCard
                        data={resp.data}
                        raw={resp.raw}
                        showRaw={msg.showRaw ?? false}
                        onToggleRaw={() => toggleRaw(msg.id)}
                      />
                    )}

                    {resp?.type === "missing_fields" && (
                      <>
                        <MissingFieldsCard data={resp.data} />
                        <RawToggle raw={resp.raw} showRaw={msg.showRaw ?? false} onToggle={() => toggleRaw(msg.id)} />
                      </>
                    )}

                    {(resp?.type === "ai_error" || resp?.type === "server_error" || isError) && resp && (
                      <RawToggle raw={resp.raw} showRaw={msg.showRaw ?? false} onToggle={() => toggleRaw(msg.id)} />
                    )}

                    <div className="text-xs text-muted-foreground mt-1 px-1">{time}</div>
                  </div>
                </div>
              );
            })}

            {loading && <TypingIndicator />}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* ── Input area ── */}
        <div className="flex-shrink-0 border-t border-border bg-card">
          <div className="max-w-3xl mx-auto px-4 pt-3 pb-3">
            {/* Quick-fill examples when chat has content */}
            {messages.length > 0 && !loading && (
              <div className="flex gap-2 mb-2.5 overflow-x-auto pb-0.5 scrollbar-none">
                <span className="text-xs text-muted-foreground flex-shrink-0 self-center">Try:</span>
                {EXAMPLE_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(p)}
                    className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full border border-border bg-secondary text-secondary-foreground hover:bg-accent hover:border-primary/30 transition-all"
                  >
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
                  baseUrl
                    ? "Describe the invoice you want to create…"
                    : "Configure your API URL first, then describe your invoice…"
                }
                disabled={loading}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 leading-relaxed transition-all"
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
              Enter to send · Shift+Enter for new line · Chat history saved in browser
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
