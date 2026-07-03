// ─── Typing indicator ───────────────────────────────────────────────────────
// Shown at the bottom of the conversation while waiting on a response.

export function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-end gap-2 mb-4">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-primary animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-card border border-border px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="typing-dot w-2 h-2 rounded-full bg-muted-foreground" />
            <div className="typing-dot w-2 h-2 rounded-full bg-muted-foreground" />
            <div className="typing-dot w-2 h-2 rounded-full bg-muted-foreground" />
          </div>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </div>
    </div>
  );
}
