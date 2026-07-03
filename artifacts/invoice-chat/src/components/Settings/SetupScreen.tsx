// ─── First-run screen ───────────────────────────────────────────────────────
// Shown only once, before any API Base URL has been saved. Blocks the chat
// UI until the user confirms/edits the URL.

import { useState } from "react";
import { DEFAULT_API_BASE } from "../../lib/constants";
import { saveApiBase } from "../../api/client";

export function SetupScreen({ onDone }: { onDone: (base: string) => void }) {
  const [value, setValue] = useState(DEFAULT_API_BASE);
  const [error, setError] = useState("");

  const handleStart = () => {
    const trimmed = value.trim().replace(/\/$/, "");
    if (!trimmed) { setError("Please enter a URL."); return; }
    try { new URL(trimmed); } catch { setError("Please enter a valid URL (e.g. http://…)."); return; }
    saveApiBase(trimmed);
    onDone(trimmed);
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>

        <h1 className="text-xl font-bold text-center mb-1">Welcome to Document AI Tester</h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          Before you start, tell us where your API lives. You can change this any time from Settings.
        </p>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              API Base URL
            </label>
            <input
              type="url"
              value={value}
              autoFocus
              onChange={(e) => { setValue(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="http://your-server:8000"
              className="w-full text-sm font-mono bg-muted/50 border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              Saved in your browser — no account or database needed.
            </p>
          </div>

          <button
            onClick={handleStart}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Get Started →
          </button>
        </div>
      </div>
    </div>
  );
}
