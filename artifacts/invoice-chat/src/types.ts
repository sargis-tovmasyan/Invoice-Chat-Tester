// ─── Shared types ───────────────────────────────────────────────────────────
// All the data shapes used across the app live here so any file can import
// them without guessing what another file calls things.

export type MessageRole = "user" | "assistant" | "system" | "error";

export type ChatStatus =
  | "answer"
  | "invoice_list"
  | "created"
  | "missing_fields"
  | "ai_parse_error"
  | "llm_unavailable"
  | string;

export interface DraftObject {
  [key: string]: unknown;
}

export interface CompleteResponse {
  status?: string;
  invoice_id?: number | string;
  invoice_number?: string;
  subtotal?: number;
  total?: number;
  currency?: string;
  pdf_url?: string;
  [key: string]: unknown;
}

export interface InvoiceListItem {
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

export interface ChatDiagnostics {
  request_id: string | null;
  trace_id: string | null;
  model: string | null;
  duration_ms: number;
  llm_calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  tokens_per_second: number | null;
}

export interface ChatResponse extends CompleteResponse {
  status: ChatStatus;
  chat_id?: string;
  message?: string;
  invoices?: InvoiceListItem[];
  missing_fields?: string[];
  draft?: DraftObject;
  diagnostics?: ChatDiagnostics;
}

export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface ChatThread {
  id: string;
  title?: string;
  updated_at?: string;
  created_at?: string;
  messages?: StoredChatMessage[];
  session_memory?: {
    draft?: DraftObject;
    missing_fields?: string[];
  };
}

// The "payload" is whatever extra content renders below an assistant message —
// an invoice card, a list of invoices, a form, or just a raw JSON toggle.
export type ParsedPayload =
  | { kind: "invoice"; data: CompleteResponse; raw: unknown }
  | { kind: "invoice_list"; invoices: InvoiceListItem[]; raw: unknown }
  | { kind: "missing_fields"; fields: string[]; draft: DraftObject; raw: unknown }
  | { kind: "error_status"; message: string; status: string; raw: unknown }
  | { kind: "generic"; raw: unknown };

export interface RequestInfo {
  method: string;
  endpoint: string;
  body?: unknown;
}

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: number;
  streaming?: boolean;
  retryable?: boolean;
  payload?: ParsedPayload;
  showRaw?: boolean;
  requestInfo?: RequestInfo;
  diagnostics?: ChatDiagnostics;
}

export interface PendingForm {
  messageId: string;
  chatId?: string;
  draft: DraftObject;
  fields: string[];
  missingFields: string[];
  values: Record<string, string>;
  submitted: boolean;
}

// One chat conversation in the sidebar. Frontend-only, in-memory — reloading
// the page starts fresh, on purpose (no backend history/persistence).
export interface ChatSession {
  id: string;
  backendChatId?: string;
  title: string;
  messages: Message[];
  pendingForm: PendingForm | null;
  createdAt: number;
}
