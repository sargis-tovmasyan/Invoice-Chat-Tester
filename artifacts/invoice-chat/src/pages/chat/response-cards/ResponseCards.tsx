import { pdfProxyUrl } from "../api/chatApi";
import type { CompleteResponse, InvoiceListItem, ParsedPayload } from "../chat.types";
import { fieldLabel, formatCurrency } from "../utils/chatFormatters";

function RawJson({ raw, showRaw, onToggle }: { raw: unknown; showRaw: boolean; onToggle: () => void }) {
  return (
    <div className="mt-3">
      <button type="button" onClick={onToggle} className="text-xs text-muted-foreground hover:text-foreground">
        {showRaw ? "Hide" : "Show"} raw JSON
      </button>
      {showRaw && (
        <pre className="json-pre mt-2 max-h-64 overflow-auto rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
          {JSON.stringify(raw, null, 2)}
        </pre>
      )}
    </div>
  );
}

function CreatedInvoiceCard({ data }: { data: CompleteResponse }) {
  const pdfUrl = data.pdf_url ? pdfProxyUrl(data.pdf_url) : null;

  return (
    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Invoice created</div>
      <div className="mt-1 text-lg font-bold">{data.invoice_number ?? `#${data.invoice_id ?? "—"}`}</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-xl bg-white/70 p-2">
          <div className="text-xs text-emerald-700">Subtotal</div>
          <div className="font-semibold">{formatCurrency(data.subtotal, data.currency)}</div>
        </div>
        <div className="rounded-xl bg-white/70 p-2">
          <div className="text-xs text-emerald-700">Total</div>
          <div className="font-semibold">{formatCurrency(data.total, data.currency)}</div>
        </div>
        <div className="rounded-xl bg-white/70 p-2">
          <div className="text-xs text-emerald-700">Currency</div>
          <div className="font-semibold">{data.currency ?? "—"}</div>
        </div>
      </div>
      {pdfUrl && (
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          Open PDF
        </a>
      )}
    </div>
  );
}

function InvoiceListCard({ invoices }: { invoices: InvoiceListItem[] }) {
  return (
    <div className="mt-3 space-y-2">
      {invoices.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">No invoices found.</div>
      ) : invoices.map((invoice) => {
        const pdfUrl = invoice.pdf_url ? pdfProxyUrl(invoice.pdf_url) : null;
        return (
          <div key={String(invoice.id ?? invoice.invoice_number)} className="rounded-xl border border-border bg-background p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{invoice.invoice_number ?? `#${invoice.id}`}</div>
                <div className="text-xs text-muted-foreground">{invoice.business_name ?? "Business"} → {invoice.client_name ?? "Client"}</div>
              </div>
              <div className="text-right text-sm font-semibold">{formatCurrency(invoice.total, invoice.currency)}</div>
            </div>
            {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Open PDF</a>}
          </div>
        );
      })}
    </div>
  );
}

function MissingFieldsCard({ payload }: { payload: Extract<ParsedPayload, { kind: "missing_fields" }> }) {
  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Missing fields</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {payload.fields.map((field) => (
          <span key={field} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800 shadow-sm">
            {fieldLabel(field)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ResponsePayload({ payload, showRaw = false, onToggleRaw }: { payload?: ParsedPayload; showRaw?: boolean; onToggleRaw: () => void }) {
  if (!payload) return null;

  return (
    <>
      {payload.kind === "invoice" && <CreatedInvoiceCard data={payload.data} />}
      {payload.kind === "invoice_list" && <InvoiceListCard invoices={payload.invoices} />}
      {payload.kind === "missing_fields" && <MissingFieldsCard payload={payload} />}
      {payload.kind === "error_status" && <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{payload.message}</div>}
      <RawJson raw={payload.raw} showRaw={showRaw} onToggle={onToggleRaw} />
    </>
  );
}
