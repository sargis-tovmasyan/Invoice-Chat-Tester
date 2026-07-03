// ─── Missing fields form ────────────────────────────────────────────────────
// Shown when the backend responds with status "missing_fields". Collects the
// missing invoice details, then submits the merged draft to /complete.

import { fieldLabel, inputTypeForField } from "../../lib/helpers";
import { CURRENCY_OPTIONS } from "../../lib/constants";
import { RawToggle } from "./RawToggle";
import type { PendingForm } from "../../types";

export function MissingFieldsForm({
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
