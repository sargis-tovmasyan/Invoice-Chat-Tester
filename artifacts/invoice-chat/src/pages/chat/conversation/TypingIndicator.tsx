export function TypingIndicator({ label = "Thinking..." }: { label?: string }) {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <div className="flex items-center gap-3">
          <span>{label}</span>
          <span className="flex gap-1">
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          </span>
        </div>
      </div>
    </div>
  );
}
