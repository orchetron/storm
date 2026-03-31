/**
 * MessageBubble widget tests.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderForTest } from "../testing/index.js";
import { MessageBubble } from "../widgets/MessageBubble.js";

describe("MessageBubble", () => {
  it("renders user role with > symbol", () => {
    const result = renderForTest(
      React.createElement(MessageBubble, { role: "user" }, "Hello world"),
      { width: 60, height: 10 },
    );
    expect(result.hasText(">")).toBe(true);
    expect(result.hasText("Hello world")).toBe(true);
  });

  it("renders assistant role with star symbol", () => {
    const result = renderForTest(
      React.createElement(MessageBubble, { role: "assistant" }, "Response"),
      { width: 60, height: 10 },
    );
    expect(result.hasText("\u2726")).toBe(true); // ✦
    expect(result.hasText("Response")).toBe(true);
  });

  it("renders system role with filled circle symbol", () => {
    const result = renderForTest(
      React.createElement(MessageBubble, { role: "system" }, "System msg"),
      { width: 60, height: 10 },
    );
    expect(result.hasText("\u25CF")).toBe(true); // ●
    expect(result.hasText("System msg")).toBe(true);
  });

  it("renders markdown content when markdown=true", () => {
    const result = renderForTest(
      React.createElement(MessageBubble, { role: "assistant", markdown: true }, "**bold text**"),
      { width: 60, height: 10 },
    );
    expect(result.hasText("bold text")).toBe(true);
  });

  it("renders meta and timestamp", () => {
    const result = renderForTest(
      React.createElement(MessageBubble, { role: "user", meta: "500 tokens", timestamp: "12:30" }, "Content"),
      { width: 60, height: 10 },
    );
    expect(result.hasText("500 tokens")).toBe(true);
    expect(result.hasText("12:30")).toBe(true);
  });

  it("renders action hints", () => {
    const actions = [
      { label: "Copy", key: "c", onAction: () => {} },
      { label: "Retry", key: "r", onAction: () => {} },
    ];
    const result = renderForTest(
      React.createElement(MessageBubble, { role: "assistant", actions }, "Msg"),
      { width: 60, height: 10 },
    );
    expect(result.hasText("[c] Copy")).toBe(true);
    expect(result.hasText("[r] Retry")).toBe(true);
  });
});
