// ─── Invoice list panel ─────────────────────────────────────────────────────
// Shown for status "invoice_list" (and for the header's "Invoices" quick
// action). Compact table of invoices with a Preview/Download link each.

import { formatCurrency, pdfProxyUrl } from "../../lib/helpers";
import { RawToggle } from "./RawToggle";
import type { InvoiceListItem } from "../../types";

export function InvoiceListPanel({
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
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-2 bg-muted/50 border-b border-border">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Invoice</div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-20 text-right">Issued</div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-20 text-right">Total</div>
          <div className="w-28" />
        </div>

        {invoices.map((inv, i) => {
          const proxyPdf = inv.pdf_url ? pdfProxyUrl(inv.pdf_url) : null;
          const label = inv.invoice_number ?? `#${inv.id ?? i + 1}`;
          return (
            <div
              key={inv.id ?? i}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-accent/40 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{label}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {inv.client_name ?? inv.business_name ?? "—"}
                </div>
              </div>
              <div className="w-20 text-right text-xs text-muted-foreground">{inv.issue_date ?? "—"}</div>
              <div className="w-20 text-right text-sm font-semibold">{formatCurrency(inv.total, inv.currency)}</div>
              <div className="w-28 flex items-center justify-end gap-1.5">
                {proxyPdf ? (
                  <>
                    <a href={proxyPdf} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-medium text-primary hover:underline">Preview</a>
                    <span className="text-border">·</span>
                    <a href={proxyPdf} download={`${label}.pdf`}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground">Download</a>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">No PDF</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <RawToggle raw={raw} showRaw={showRaw} onToggle={onToggle} />
    </div>
  );
}
