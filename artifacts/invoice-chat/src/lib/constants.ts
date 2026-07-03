// ─── App-wide constants ────────────────────────────────────────────────────
// Central place for values that don't change at runtime.

// Every API call goes through this local proxy path (see artifacts/api-server),
// which forwards the request to whatever API_BASE_URL the user configured.
export const PROXY_BASE = "/api/proxy";

// Used the first time the app runs, before the user has set their own URL.
export const DEFAULT_API_BASE = "http://161.153.29.155:8000";

// localStorage key where the user's chosen API Base URL is remembered.
export const LS_KEY = "invoice_ai_api_base";

// Prompts shown on the empty state and as quick-send chips.
export const EXAMPLE_PROMPTS = [
  "Hi",
  "Show me all my invoices",
  "Create invoice INV-001 from Sargis Studio for client Alex Johnson, issued 2026-06-28, due 2026-07-05, USD — website design $300",
];

// Fields shown in the "missing fields" form when the backend asks for more info.
export const INVOICE_FORM_FIELDS = [
  "invoice_number",
  "issue_date",
  "due_date",
  "currency",
  "business.name",
  "client.name",
  "items",
];

export const CURRENCY_OPTIONS = ["USD", "RUR", "AMD", "EUR"];
