// ─── Settings panel ─────────────────────────────────────────────────────────
// Drops down under the header. Lets the user change or reset the API Base URL
// at any time after the initial setup screen.

import { useState } from "react";
import { DEFAULT_API_BASE } from "../../lib/constants";
import { getApiBase, saveApiBase, resetApiBase } from "../../api/client";

export function SettingsPanel({ onClose, onSave }: { onClose: () => void; onSave: (base: string) => void }) {
  const [value, setValue] = useState(() => getApiBase());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const trimmed = value.trim().replace(/\/$/, "") || DEFAULT_API_BASE;
    saveApiBase(trimmed);
    onSave(trimmed);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 900);
  };

  const handleReset = () => {
    setValue(DEFAULT_API_BASE);
    resetApiBase();
    onSave(DEFAULT_API_BASE);
  };

  const isDefault = value.trim().replace(/\/$/, "") === DEFAULT_API_BASE;

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur-sm shadow-sm">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">Settings</div>
            <div className="text-xs text-muted-foreground">Remembered in your browser — no account needed</div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">API Base URL</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder={DEFAULT_API_BASE}
              className="flex-1 text-sm font-mono bg-muted/50 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            />
            <button
              onClick={handleSave}
              disabled={saved}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-all min-w-[72px]"
            >
              {saved ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </span>
              ) : "Save"}
            </button>
          </div>
          {!isDefault && (
            <button
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset to default ({DEFAULT_API_BASE})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
