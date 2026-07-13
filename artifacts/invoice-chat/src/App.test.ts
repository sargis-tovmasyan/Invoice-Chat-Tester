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
    },
    created_at: "2026-07-13T12:00:00Z",
  });

  assert.equal(message.role, "error");
  assert.equal(message.retryable, true);
  assert.equal(message.text, "Stream ended without a final response.");
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
