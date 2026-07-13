import type { ChatDiagnostics } from "../types";

export function formatMessageDiagnostics(diagnostics: ChatDiagnostics): string {
  const parts = [formatDuration(diagnostics.duration_ms)];

  if (diagnostics.tokens_per_second !== null && diagnostics.tokens_per_second > 0) {
    parts.push(`${formatDecimal(diagnostics.tokens_per_second)} tok/s`);
  }
  if (diagnostics.total_tokens > 0) {
    parts.push(`${Math.round(diagnostics.total_tokens).toLocaleString("en-US")} tokens`);
  }

  return parts.join(" · ");
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  if (durationMs < 60000) return `${formatDecimal(durationMs / 1000)}s`;

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function formatDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
