// ─── Header ──────────────────────────────────────────────────────────────────
// Top bar: app title + current API base, quick Health/Invoices actions,
// Clear chat, and the Settings toggle.

import type { PendingForm } from "../../types";

export function Header({
  apiBase,
  pendingForm,
  hasMessages,
  isBlocked,
  settingsOpen,
  onRunHealth,
  onRunInvoices,
  onClearChat,
  onToggleSettings,
  onToggleSidebar,
}: {
  apiBase: string;
  pendingForm: PendingForm | null;
  hasMessages: boolean;
  isBlocked: boolean;
  settingsOpen: boolean;
  onRunHealth: () => void;
  onRunInvoices: () => void;
  onClearChat: () => void;
  onToggleSettings: () => void;
  onToggleSidebar: () => void;
}) {
  return (
    <header className="flex-shrink-0 border-b border-border bg-card shadow-sm z-10">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onToggleSidebar}
            title="Toggle chats"
            className="sm:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">Document AI Tester</div>
            <div className="text-xs text-muted-foreground leading-tight truncate hidden sm:block font-mono">
              {pendingForm && !pendingForm.submitted
                ? `⚠ Fill in: ${pendingForm.missingFields.join(", ")}`
                : `→ ${apiBase}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onRunHealth}
            disabled={isBlocked}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-secondary hover:bg-accent transition-colors disabled:opacity-40">
            Health
          </button>
          <button onClick={onRunInvoices}
            disabled={isBlocked}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-secondary hover:bg-accent transition-colors disabled:opacity-40">
            Invoices
          </button>
          {hasMessages && (
            <button onClick={onClearChat}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors">
              Clear
            </button>
          )}
          <button
            onClick={onToggleSettings}
            title="Settings"
            className={`w-8 h-8 rounded-lg flex items-center justify-center border border-border transition-colors ${settingsOpen ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
