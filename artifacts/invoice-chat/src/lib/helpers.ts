// ─── Small, pure helper functions ──────────────────────────────────────────
// Formatting, validation, and object utilities used by the UI components.
// None of these talk to the network — see src/api/client.ts for that.

import { PROXY_BASE, CURRENCY_OPTIONS } from "./constants";
import type { DraftObject } from "../types";

export function uid() {
  return crypto.randomUUID();
}

export function formatCurrency(value: number | string | undefined, currency = "USD") {
  if (value === undefined || value === null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}

export function fieldLabel(path: string): string {
  return path
    .split(".")
    .map((p) => p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" › ");
}

export function setNestedValue(obj: DraftObject, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]] as DraftObject;
  }
  cur[parts[parts.length - 1]] = value || null;
}

export function getNestedValue(obj: DraftObject, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, part) => {
    if (typeof cur !== "object" || cur === null) return undefined;
    return (cur as DraftObject)[part];
  }, obj);
}

export function stringifyFormValue(draft: DraftObject, field: string): string {
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

export function buildInitialFormValues(draft: DraftObject, fields: string[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field, stringifyFormValue(draft, field)]));
}

export function inputTypeForField(field: string): string {
  if (field === "issue_date" || field === "due_date") return "date";
  return "text";
}

export function normalizeFormValue(_path: string, value: string): unknown {
  return value;
}

export function validateFormValues(values: Record<string, string>, missingFields: string[]): string | null {
  const currency = values.currency?.trim();
  if (currency && !CURRENCY_OPTIONS.includes(currency)) {
    return "Currency must be one of USD, RUR, AMD, EUR.";
  }
  if (missingFields.includes("items") && !(values.items ?? "").trim()) {
    return "Add at least one invoice item.";
  }
  return null;
}

export function responseErrorMessage(data: Record<string, unknown>): string {
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

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function pdfProxyUrl(pdfPath: string): string {
  const path = pdfPath.startsWith("http") ? new URL(pdfPath).pathname : pdfPath;
  return `${PROXY_BASE}/pdf?path=${encodeURIComponent(path)}`;
}

// Turns the first user message of a chat into a short sidebar title.
export function deriveSessionTitle(firstUserText: string): string {
  const trimmed = firstUserText.trim().replace(/\s+/g, " ");
  if (!trimmed) return "New chat";
  return trimmed.length > 40 ? trimmed.slice(0, 40) + "…" : trimmed;
}
