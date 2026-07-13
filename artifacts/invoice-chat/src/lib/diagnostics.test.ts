import assert from "node:assert/strict";
import test from "node:test";

import { formatMessageDiagnostics } from "./diagnostics.ts";

test("formats compact message diagnostics", () => {
  assert.equal(
    formatMessageDiagnostics({
      request_id: "request-1",
      trace_id: "trace-1",
      model: "Qwen.gguf",
      duration_ms: 14200,
      llm_calls: 2,
      prompt_tokens: 600,
      completion_tokens: 45,
      total_tokens: 645,
      tokens_per_second: 14,
    }),
    "14.2s · 14 tok/s · 645 tokens",
  );
});

test("formats long durations and omits unavailable metrics", () => {
  assert.equal(
    formatMessageDiagnostics({
      request_id: "request-1",
      trace_id: null,
      model: null,
      duration_ms: 134000,
      llm_calls: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      tokens_per_second: null,
    }),
    "2m 14s",
  );
});
