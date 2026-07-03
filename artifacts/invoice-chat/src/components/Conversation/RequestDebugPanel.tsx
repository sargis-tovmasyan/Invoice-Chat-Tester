// ─── Request debug panel ────────────────────────────────────────────────────
// Small "show request" disclosure under user messages, with copyable JSON
// body and an equivalent cURL command — handy when testing the API.

import { useState } from "react";
import type { RequestInfo } from "../../types";

export function RequestDebugPanel({ info }: { info: RequestInfo }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"json" | "curl" | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const fullUrl = `${origin}${info.endpoint}`;
  const jsonBody = info.body !== undefined ? JSON.stringify(info.body, null, 2) : "";

  const curlCmd = [
    `curl -X ${info.method} '${fullUrl}'`,
    `  -H 'Content-Type: application/json'`,
    info.body !== undefined ? `  -d '${JSON.stringify(info.body)}'` : null,
  ].filter(Boolean).join(" \\\n");

  const copy = async (text: string, kind: "json" | "curl") => {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div className="mt-1.5 flex flex-col items-end">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors font-mono px-2 py-0.5 rounded-full hover:bg-primary/8"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3" />
        </svg>
        {open ? "hide request" : "show request"}
      </button>

      {open && (
        <div className="mt-1.5 w-full max-w-sm rounded-xl border border-border bg-muted/60 overflow-hidden text-left shadow-sm">
          {jsonBody && (
            <div>
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/80">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide font-mono">JSON body</span>
                <button
                  onClick={() => copy(jsonBody, "json")}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied === "json" ? (
                    <><svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span className="text-emerald-500">copied</span></>
                  ) : (
                    <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg><span>copy</span></>
                  )}
                </button>
              </div>
              <pre className="text-[11px] font-mono text-foreground/80 px-3 py-2 overflow-x-auto leading-relaxed">{jsonBody}</pre>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-muted/80">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide font-mono">cURL</span>
              <button
                onClick={() => copy(curlCmd, "curl")}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied === "curl" ? (
                  <><svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span className="text-emerald-500">copied</span></>
                ) : (
                  <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2v1"/></svg><span>copy</span></>
                )}
              </button>
            </div>
            <pre className="text-[11px] font-mono text-foreground/80 px-3 py-2 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">{curlCmd}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
