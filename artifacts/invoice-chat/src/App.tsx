import { useState, useRef, useEffect, useCallback } from "react";
import {
  unlockAudio,
  playSend,
  playReceive,
  playSuccess,
  playError,
  playMissingFields,
  playConfirm,
  playPing,
} from "./lib/sounds";

// ─── Constants ───────────────────────────────────────────────────────────────

const PROXY_BASE = "/api/proxy";

const EXAMPLE_PROMPTS = [
  "Hi",
  "Show me all my invoices",
  "Create invoice INV-001 from Sargis Studio for client Alex Johnson, issued 2026-06-28, due 2026-07-05, USD — website design $300",
];

const INVOICE_FORM_FIELDS = [
  "invoice_number",
  "issue_date",
  "due_date",
  "currency",
  "business.name",
  "client.name",
  "items",
];

const CURRENCY_OPTIONS = ["USD", "RUR", "AMD", "EUR"];

// ─── Types ───────────────────────────────────────────────────────────────────

type MessageRole = "user" | "assistant" | "system" | "error";

type ChatStatus =
  | "answer"
  | "invoice_list"
  | "created"
  | "missing_fields"
  | "ai_parse_error"
  | "llm_unavailable"
  | string;

interface DraftObject {
  [key: string]: unknown;
}

interface CompleteResponse {
  status?: string;
  invoice_id?: number | string;
  invoice_number?: string;
  subtotal?: number;
  total?: number;
  currency?: string;
  pdf_url?: string;
  [key: string]: unknown;
}

interface InvoiceListItem {
  id?: number | string;
  invoice_number?: string;
  issue_date?: string;
  due_date?: string;
  currency?: string;
  business_name?: string;
  client_name?: string;
  total?: number;
  pdf_url?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface ChatResponse extends CompleteResponse {
  status: ChatStatus;
  message?: string;
  invoices?: InvoiceListItem[];
  missing_fields?: string[];
  draft?: DraftObject;
}

type ParsedPayload =
  | { kind: "invoice"; data: CompleteResponse; raw: unknown }
  | { kind: "invoice_list"; invoices: InvoiceListItem[]; raw: unknown }
  | { kind: "missing_fields"; fields: string[]; draft: DraftObject; raw: unknown }
  | { kind: "error_status"; message: string; status: string; raw: unknown }
  | { kind: "generic"; raw: unknown };

interface RequestInfo {
  method: string;
  endpoint: string;
  body?: unknown;
}

interface Message {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: number;
  payload?: ParsedPayload;
  showRaw?: boolean;
  requestInfo?: RequestInfo;
}

interface PendingForm {
  messageId: string;
  draft: DraftObject;
  fields: string[];
  missingFields: string[];
  values: Record<string, string>;
  submitted: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() { return crypto.randomUUID(); }

function formatCurrency(value: number | string | undefined, currency = "USD") {
  if (value === undefined || value === null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(num); }
  catch { return `${currency} ${num.toFixed(2)}`; }
}

function fieldLabel(path: string): string {
  return path
    .split(".")
    .map((p) => p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" › ");
}

function setNestedValue(obj: DraftObject, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]] as DraftObject;
  }
  cur[parts[parts.length - 1]] = value || null;
}

function getNestedValue(obj: DraftObject, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, part) => {
    if (typeof cur !== "object" || cur === null) return undefined;
    return (cur as DraftObject)[part];
  }, obj);
}

function stringifyFormValue(draft: DraftObject, field: string): string {
  const value = getNestedValue(draft, field);
  if (field === "items" && Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item !== "object" || item === null) return "";
        const record = item as Record<string, unknown>;
        return `${String(record.description ?? "")} - ${String(record.unit_price ?? "")}`.trim();
      })
      .filter(Boolean)
      .join(", ");
  }
  return value === undefined || value === null ? "" : String(value);
}

function buildInitialFormValues(draft: DraftObject, fields: string[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field, stringifyFormValue(draft, field)]));
}

