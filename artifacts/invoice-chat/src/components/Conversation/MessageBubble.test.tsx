import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MessageBubble } from "./MessageBubble";
import type { Message } from "../../types";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("renders a retry action for retryable chat errors", () => {
  const message = {
    id: "error-1",
    role: "error",
    text: "AI assistant is temporarily unavailable.",
    timestamp: Date.now(),
    retryable: true,
  } as Message;

  const html = renderToStaticMarkup(
    <MessageBubble
      msg={message}
      pendingForm={null}
      formSubmitting={false}
      onToggleRaw={() => undefined}
      onFormChange={() => undefined}
      onFormSubmit={() => undefined}
      onRetry={() => undefined}
      retryDisabled={false}
    />,
  );

  assert.match(html, /Try again<\/button>/);
  assert.doesNotMatch(html, /disabled=""/);
});

test("renders compact diagnostics beside the message time", () => {
  const message = {
    id: "answer-1",
    role: "assistant",
    text: "Hello",
    timestamp: new Date("2026-07-13T12:49:00Z").getTime(),
    diagnostics: {
      request_id: "request-1",
      trace_id: "trace-1",
      model: "Qwen.gguf",
      duration_ms: 14200,
      llm_calls: 2,
      prompt_tokens: 600,
      completion_tokens: 45,
      total_tokens: 645,
      tokens_per_second: 14,
    },
  } as Message;

  const html = renderToStaticMarkup(
    <MessageBubble
      msg={message}
      pendingForm={null}
      formSubmitting={false}
      onToggleRaw={() => undefined}
      onFormChange={() => undefined}
      onFormSubmit={() => undefined}
      onRetry={() => undefined}
      retryDisabled={false}
    />,
  );

  assert.match(html, /14\.2s · 14 tok\/s · 645 tokens/);
});
