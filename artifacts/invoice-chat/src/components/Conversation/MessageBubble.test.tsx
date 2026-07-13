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
