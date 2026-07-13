import assert from "node:assert/strict";
import test from "node:test";

import { storedMessageToUi } from "./App";

test("restores persisted chat errors as retryable error messages", () => {
  const message = storedMessageToUi({
    id: "error-1",
    role: "assistant",
    content: "Stream ended without a final response.",
    metadata: {
      status: "error",
      retryable: true,
      message: "Stream ended without a final response.",
      diagnostics: {
        request_id: "request-1",
        trace_id: null,
        model: "Qwen.gguf",
        duration_ms: 14200,
        llm_calls: 2,
        prompt_tokens: 600,
        completion_tokens: 45,
        total_tokens: 645,
        tokens_per_second: 14,
      },
      raw: {
        events: [
          { type: "start", request_id: "request-1" },
          { type: "token", content: "Partial" },
        ],
        error: "Stream ended without a final response.",
      },
    },
    created_at: "2026-07-13T12:00:00Z",
  });

  assert.equal(message.role, "error");
  assert.equal(message.retryable, true);
  assert.equal(message.text, "Stream ended without a final response.");
  assert.equal(message.diagnostics?.request_id, "request-1");
  assert.equal(message.diagnostics?.total_tokens, 645);
  assert.deepEqual(message.payload?.kind === "generic" ? message.payload.raw : null, {
    events: [
      { type: "start", request_id: "request-1" },
      { type: "token", content: "Partial" },
    ],
    error: "Stream ended without a final response.",
  });
});

test("restores backend LLM errors as retryable by default", () => {
  const message = storedMessageToUi({
    id: "error-2",
    role: "assistant",
    content: "AI assistant is temporarily unavailable.",
    metadata: { status: "llm_unavailable" },
  });

  assert.equal(message.role, "error");
  assert.equal(message.retryable, true);
});
