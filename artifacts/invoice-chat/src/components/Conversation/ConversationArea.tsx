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
        {messages.length === 0 && !loading && (
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

        {loading && <TypingIndicator label={loadingLabel} />}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}
