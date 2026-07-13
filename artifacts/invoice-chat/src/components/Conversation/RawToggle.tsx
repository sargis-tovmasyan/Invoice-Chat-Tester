// ─── Raw JSON toggle ────────────────────────────────────────────────────────
// Small "show/hide raw JSON" disclosure used under most response cards, handy
// for debugging what the backend actually returned.

export function RawToggle({ raw, showRaw, onToggle }: { raw: unknown; showRaw: boolean; onToggle: () => void }) {
  if (import.meta.env?.DEV !== true && import.meta.env?.VITE_SHOW_RAW_JSON !== "true") return null;

  return (
    <div className="mt-2">
      <button onClick={onToggle} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <svg className={`w-3 h-3 transition-transform ${showRaw ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {showRaw ? "Hide" : "Show"} raw JSON
      </button>
      {showRaw && (
        <div className="mt-1.5 rounded-lg border border-border bg-muted p-3 overflow-auto max-h-60">
          <pre className="font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-all">
            {JSON.stringify(raw, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
