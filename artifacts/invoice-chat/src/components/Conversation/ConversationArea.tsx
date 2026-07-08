// ─── Conversation area ──────────────────────────────────────────────────────
// The main scrollable panel: empty state with example prompts, the message
// list, and the typing indicator while a request is in flight.

import { useEffect, useRef } from "react";
import { EXAMPLE_PROMPTS } from "../../lib/constants";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import type { Message, PendingForm } from "../../types";

export function ConversationArea({
  messages,
  loadingSession,
  loading,
  loadingLabel,
  pendingForm,
  formSubmitting,
  onSendExample,
  onToggleRaw,
  onFormChange,
  onFormSubmit,
}: {
  messages: Message[];
  loadingSession: boolean;
  loading: boolean;
  loadingLabel: string;
  pendingForm: PendingForm | null;
  formSubmitting: boolean;
  onSendExample: (preset: string) => void;
  onToggleRaw: (id: string) => void;
  onFormChange: (field: string, value: string) => void;
  onFormSubmit: () => void;
}) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, pendingForm]);

  return (
    <div className="flex-1 overflow-y-auto chat-scroll">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Empty state */}
        {loadingSession && <ChatHistoryLoading />}

        {messages.length === 0 && !loading && !loadingSession && (
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
                <button key={i} onClick={() => onSendExample(p)}
                  className="w-full text-left text-sm px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/30 transition-all leading-snug">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            pendingForm={pendingForm}
            formSubmitting={formSubmitting}
            onToggleRaw={onToggleRaw}
            onFormChange={onFormChange}
            onFormSubmit={onFormSubmit}
          />
        ))}

        {loading && !loadingSession && <TypingIndicator label={loadingLabel} />}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}

function ChatHistoryLoading() {
  return (
    <div className="space-y-5 py-2" aria-label="Loading chat messages">
      <div className="flex justify-end">
        <div className="w-48 rounded-2xl bg-muted/70 p-3">
          <div className="h-4 w-32 rounded bg-muted-foreground/15" />
        </div>
      </div>

      <div className="flex gap-3">
        <div className="mt-1 h-8 w-8 flex-shrink-0 rounded-full bg-primary/10" />
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 h-4 w-40 rounded bg-muted" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-5/6 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="w-56 rounded-2xl bg-muted/70 p-3">
          <div className="h-4 w-44 rounded bg-muted-foreground/15" />
        </div>
      </div>
    </div>
  );
}