function inputTypeForField(field: string): string {
  if (field === "issue_date" || field === "due_date") return "date";
  return "text";
}

function parseMoney(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function parseItemsInput(value: string): Array<{ description: string; quantity: number; unit_price: number }> {
  return value
    .split(/\n|,/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const price = parseMoney(part);
      const description = part
        .replace(/\s*[-–—:]\s*\d[\d\s.,]*(?:[A-Za-z]{3})?\s*$/i, "")
        .trim();
      return {
        description: description || part,
        quantity: 1,
        unit_price: price ?? 0,
      };
    });
}

function normalizeFormValue(path: string, value: string): unknown {
  if (path === "items") return parseItemsInput(value);
  return value;
}

function validateFormValues(values: Record<string, string>, missingFields: string[]): string | null {
  const currency = values.currency?.trim();
  if (currency && !CURRENCY_OPTIONS.includes(currency)) {
    return "Currency must be one of USD, RUR, AMD, EUR.";
  }
  if (missingFields.includes("items") && parseItemsInput(values.items ?? "").length === 0) {
    return "Add at least one invoice item.";
  }
  return null;
}

function responseErrorMessage(data: Record<string, unknown>): string {
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
  return String(data.message ?? detail ?? "Unexpected response");
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function pdfProxyUrl(pdfPath: string): string {
  const path = pdfPath.startsWith("http")
    ? new URL(pdfPath).pathname
    : pdfPath;
  return `${PROXY_BASE}/pdf?path=${encodeURIComponent(path)}`;
}

async function apiPost<T>(path: string, body: unknown): Promise<{ data: T; ok: boolean; status: number }> {
  const resp = await fetch(`${PROXY_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const ct = resp.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await resp.json() : { raw_response: await resp.text() };
  return { data: data as T, ok: resp.ok, status: resp.status };
}

async function apiGet<T>(path: string): Promise<{ data: T; ok: boolean; status: number }> {
  const resp = await fetch(`${PROXY_BASE}${path}`);
  const ct = resp.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await resp.json() : { raw_response: await resp.text() };
  return { data: data as T, ok: resp.ok, status: resp.status };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RawToggle({ raw, showRaw, onToggle }: { raw: unknown; showRaw: boolean; onToggle: () => void }) {
  return (
    <div className="mt-2">
      <button onClick={onToggle} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
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

function InvoiceCard({ data, raw, showRaw, onToggle }: { data: CompleteResponse; raw: unknown; showRaw: boolean; onToggle: () => void }) {
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
            {data.invoice_number
              ? <div className="text-sm font-bold text-emerald-900">{data.invoice_number}</div>
              : data.invoice_id
              ? <div className="text-sm font-bold text-emerald-900">#{data.invoice_id}</div>
              : null}
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
          <p className="text-xs text-emerald-700 break-all">PDF: {data.pdf_url}</p>
        ) : null}
      </div>
      <RawToggle raw={raw} showRaw={showRaw} onToggle={onToggle} />
    </div>
  );
}

function InvoiceListCard({ invoices, raw, showRaw, onToggle }: { invoices: InvoiceListItem[]; raw: unknown; showRaw: boolean; onToggle: () => void }) {
  return (
    <div className="mt-3 w-full max-w-md">
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" />
            </svg>
          </div>
          <div className="text-xs font-semibold text-sky-700 uppercase tracking-wide">Invoices</div>
        </div>

        {invoices.length === 0 ? (
          <div className="rounded-lg bg-white/70 px-3 py-2 text-sm text-sky-900">No invoices found.</div>
        ) : (
          <div className="space-y-2">
            {invoices.map((invoice) => {
              const proxyPdf = invoice.pdf_url ? pdfProxyUrl(invoice.pdf_url) : null;
              return (
                <div key={invoice.id} className="rounded-lg bg-white/70 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-sky-950 truncate">{invoice.invoice_number}</div>
                      <div className="text-xs text-sky-700 truncate">
                        {invoice.client_name ?? "Unknown client"} · {invoice.issue_date ?? "No issue date"}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-sky-800 flex-shrink-0">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </div>
                  </div>
                  {proxyPdf && (
                    <a href={proxyPdf} target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900">
                      Open PDF
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <RawToggle raw={raw} showRaw={showRaw} onToggle={onToggle} />
    </div>
  );
}

function MissingFieldsForm({
  form,
  onChange,
  onSubmit,
  submitting,
  raw,
  showRaw,
  onToggleRaw,
}: {
  form: PendingForm;
  onChange: (field: string, value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  raw: unknown;
  showRaw: boolean;
  onToggleRaw: () => void;
}) {
  if (form.submitted) {
    return (
      <div className="mt-3 w-full max-w-sm">
        <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground italic">
          Details submitted ✓
        </div>
        <RawToggle raw={raw} showRaw={showRaw} onToggle={onToggleRaw} />
      </div>
    );
  }

  const allFilled = form.missingFields.every((f) => (form.values[f] ?? "").trim() !== "");

  return (
    <div className="mt-3 w-full max-w-sm">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Fill in the missing fields</span>
        </div>

        <div className="space-y-2.5 mb-4">
          {form.fields.map((field) => (
            <div key={field}>
              <label className="block text-xs font-medium text-amber-800 mb-1">{fieldLabel(field)}</label>
              {field === "currency" ? (
                <select
                  value={form.values[field] ?? ""}
                  onChange={(e) => onChange(field, e.target.value)}
                  disabled={submitting}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50"
                >
                  <option value="">Select currency</option>
                  {CURRENCY_OPTIONS.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              ) : field === "items" ? (
                <textarea
                  value={form.values[field] ?? ""}
                  onChange={(e) => onChange(field, e.target.value)}
                  placeholder="Software development - 300 AMD, Maintenance - 10 AMD"
                  disabled={submitting}
                  rows={3}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50"
                />
              ) : (
                <input
                  type={inputTypeForField(field)}
                  value={form.values[field] ?? ""}
                  onChange={(e) => onChange(field, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && allFilled && !submitting && onSubmit()}
                  placeholder={fieldLabel(field)}
                  disabled={submitting}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50"
                />
              )}
              {field === "items" && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Example: Software development - 300 AMD, Maintenance - 10 AMD
                </p>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={onSubmit}
          disabled={!allFilled || submitting}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-600 text-white text-sm font-medium py-2 px-4 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating invoice…
            </>
          ) : (
            "Complete Invoice"
          )}
        </button>
      </div>
      <RawToggle raw={raw} showRaw={showRaw} onToggle={onToggleRaw} />
    </div>
  );
}

function RequestDebugPanel({ info }: { info: RequestInfo }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"json" | "curl" | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const fullUrl = `${origin}${info.endpoint}`;
  const jsonBody = info.body !== undefined ? JSON.stringify(info.body, null, 2) : "";

  const curlCmd = [
    `curl -X ${info.method} '${fullUrl}'`,
    `  -H 'Content-Type: application/json'`,
    info.body !== undefined ? `  -d '${JSON.stringify(info.body)}'` : null,
  ].filter(Boolean).join(" \\\n");

  const copy = async (text: string, kind: "json" | "curl") => {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div className="mt-1.5 flex flex-col items-end">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors font-mono px-2 py-0.5 rounded-full hover:bg-primary/8"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3" />
        </svg>
        {open ? "hide request" : "show request"}
      </button>

      {open && (
        <div className="mt-1.5 w-full max-w-sm rounded-xl border border-border bg-muted/60 overflow-hidden text-left shadow-sm">
          {/* JSON body */}
          {jsonBody && (
            <div>
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/80">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide font-mono">JSON body</span>
                <button
                  onClick={() => copy(jsonBody, "json")}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied === "json" ? (
                    <><svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span className="text-emerald-500">copied</span></>
                  ) : (
                    <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg><span>copy</span></>
                  )}
                </button>
              </div>
              <pre className="text-[11px] font-mono text-foreground/80 px-3 py-2 overflow-x-auto leading-relaxed">{jsonBody}</pre>
            </div>
          )}

          {/* cURL */}
          <div>
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-muted/80">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide font-mono">cURL</span>
              <button
                onClick={() => copy(curlCmd, "curl")}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied === "curl" ? (
                  <><svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span className="text-emerald-500">copied</span></>
                ) : (
                  <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2v1"/></svg><span>copy</span></>
                )}
              </button>
            </div>
            <pre className="text-[11px] font-mono text-foreground/80 px-3 py-2 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">{curlCmd}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function InvoiceListPanel({
  invoices,
  raw,
  showRaw,
  onToggle,
}: {
  invoices: InvoiceListItem[];
  raw: unknown;
  showRaw: boolean;
  onToggle: () => void;
}) {
  if (invoices.length === 0) {
    return (
      <div className="mt-3 w-full max-w-xl">
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          No invoices found.
        </div>
        <RawToggle raw={raw} showRaw={showRaw} onToggle={onToggle} />
      </div>
    );
  }

  return (
    <div className="mt-3 w-full max-w-xl">
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-2 bg-muted/50 border-b border-border">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Invoice</div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-20 text-right">Issued</div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-20 text-right">Total</div>
          <div className="w-28" />
        </div>

        {/* Rows */}
        {invoices.map((inv, i) => {
          const proxyPdf = inv.pdf_url ? pdfProxyUrl(inv.pdf_url) : null;
          const label = inv.invoice_number ?? `#${inv.id ?? i + 1}`;
          const client = inv.client_name ?? inv.business_name ?? "—";
          const issued = inv.issue_date ?? "—";
          const total = formatCurrency(inv.total, inv.currency);

          return (
            <div
              key={inv.id ?? i}
              className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3 ${i < invoices.length - 1 ? "border-b border-border" : ""} hover:bg-muted/30 transition-colors`}
            >
              {/* Invoice info */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{label}</span>
                  {inv.due_date && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/20 font-medium">
                      due {inv.due_date}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">{client}</div>
              </div>

              {/* Issue date */}
              <div className="text-xs text-muted-foreground w-20 text-right tabular-nums">{issued}</div>

              {/* Total */}
              <div className="text-sm font-semibold text-foreground w-20 text-right tabular-nums">{total}</div>

              {/* Actions */}
              <div className="flex gap-1.5 w-28 justify-end">
                {proxyPdf ? (
                  <>
                    <a
                      href={proxyPdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open PDF"
                      className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <a
                      href={proxyPdf}
                      download={`${label}.pdf`}
                      title="Download PDF"
                      className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-muted-foreground hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground italic">no PDF</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary line */}
      <div className="mt-1.5 px-1 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</span>
        <RawToggle raw={raw} showRaw={showRaw} onToggle={onToggle} />
      </div>
    </div>
  );
}

function TypingIndicator({ label }: { label: string }) {
  return (
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
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Thinking…");
  const [pendingForm, setPendingForm] = useState<PendingForm | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, pendingForm]);

  const addMsg = useCallback((m: Omit<Message, "id" | "timestamp"> & { id?: string }) => {
    const full: Message = { id: m.id ?? uid(), timestamp: Date.now(), showRaw: false, ...m };
    setMessages((prev) => [...prev, full]);
    return full.id;
  }, []);

  const toggleRaw = useCallback((id: string) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, showRaw: !m.showRaw } : m));
  }, []);

  // ── Call /invoices/draft/complete ─────────────────────────────────────────

  const callComplete = useCallback(async (draft: DraftObject) => {
    setLoadingLabel("Creating invoice…");
    const { data, ok } = await apiPost<CompleteResponse>("/complete", { draft });

    if (!ok || (data.status && data.status !== "created" && !data.invoice_id)) {
      playError();
      addMsg({
        role: "error",
        text: `Draft complete failed: ${responseErrorMessage(data as Record<string, unknown>)}`,
        payload: { kind: "generic", raw: data },
      });
      return;
    }

    playSuccess();
    addMsg({
      role: "assistant",
      text: `Invoice created — ${data.invoice_number ?? `#${data.invoice_id}`}`,
      payload: { kind: "invoice", data, raw: data },
    });
  }, [addMsg]);

  // ── Handle missing fields form submit ─────────────────────────────────────

  const handleFormSubmit = async () => {
    if (!pendingForm || formSubmitting) return;
    const validationError = validateFormValues(pendingForm.values, pendingForm.missingFields);
    if (validationError) {
      playError();
      addMsg({ role: "error", text: validationError });
      return;
    }
    playConfirm();
    setFormSubmitting(true);

    // Merge form values into draft using dot-path setter
    const merged = deepClone(pendingForm.draft);
    for (const [path, value] of Object.entries(pendingForm.values)) {
      setNestedValue(merged, path, normalizeFormValue(path, value));
    }

    // Mark form as submitted in UI
    setPendingForm((f) => f ? { ...f, submitted: true } : null);

    try {
      await callComplete(merged);
    } catch (err) {
      addMsg({ role: "error", text: `Network error: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setFormSubmitting(false);
      setPendingForm(null);
    }
  };

  const handleFormChange = (field: string, value: string) => {
    setPendingForm((f) => f ? { ...f, values: { ...f.values, [field]: value } } : null);
  };

  // ── Send chat message ─────────────────────────────────────────────────────

  const sendMessage = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || loading || pendingForm !== null) return;
    if (!preset) setInput("");

    playSend();
    addMsg({ role: "user", text, requestInfo: { method: "POST", endpoint: `${PROXY_BASE}/chat`, body: { message: text } } });
    setLoading(true);
    setLoadingLabel("Thinking…");

    try {
      const { data: chatData, ok } = await apiPost<ChatResponse>("/chat", { message: text });

      if (!ok) {
        playError();
        addMsg({
          role: "error",
          text: `Chat request failed: ${String(chatData.message ?? (chatData as Record<string, unknown>).detail ?? "Server error")}`,
          payload: { kind: "generic", raw: chatData },
        });
        return;
      }

      const status = chatData.status;

      // ── answer ──
      if (status === "answer") {
        playReceive();
        addMsg({
          role: "assistant",
          text: chatData.message ?? "How can I help?",
        });
        return;
      }

      // ── invoice_list ──
      if (status === "invoice_list") {
        playPing();
        addMsg({
          role: "assistant",
          text: chatData.message ?? "Here are your invoices.",
          payload: { kind: "invoice_list", invoices: chatData.invoices ?? [], raw: chatData },
        });
        return;
      }

      // ── ai_parse_error ──
      if (status === "ai_parse_error") {
        playError();
        addMsg({
          role: "error",
          text: chatData.message ?? "Could not parse your request. Please try rephrasing.",
          payload: { kind: "error_status", message: chatData.message ?? "", status, raw: chatData },
        });
        return;
      }

      // ── llm_unavailable ──
      if (status === "llm_unavailable") {
        playError();
        addMsg({
          role: "error",
          text: chatData.message ?? "AI assistant is temporarily unavailable. Please try again later.",
          payload: { kind: "error_status", message: chatData.message ?? "", status, raw: chatData },
        });
        return;
      }

      // ── created ──
      if (status === "created" || chatData.invoice_id) {
        playSuccess();
        addMsg({
          role: "assistant",
          text: `Invoice created — ${chatData.invoice_number ?? `#${chatData.invoice_id}`}`,
          payload: { kind: "invoice", data: chatData, raw: chatData },
        });
        return;
      }

      // ── missing_fields ──
      if (status === "missing_fields") {
        const draft = chatData.draft ?? {};
        const missingFields = chatData.missing_fields ?? [];
        const fields = INVOICE_FORM_FIELDS;
        const formMsgId = uid();

        playMissingFields();
        addMsg({
          id: formMsgId,
          role: "assistant",
          text: "I need a few more details to complete your invoice:",
          payload: { kind: "missing_fields", fields, draft, raw: chatData },
        });

        setPendingForm({
          messageId: formMsgId,
          draft,
          fields,
          missingFields,
          values: buildInitialFormValues(draft, fields),
          submitted: false,
        });
        return;
      }

      // ── unknown status fallback ──
      playReceive();
      addMsg({
        role: "assistant",
        text: `Received status "${status ?? "unknown"}" from the API.`,
        payload: { kind: "generic", raw: chatData },
      });

    } catch (err) {
      playError();
      addMsg({ role: "error", text: `Network error: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setLoading(false);
      setLoadingLabel("Thinking…");
    }
  };

  // ── Quick actions ─────────────────────────────────────────────────────────

  const runAction = async (label: string, fn: () => Promise<{ data: unknown }>) => {
    if (loading || pendingForm !== null) return;
    addMsg({ role: "system", text: `▶ ${label}` });
    setLoading(true);
    setLoadingLabel(`${label}…`);
    try {
      const { data } = await fn();
      playPing();

      // Detect invoice list response — array of objects with invoice_number or id
      const isInvoiceList =
        Array.isArray(data) &&
        data.length >= 0 &&
        (data.length === 0 || (typeof data[0] === "object" && data[0] !== null && ("invoice_number" in data[0] || "id" in data[0])));

      if (isInvoiceList) {
        addMsg({
          role: "assistant",
          text: `Found ${(data as unknown[]).length} invoice${(data as unknown[]).length !== 1 ? "s" : ""}`,
          payload: { kind: "invoice_list", invoices: data as InvoiceListItem[], raw: data },
          showRaw: false,
        });
      } else {
        addMsg({ role: "assistant", text: `Response — ${label}`, payload: { kind: "generic", raw: data }, showRaw: true });
      }
    } catch (err) {
      playError();
      addMsg({ role: "error", text: `${label} failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setLoading(false);
      setLoadingLabel("Thinking…");
    }
  };

  const clearChat = () => {
    setMessages([]);
    setPendingForm(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const isBlocked = loading || pendingForm !== null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-background">

      {/* ── Header ── */}
      <header className="flex-shrink-0 border-b border-border bg-card shadow-sm z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight">Document AI Tester</div>
              <div className="text-xs text-muted-foreground leading-tight truncate hidden sm:block">
                {pendingForm && !pendingForm.submitted
                  ? `⚠ Fill in: ${pendingForm.missingFields.join(", ")}`
                  : "Proxy → http://161.153.29.155:8000"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => runAction("GET /health", () => apiGet("/health"))}
              disabled={isBlocked}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-secondary hover:bg-accent transition-colors disabled:opacity-40">
              Health
            </button>
            <button onClick={() => runAction("GET /invoices", () => apiGet("/invoices"))}
              disabled={isBlocked}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-secondary hover:bg-accent transition-colors disabled:opacity-40">
              Invoices
            </button>
            {messages.length > 0 && (
              <button onClick={clearChat}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors">
                Clear
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Chat ── */}
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
                <h2 className="text-base font-semibold mb-1">Document AI Tester</h2>
                <p className="text-sm text-muted-foreground max-w-xs mb-6">
                  Ready for professional document questions and invoices.
                </p>
                <div className="w-full max-w-sm space-y-2 text-left">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Examples</div>
                  {EXAMPLE_PROMPTS.map((p, i) => (
                    <button key={i} onClick={() => sendMessage(p)}
                      className="w-full text-left text-sm px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/30 transition-all leading-snug">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => {
              const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              const isUser = msg.role === "user";
              const isSystem = msg.role === "system";
              const isError = msg.role === "error";
              const payload = msg.payload;
              const isMissingFieldsMsg = payload?.kind === "missing_fields";

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center mb-3">
                    <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full border border-border font-mono">{msg.text}</span>
                  </div>
                );
              }

              if (isUser) {
                return (
                  <div key={msg.id} className="flex justify-end mb-4">
                    <div className="max-w-[72%] flex flex-col items-end">
                      <div className="rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-3 text-sm leading-relaxed shadow-sm">
                        {msg.text}
                      </div>
                      {msg.requestInfo && <RequestDebugPanel info={msg.requestInfo} />}
                      <div className="text-xs text-muted-foreground mt-1 px-1">{time}</div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="flex items-start gap-2 mb-4">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isError ? "bg-destructive/10" : "bg-primary/10"}`}>
                    {isError
                      ? <svg className="w-3.5 h-3.5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      : <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    }
                  </div>

                  <div className="max-w-[75%] flex flex-col items-start">
                    <div className={`rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed shadow-sm ${isError ? "bg-red-50 border border-red-200 text-red-800" : "bg-card border border-border text-card-foreground"}`}>
                      {msg.text}
                    </div>

                    {/* Invoice result */}
                    {payload?.kind === "invoice" && (
                      <InvoiceCard data={payload.data} raw={payload.raw} showRaw={msg.showRaw ?? false} onToggle={() => toggleRaw(msg.id)} />
                    )}

                    {/* Invoice list */}
                    {payload?.kind === "invoice_list" && (
                      <InvoiceListPanel invoices={payload.invoices} raw={payload.raw} showRaw={msg.showRaw ?? false} onToggle={() => toggleRaw(msg.id)} />
                    )}

                    {/* Missing fields — show form if this message's form is still active, else show submitted state */}
                    {isMissingFieldsMsg && (() => {
                      const isActive = pendingForm?.messageId === msg.id;
                      if (isActive && pendingForm) {
                        return (
                          <MissingFieldsForm
                            form={pendingForm}
                            onChange={handleFormChange}
                            onSubmit={handleFormSubmit}
                            submitting={formSubmitting}
                            raw={payload.raw}
                            showRaw={msg.showRaw ?? false}
                            onToggleRaw={() => toggleRaw(msg.id)}
                          />
                        );
                      }
                      return (
                        <div className="mt-3 w-full max-w-sm">
                          <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground italic">
                            Details submitted ✓
                          </div>
                          <RawToggle raw={payload.raw} showRaw={msg.showRaw ?? false} onToggle={() => toggleRaw(msg.id)} />
                        </div>
                      );
                    })()}

                    {/* Generic raw toggle */}
                    {(payload?.kind === "generic" || payload?.kind === "error_status") && (
                      <RawToggle raw={payload.raw} showRaw={msg.showRaw ?? false} onToggle={() => toggleRaw(msg.id)} />
                    )}

                    <div className="text-xs text-muted-foreground mt-1 px-1">{time}</div>
                  </div>
                </div>
              );
            })}

            {loading && <TypingIndicator label={loadingLabel} />}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* ── Input ── */}
        <div className="flex-shrink-0 border-t border-border bg-card">
          <div className="max-w-3xl mx-auto px-4 pt-3 pb-3">
            {/* Example chips */}
            {messages.length > 0 && !isBlocked && (
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

            {/* Pending form notice */}
            {pendingForm && !pendingForm.submitted && (
              <div className="mb-2 flex items-center gap-1.5 text-xs text-amber-700">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Fill in the form above before sending a new message.
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
                  pendingForm && !pendingForm.submitted
                    ? "Complete the form above first…"
                    : "Describe the invoice you want to create…"
                }
                disabled={isBlocked}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 leading-relaxed"
                style={{ minHeight: "42px", maxHeight: "160px" }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isBlocked}
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
              Enter to send · All calls route through the HTTPS proxy
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
