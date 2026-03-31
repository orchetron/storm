/**
 * StreamingText widget tests.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderForTest } from "../testing/index.js";
import { StreamingText } from "../widgets/StreamingText.js";

describe("StreamingText", () => {
  it("renders text content", () => {
    const result = renderForTest(
      React.createElement(StreamingText, { text: "Hello world" }),
      { width: 40, height: 5 },
    );
    expect(result.hasText("Hello world")).toBe(true);
  });

  it("shows cursor when streaming=true", () => {
    const result = renderForTest(
      React.createElement(StreamingText, { text: "Loading", streaming: true, cursor: true }),
      { width: 40, height: 5 },
    );
    expect(result.hasText("Loading")).toBe(true);
    expect(result.hasText("\u258A")).toBe(true); // ▊ cursor char
  });

  it("hides cursor when streaming=false", () => {
    const result = renderForTest(
      React.createElement(StreamingText, { text: "Done", streaming: false, cursor: true }),
      { width: 40, height: 5 },
    );
    expect(result.hasText("Done")).toBe(true);
    expect(result.hasText("\u258A")).toBe(false);
  });

  it("animate mode starts with partial text", () => {
    const result = renderForTest(
      React.createElement(StreamingText, { text: "Long message here", animate: true, speed: 2 }),
      { width: 40, height: 5 },
    );
    // With animate=true, revealedRef starts at 0, so no text is shown initially
    expect(result.hasText("Long message here")).toBe(false);
  });

  it("uses custom cursor character", () => {
    const result = renderForTest(
      React.createElement(StreamingText, { text: "Hi", streaming: true, cursor: true, cursorCharacter: "_" }),
      { width: 40, height: 5 },
    );
    expect(result.hasText("Hi")).toBe(true);
    expect(result.hasText("_")).toBe(true);
  });
});
