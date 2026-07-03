// ─── Invoice card ───────────────────────────────────────────────────────────
// Shown after the backend returns a "created" invoice (status: created or a
// direct invoice_id). Renders totals plus Open/Download PDF links.

import { formatCurrency, pdfProxyUrl } from "../../lib/helpers";
import { RawToggle } from "./RawToggle";
import type { CompleteResponse } from "../../types";

export function InvoiceCard({
  data,
  raw,
  showRaw,
  onToggle,
}: {
  data: CompleteResponse;
  raw: unknown;
  showRaw: boolean;
  onToggle: () => void;
}) {
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
