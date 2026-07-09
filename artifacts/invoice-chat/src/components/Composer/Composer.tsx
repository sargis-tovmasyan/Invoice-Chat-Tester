// ─── Composer ────────────────────────────────────────────────────────────────
// The bottom text box: example chips, the pending-form notice, the textarea,
// and the send button.

import { EXAMPLE_PROMPTS } from "../../lib/constants";

export function Composer({
  input,
  onInputChange,
  onSend,
  loading,
  isBlocked,
  hasPendingForm,
  hasMessages,
  thinkingEnabled,
  onThinkingChange,
  textareaRef,
}: {
  input: string;
  onInputChange: (value: string) => void;
  onSend: (preset?: string) => void;
  loading: boolean;
  isBlocked: boolean;
  hasPendingForm: boolean;
  hasMessages: boolean;
  thinkingEnabled: boolean;
  onThinkingChange: (value: boolean) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex-shrink-0 border-t border-border bg-card">
      <div className="max-w-3xl mx-auto px-4 pt-3 pb-3">
        {/* Example chips */}
        {hasMessages && !isBlocked && (
          <div className="flex gap-2 mb-2.5 overflow-x-auto scrollbar-none pb-0.5">
            <span className="text-xs text-muted-foreground flex-shrink-0 self-center">Try:</span>
            {EXAMPLE_PROMPTS.map((p, i) => (
              <button key={i} onClick={() => onSend(p)}
                className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full border border-border bg-secondary text-secondary-foreground hover:bg-accent hover:border-primary/30 transition-all">
                {p.length > 38 ? p.slice(0, 38) + "…" : p}
              </button>
            ))}
          </div>
        )}

        {/* Pending form notice */}
        {hasPendingForm && (
          <div className="mb-2 flex items-center gap-1.5 text-xs text-amber-700">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Fill in the form above before sending a new message.
          </div>
        )}

        <label className="mb-2 flex w-fit items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={thinkingEnabled}
            onChange={(event) => onThinkingChange(event.target.checked)}
            disabled={isBlocked}
            className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-ring disabled:opacity-50"
          />
          Thinking
        </label>

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              onInputChange(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder={hasPendingForm ? "Complete the form above first…" : "Describe the invoice you want to create…"}
            disabled={isBlocked}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 leading-relaxed"
            style={{ minHeight: "42px", maxHeight: "160px" }}
          />
          <button
            onClick={() => onSend()}
            disabled={!input.trim() || isBlocked}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-35 disabled:cursor-not-allowed transition-opacity"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 text-center">
          Enter to send · All calls route through the HTTPS proxy
        </p>
      </div>
    </div>
  );
}
