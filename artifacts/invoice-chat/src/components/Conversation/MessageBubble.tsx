// ─── Message bubble ─────────────────────────────────────────────────────────
// Renders a single chat message: user bubble, system marker, or an
// assistant/error bubble with whatever response card its payload needs.

import { InvoiceCard } from "./InvoiceCard";
import { InvoiceListPanel } from "./InvoiceListPanel";
import { MissingFieldsForm } from "./MissingFieldsForm";
import { RequestDebugPanel } from "./RequestDebugPanel";
import { RawToggle } from "./RawToggle";
import type { Message, PendingForm } from "../../types";

export function MessageBubble({
  msg,
  pendingForm,
  formSubmitting,
  onToggleRaw,
  onFormChange,
  onFormSubmit,
}: {
  msg: Message;
  pendingForm: PendingForm | null;
  formSubmitting: boolean;
  onToggleRaw: (id: string) => void;
  onFormChange: (field: string, value: string) => void;
  onFormSubmit: () => void;
}) {
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";
  const isError = msg.role === "error";
  const payload = msg.payload;
  const isMissingFieldsMsg = payload?.kind === "missing_fields";

  if (isSystem) {
    return (
      <div className="flex justify-center mb-3">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full border border-border font-mono">{msg.text}</span>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
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
    <div className="flex items-start gap-2 mb-4">
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

        {payload?.kind === "invoice" && (
          <InvoiceCard data={payload.data} raw={payload.raw} showRaw={msg.showRaw ?? false} onToggle={() => onToggleRaw(msg.id)} />
        )}

        {payload?.kind === "invoice_list" && (
          <InvoiceListPanel invoices={payload.invoices} raw={payload.raw} showRaw={msg.showRaw ?? false} onToggle={() => onToggleRaw(msg.id)} />
        )}

        {isMissingFieldsMsg && (() => {
          const isActive = pendingForm?.messageId === msg.id;
          if (isActive && pendingForm) {
            return (
              <MissingFieldsForm
                form={pendingForm}
                onChange={onFormChange}
                onSubmit={onFormSubmit}
                submitting={formSubmitting}
                raw={payload.raw}
                showRaw={msg.showRaw ?? false}
                onToggleRaw={() => onToggleRaw(msg.id)}
              />
            );
          }
          return (
            <div className="mt-3 w-full max-w-sm">
              <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground italic">
                Details submitted ✓
              </div>
              <RawToggle raw={payload.raw} showRaw={msg.showRaw ?? false} onToggle={() => onToggleRaw(msg.id)} />
            </div>
          );
        })()}

        {(payload?.kind === "generic" || payload?.kind === "error_status") && (
          <RawToggle raw={payload.raw} showRaw={msg.showRaw ?? false} onToggle={() => onToggleRaw(msg.id)} />
        )}

        <div className="text-xs text-muted-foreground mt-1 px-1">{time}</div>
      </div>
    </div>
  );
}
