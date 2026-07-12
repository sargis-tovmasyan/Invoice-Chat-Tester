import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MarkdownMessage, splitStreamingMarkdown } from "./MarkdownMessage";

test("renders GFM lists, tables, and fenced code", () => {
  const html = renderToStaticMarkup(
    <MarkdownMessage
      tone="assistant"
      content={'**Important**\n\n1. First\n2. Second\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```json\n{"ok":true}\n```'}
    />,
  );

  assert.match(html, /<strong[^>]*>Important<\/strong>/);
  assert.match(html, /<ol/);
  assert.match(html, /<table/);
  assert.match(html, />json<\/div>/);
  assert.match(html, /data-language="json"/);
});

test("does not render raw HTML, images, or unsafe links", () => {
  const html = renderToStaticMarkup(
    <MarkdownMessage tone="assistant" content={'<script>alert(1)</script> ![x](https://example.com/x.png) [bad](javascript:alert(1))'} />,
  );

  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /javascript:/);
});

test("keeps an unfinished streamed fence as plain text", () => {
  assert.deepEqual(splitStreamingMarkdown("Done.\n\n```json\n{\"ok\":"), {
    markdown: "Done.",
    plain: "```json\n{\"ok\":",
  });
});

test("renders a completed streamed fence immediately", () => {
  const content = "```json\n{\"ok\":true}\n```";
  assert.deepEqual(splitStreamingMarkdown(content), { markdown: content, plain: "" });
});
