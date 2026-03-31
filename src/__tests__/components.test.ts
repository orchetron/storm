/**
 * Component rendering tests for Storm TUI.
 *
 * Uses renderForTest from the testing utility to render components
 * into a virtual buffer and assert on the plain-text output.
 */

import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { renderForTest, expectOutput } from "../testing/index.js";
import { Card } from "../components/Card.js";
import { Alert } from "../components/Alert.js";
import { Heading } from "../components/Heading.js";
import { Paragraph } from "../components/Paragraph.js";
import { ProgressBar } from "../components/ProgressBar.js";
import { Divider } from "../components/Divider.js";
import { Separator } from "../components/Separator.js";
import { Badge } from "../components/Badge.js";
import { Tabs } from "../components/Tabs.js";
import { Tag } from "../components/Tag.js";
import { Spacer } from "../components/Spacer.js";
import { Newline } from "../components/Newline.js";
import { Button } from "../components/Button.js";
import { Spinner } from "../components/Spinner.js";
import { Switch } from "../components/Switch.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { Link } from "../components/Link.js";
import { Footer } from "../components/Footer.js";
import { GradientProgress } from "../components/GradientProgress.js";
import { DefinitionList } from "../components/DefinitionList.js";
import { Tooltip } from "../components/Tooltip.js";
import { Avatar } from "../components/Avatar.js";
import { Sparkline } from "../components/Sparkline.js";
import { Table } from "../components/Table.js";

// ── Card ──────────────────────────────────────────────────────────────

describe("Card", () => {
  it("renders with title", () => {
    const result = renderForTest(
      React.createElement(Card, { title: "My Card", children: null },
        React.createElement("tui-text", null, "Body content"),
      ),
      { width: 40, height: 10 },
    );
    expect(result.hasText("My Card")).toBe(true);
    expect(result.hasText("Body content")).toBe(true);
  });

  it("renders without title", () => {
    const result = renderForTest(
      React.createElement(Card, { children: null },
        React.createElement("tui-text", null, "Just body"),
      ),
      { width: 40, height: 10 },
    );
    expect(result.hasText("Just body")).toBe(true);
  });

  it("renders with icon and title", () => {
    const result = renderForTest(
      React.createElement(Card, { title: "Settings", icon: "\u2699", children: null },
        React.createElement("tui-text", null, "Content"),
      ),
      { width: 40, height: 10 },
    );
    expect(result.hasText("\u2699")).toBe(true);
    expect(result.hasText("Settings")).toBe(true);
  });

  it("applies variant without crashing", () => {
    for (const variant of ["default", "storm", "success", "error", "warning"] as const) {
      const result = renderForTest(
        React.createElement(Card, { title: "V", variant, children: null },
          React.createElement("tui-text", null, "ok"),
        ),
        { width: 40, height: 10 },
      );
      expect(result.hasText("ok")).toBe(true);
    }
  });

  it("renders focused state without errors", () => {
    const result = renderForTest(
      React.createElement(Card, { title: "Focused", focused: true, children: null },
        React.createElement("tui-text", null, "focused body"),
      ),
      { width: 40, height: 10 },
    );
    expect(result.hasText("focused body")).toBe(true);
  });

  it("renders children as-is", () => {
    const result = renderForTest(
      React.createElement(Card, { children: null },
        React.createElement("tui-text", null, "Alpha"),
        React.createElement("tui-text", null, "Beta"),
      ),
      { width: 40, height: 10 },
    );
    expect(result.hasText("Alpha")).toBe(true);
    expect(result.hasText("Beta")).toBe(true);
  });

  it("accepts style overrides", () => {
    // Should not crash when extra layout props are passed
    const result = renderForTest(
      React.createElement(Card, { title: "Styled", marginTop: 1, paddingLeft: 3 } as any,
        React.createElement("tui-text", null, "styled"),
      ),
      { width: 40, height: 12 },
    );
    expect(result.hasText("styled")).toBe(true);
  });

  it("has a border in output (round style default)", () => {
    const result = renderForTest(
      React.createElement(Card, { title: "Bordered", children: null },
        React.createElement("tui-text", null, "inner"),
      ),
      { width: 40, height: 10 },
    );
    // Round borders use characters like ╭╮╰╯
    const borderChars = ["\u256D", "\u256E", "\u2570", "\u256F"];
    const hasBorder = borderChars.some((c) => result.output.includes(c));
    expect(hasBorder).toBe(true);
  });
});

// ── Alert ─────────────────────────────────────────────────────────────

describe("Alert", () => {
  it("renders info alert by default", () => {
    const result = renderForTest(
      React.createElement(Alert, { children: null },
        React.createElement("tui-text", null, "Info message"),
      ),
      { width: 50, height: 8 },
    );
    expect(result.hasText("Info message")).toBe(true);
  });

  it("renders with title", () => {
    const result = renderForTest(
      React.createElement(Alert, { title: "Warning!", type: "warning", children: null },
        React.createElement("tui-text", null, "Be careful"),
      ),
      { width: 50, height: 8 },
    );
    expect(result.hasText("Warning!")).toBe(true);
    expect(result.hasText("Be careful")).toBe(true);
  });

  it("renders all alert types without errors", () => {
    for (const type of ["success", "warning", "error", "info"] as const) {
      const result = renderForTest(
        React.createElement(Alert, { type, children: null },
          React.createElement("tui-text", null, `${type} alert`),
        ),
        { width: 50, height: 8 },
      );
      expect(result.hasText(`${type} alert`)).toBe(true);
    }
  });

  it("renders without title", () => {
    const result = renderForTest(
      React.createElement(Alert, { type: "error", children: null },
        React.createElement("tui-text", null, "Error body only"),
      ),
      { width: 50, height: 8 },
    );
    expect(result.hasText("Error body only")).toBe(true);
  });

  it("has bordered output", () => {
    const result = renderForTest(
      React.createElement(Alert, { children: null },
        React.createElement("tui-text", null, "inside"),
      ),
      { width: 50, height: 8 },
    );
    const borderChars = ["\u256D", "\u256E", "\u2570", "\u256F"];
    const hasBorder = borderChars.some((c) => result.output.includes(c));
    expect(hasBorder).toBe(true);
  });
});

// ── Heading ───────────────────────────────────────────────────────────

describe("Heading", () => {
  it("renders H1 in uppercase", () => {
    const result = renderForTest(
      React.createElement(Heading, { level: 1, children: "" }, "hello world"),
      { width: 40, height: 5 },
    );
    expect(result.hasText("HELLO WORLD")).toBe(true);
  });

  it("renders H1 with underline decoration", () => {
    const result = renderForTest(
      React.createElement(Heading, { level: 1, children: "" }, "Title"),
      { width: 40, height: 5 },
    );
    // H1 uses ─ underline decoration
    expect(result.output.includes("\u2500")).toBe(true);
  });

  it("renders H2 (default level)", () => {
    const result = renderForTest(
      React.createElement(Heading, { children: "" }, "Default Heading"),
      { width: 40, height: 5 },
    );
    expect(result.hasText("Default Heading")).toBe(true);
  });

  it("renders H2 without uppercase transform", () => {
    const result = renderForTest(
      React.createElement(Heading, { level: 2, children: "" }, "Mixed Case"),
      { width: 40, height: 5 },
    );
    expect(result.hasText("Mixed Case")).toBe(true);
  });

  it("renders H3", () => {
    const result = renderForTest(
      React.createElement(Heading, { level: 3, children: "" }, "subheading"),
      { width: 40, height: 5 },
    );
    expect(result.hasText("subheading")).toBe(true);
  });

  it("renders H4", () => {
    const result = renderForTest(
      React.createElement(Heading, { level: 4, children: "" }, "small heading"),
      { width: 40, height: 5 },
    );
    expect(result.hasText("small heading")).toBe(true);
  });

  it("H2 does not have underline decoration", () => {
    const result = renderForTest(
      React.createElement(Heading, { level: 2, children: "" }, "No underline"),
      { width: 40, height: 3 },
    );
    // H2 should not have a full row of ─ characters
    const lines = result.lines;
    const decorLine = lines.find((l) => l.length > 3 && [...l].every((c) => c === "\u2500"));
    expect(decorLine).toBeUndefined();
  });

  it("accepts color override", () => {
    const result = renderForTest(
      React.createElement(Heading, { level: 2, color: "#FF0000", children: "" }, "Red Heading"),
      { width: 40, height: 5 },
    );
    expect(result.hasText("Red Heading")).toBe(true);
  });
});

// ── Paragraph ─────────────────────────────────────────────────────────

describe("Paragraph", () => {
  it("renders text content", () => {
    const result = renderForTest(
      React.createElement(Paragraph, { children: null }, "Lorem ipsum dolor sit amet."),
      { width: 60, height: 5 },
    );
    expect(result.hasText("Lorem ipsum")).toBe(true);
  });

  it("renders with default margin bottom", () => {
    // Two paragraphs: the first should have a gap (marginBottom=1)
    const result = renderForTest(
      React.createElement("tui-box", { flexDirection: "column" },
        React.createElement(Paragraph, { children: null }, "First"),
        React.createElement(Paragraph, { children: null }, "Second"),
      ),
      { width: 40, height: 10 },
    );
    expect(result.hasText("First")).toBe(true);
    expect(result.hasText("Second")).toBe(true);
  });

  it("renders with custom marginBottom", () => {
    const result = renderForTest(
      React.createElement(Paragraph, { marginBottom: 3, children: null }, "Spaced out"),
      { width: 40, height: 8 },
    );
    expect(result.hasText("Spaced out")).toBe(true);
  });

  it("renders with bold text", () => {
    const result = renderForTest(
      React.createElement(Paragraph, { bold: true, children: null }, "Bold text"),
      { width: 40, height: 5 },
    );
    expect(result.hasText("Bold text")).toBe(true);
  });

  it("renders with dim text", () => {
    const result = renderForTest(
      React.createElement(Paragraph, { dim: true, children: null }, "Dim text"),
      { width: 40, height: 5 },
    );
    expect(result.hasText("Dim text")).toBe(true);
  });

  it("renders with color", () => {
    const result = renderForTest(
      React.createElement(Paragraph, { color: "#FF0000", children: null }, "Colored"),
      { width: 40, height: 5 },
    );
    expect(result.hasText("Colored")).toBe(true);
  });
});

// ── Badge ─────────────────────────────────────────────────────────────

describe("Badge", () => {
  it("renders label with indicator", () => {
    const result = renderForTest(
      React.createElement(Badge, { label: "NEW" }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("(NEW)")).toBe(true);
  });

  it("renders with default variant", () => {
    const result = renderForTest(
      React.createElement(Badge, { label: "Default" }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("(Default)")).toBe(true);
  });

  it("renders all variants without errors", () => {
    for (const variant of ["default", "success", "warning", "error", "info"] as const) {
      const result = renderForTest(
        React.createElement(Badge, { label: variant, variant }),
        { width: 30, height: 3 },
      );
      // non-default variants use dot prefix, default uses parens
      if (variant === "default") {
        expect(result.hasText(`(${variant})`)).toBe(true);
      } else {
        expect(result.hasText(variant)).toBe(true);
      }
    }
  });

  it("renders with custom color", () => {
    const result = renderForTest(
      React.createElement(Badge, { label: "Custom", color: "#FF00FF" }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("Custom")).toBe(true);
  });

  it("renders with dim prop", () => {
    const result = renderForTest(
      React.createElement(Badge, { label: "Dim", dim: true }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("Dim")).toBe(true);
  });

  it("renders with bold override", () => {
    const result = renderForTest(
      React.createElement(Badge, { label: "Bold", bold: true }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("Bold")).toBe(true);
  });
});

// ── ProgressBar ───────────────────────────────────────────────────────

describe("ProgressBar", () => {
  it("renders 0% as all empty", () => {
    const result = renderForTest(
      React.createElement(ProgressBar, { value: 0, width: 10 }),
      { width: 30, height: 3 },
    );
    // Should have empty chars but no filled
    const filled = result.output.match(/\u2588/g);
    expect(filled).toBeNull();
  });

  it("renders 100% as all filled", () => {
    const result = renderForTest(
      React.createElement(ProgressBar, { value: 100, width: 10 }),
      { width: 30, height: 3 },
    );
    const filledCount = (result.output.match(/\u2588/g) || []).length;
    expect(filledCount).toBe(10);
  });

  it("renders 50% with approximately half filled", () => {
    const result = renderForTest(
      React.createElement(ProgressBar, { value: 50, width: 10 }),
      { width: 30, height: 3 },
    );
    const filledCount = (result.output.match(/\u2588/g) || []).length;
    expect(filledCount).toBe(5);
  });

  it("shows percentage when showPercent is true", () => {
    const result = renderForTest(
      React.createElement(ProgressBar, { value: 45, width: 10, showPercent: true }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("45%")).toBe(true);
  });

  it("does not show percentage by default", () => {
    const result = renderForTest(
      React.createElement(ProgressBar, { value: 45, width: 10 }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("45%")).toBe(false);
  });

  it("renders with label", () => {
    const result = renderForTest(
      React.createElement(ProgressBar, { value: 30, width: 10, label: "Loading" }),
      { width: 40, height: 3 },
    );
    expect(result.hasText("Loading")).toBe(true);
  });

  it("clamps value above 100", () => {
    const result = renderForTest(
      React.createElement(ProgressBar, { value: 150, width: 10, showPercent: true }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("100%")).toBe(true);
  });

  it("clamps value below 0", () => {
    const result = renderForTest(
      React.createElement(ProgressBar, { value: -10, width: 10, showPercent: true }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("0%")).toBe(true);
  });
});

// ── Divider ───────────────────────────────────────────────────────────

describe("Divider", () => {
  it("renders solid line by default", () => {
    const result = renderForTest(
      React.createElement(Divider, {}),
      { width: 40, height: 3 },
    );
    expect(result.output.includes("\u2500")).toBe(true);
  });

  it("renders dotted style", () => {
    const result = renderForTest(
      React.createElement(Divider, { style: "dotted" }),
      { width: 40, height: 3 },
    );
    expect(result.output.includes("\u254C")).toBe(true);
  });

  it("renders dashed style", () => {
    const result = renderForTest(
      React.createElement(Divider, { style: "dashed" }),
      { width: 40, height: 3 },
    );
    expect(result.output.includes("\u2504")).toBe(true);
  });

  it("respects width prop", () => {
    const result = renderForTest(
      React.createElement(Divider, { width: 5 }),
      { width: 10, height: 3 },
    );
    // The divider should render within the visible area
    expect(result.output.length).toBeGreaterThan(0);
  });
});

// ── Separator ─────────────────────────────────────────────────────────

describe("Separator", () => {
  it("renders line style by default", () => {
    const result = renderForTest(
      React.createElement(Separator, {}),
      { width: 40, height: 3 },
    );
    expect(result.output.includes("\u2500")).toBe(true);
  });

  it("renders dashed style", () => {
    const result = renderForTest(
      React.createElement(Separator, { style: "dashed" }),
      { width: 40, height: 3 },
    );
    expect(result.output.includes("\u2504")).toBe(true);
  });

  it("renders dotted style", () => {
    const result = renderForTest(
      React.createElement(Separator, { style: "dotted" }),
      { width: 40, height: 3 },
    );
    expect(result.output.includes("\u254C")).toBe(true);
  });

  it("renders storm style", () => {
    const result = renderForTest(
      React.createElement(Separator, { style: "storm" }),
      { width: 40, height: 3 },
    );
    expect(result.output.includes("\u2501")).toBe(true);
  });

  it("renders with label", () => {
    const result = renderForTest(
      React.createElement(Separator, { label: "Section" }),
      { width: 40, height: 3 },
    );
    expect(result.hasText("Section")).toBe(true);
  });

  it("renders without label", () => {
    const result = renderForTest(
      React.createElement(Separator, {}),
      { width: 40, height: 3 },
    );
    expect(result.output.length).toBeGreaterThan(0);
  });
});

// ── Tabs ──────────────────────────────────────────────────────────────

describe("Tabs", () => {
  const tabs = [
    { key: "a", label: "Alpha" },
    { key: "b", label: "Beta" },
    { key: "c", label: "Gamma" },
  ];

  it("renders all tab labels", () => {
    const result = renderForTest(
      React.createElement(Tabs, { tabs, activeKey: "a" }),
      { width: 60, height: 3 },
    );
    expect(result.hasText("Alpha")).toBe(true);
    expect(result.hasText("Beta")).toBe(true);
    expect(result.hasText("Gamma")).toBe(true);
  });

  it("renders tabs in bracket format", () => {
    const result = renderForTest(
      React.createElement(Tabs, { tabs, activeKey: "a" }),
      { width: 60, height: 3 },
    );
    expect(result.hasText("[ Alpha ]")).toBe(true);
    expect(result.hasText("[ Beta ]")).toBe(true);
  });

  it("renders with different active key", () => {
    const result = renderForTest(
      React.createElement(Tabs, { tabs, activeKey: "b" }),
      { width: 60, height: 3 },
    );
    // Both keys render, just with different styles
    expect(result.hasText("[ Beta ]")).toBe(true);
  });

  it("renders single tab", () => {
    const result = renderForTest(
      React.createElement(Tabs, { tabs: [{ key: "x", label: "Only" }], activeKey: "x" }),
      { width: 40, height: 3 },
    );
    expect(result.hasText("[ Only ]")).toBe(true);
  });

  it("renders empty tabs array without crashing", () => {
    const result = renderForTest(
      React.createElement(Tabs, { tabs: [], activeKey: "" }),
      { width: 40, height: 3 },
    );
    expect(result).toBeDefined();
  });
});

// ── Tag ───────────────────────────────────────────────────────────────

describe("Tag", () => {
  it("renders filled variant by default (no brackets)", () => {
    const result = renderForTest(
      React.createElement(Tag, { label: "Featured" }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("Featured")).toBe(true);
    // Filled does not add brackets
    expect(result.hasText("[Featured]")).toBe(false);
  });

  it("renders outlined variant with brackets", () => {
    const result = renderForTest(
      React.createElement(Tag, { label: "Outlined", variant: "outlined" }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("[Outlined]")).toBe(true);
  });

  it("shows remove indicator when onRemove is provided", () => {
    const result = renderForTest(
      React.createElement(Tag, { label: "Remove", onRemove: () => {} }),
      { width: 30, height: 3 },
    );
    // Shows multiply sign (x)
    expect(result.output.includes("\u00D7")).toBe(true);
  });

  it("does not show remove indicator when onRemove is absent", () => {
    const result = renderForTest(
      React.createElement(Tag, { label: "NoRemove" }),
      { width: 30, height: 3 },
    );
    expect(result.output.includes("\u00D7")).toBe(false);
  });
});

// ── Button ────────────────────────────────────────────────────────────

describe("Button", () => {
  it("renders label in brackets", () => {
    const result = renderForTest(
      React.createElement(Button, { label: "Submit" }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("[ Submit ]")).toBe(true);
  });

  it("renders disabled state", () => {
    const result = renderForTest(
      React.createElement(Button, { label: "Disabled", disabled: true }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("[ Disabled ]")).toBe(true);
  });

  it("renders loading state with spinner frame", () => {
    const result = renderForTest(
      React.createElement(Button, { label: "Loading", loading: true }),
      { width: 30, height: 3 },
    );
    // Should contain the label
    expect(result.hasText("Loading")).toBe(true);
    // The first spinner frame is the braille character
    expect(result.output.includes("\u280B")).toBe(true);
  });

  it("renders with custom label", () => {
    const result = renderForTest(
      React.createElement(Button, { label: "Cancel" }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("[ Cancel ]")).toBe(true);
  });

  it("renders focused state", () => {
    const result = renderForTest(
      React.createElement(Button, { label: "Focus", isFocused: true }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("Focus")).toBe(true);
  });

  it("renders unfocused state", () => {
    const result = renderForTest(
      React.createElement(Button, { label: "Blur", isFocused: false }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("Blur")).toBe(true);
  });
});

// ── Spinner ───────────────────────────────────────────────────────────

describe("Spinner", () => {
  it("renders diamond type by default", () => {
    const result = renderForTest(
      React.createElement(Spinner, {}),
      { width: 20, height: 3 },
    );
    // First frame of diamond is "◇"
    expect(result.output.includes("\u25C7")).toBe(true);
    result.unmount();
  });

  it("renders with label", () => {
    const result = renderForTest(
      React.createElement(Spinner, { label: "Loading..." }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("Loading...")).toBe(true);
    result.unmount();
  });

  it("renders line type", () => {
    const result = renderForTest(
      React.createElement(Spinner, { type: "line" }),
      { width: 20, height: 3 },
    );
    // First frame of line is "-"
    expect(result.output.includes("-")).toBe(true);
    result.unmount();
  });

  it("renders arc type", () => {
    const result = renderForTest(
      React.createElement(Spinner, { type: "arc" }),
      { width: 20, height: 3 },
    );
    expect(result.output.includes("\u25DC")).toBe(true);
    result.unmount();
  });

  it("renders storm type", () => {
    const result = renderForTest(
      React.createElement(Spinner, { type: "storm" }),
      { width: 20, height: 3 },
    );
    // Storm first frame is block characters
    expect(result.output.includes("\u2591")).toBe(true);
    result.unmount();
  });
});

// ── Switch ────────────────────────────────────────────────────────────

describe("Switch", () => {
  it("renders checked state with ON label", () => {
    const result = renderForTest(
      React.createElement(Switch, { checked: true }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("ON")).toBe(true);
  });

  it("renders unchecked state with OFF label", () => {
    const result = renderForTest(
      React.createElement(Switch, { checked: false }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("OFF")).toBe(true);
  });

  it("renders with custom on/off labels", () => {
    const result = renderForTest(
      React.createElement(Switch, { checked: true, onLabel: "YES", offLabel: "NO" }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("YES")).toBe(true);
  });

  it("renders with label prop", () => {
    const result = renderForTest(
      React.createElement(Switch, { checked: false, label: "Dark Mode" }),
      { width: 40, height: 3 },
    );
    expect(result.hasText("Dark Mode")).toBe(true);
  });

  it("renders track with dot indicator", () => {
    const result = renderForTest(
      React.createElement(Switch, { checked: true }),
      { width: 30, height: 3 },
    );
    // Should have the dot ● character
    expect(result.output.includes("\u25CF")).toBe(true);
  });

  it("renders track characters", () => {
    const result = renderForTest(
      React.createElement(Switch, { checked: false }),
      { width: 30, height: 3 },
    );
    // Should have the track ━ character
    expect(result.output.includes("\u2501")).toBe(true);
  });
});

// ── Breadcrumb ────────────────────────────────────────────────────────

describe("Breadcrumb", () => {
  it("renders all items", () => {
    const result = renderForTest(
      React.createElement(Breadcrumb, { items: ["Home", "Products", "Shoes"] }),
      { width: 50, height: 3 },
    );
    expect(result.hasText("Home")).toBe(true);
    expect(result.hasText("Products")).toBe(true);
    expect(result.hasText("Shoes")).toBe(true);
  });

  it("renders separator between items", () => {
    const result = renderForTest(
      React.createElement(Breadcrumb, { items: ["A", "B"] }),
      { width: 30, height: 3 },
    );
    // Default separator is ›
    expect(result.output.includes("\u203A")).toBe(true);
  });

  it("renders custom separator", () => {
    const result = renderForTest(
      React.createElement(Breadcrumb, { items: ["X", "Y"], separator: " / " }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("/")).toBe(true);
  });

  it("renders single item without separator", () => {
    const result = renderForTest(
      React.createElement(Breadcrumb, { items: ["Only"] }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("Only")).toBe(true);
    expect(result.output.includes("\u203A")).toBe(false);
  });

  it("renders empty items without crashing", () => {
    const result = renderForTest(
      React.createElement(Breadcrumb, { items: [] }),
      { width: 30, height: 3 },
    );
    expect(result).toBeDefined();
  });
});

// ── Link ──────────────────────────────────────────────────────────────

describe("Link", () => {
  it("renders link text", () => {
    const result = renderForTest(
      React.createElement(Link, { url: "https://example.com", children: null }, "Click here"),
      { width: 30, height: 3 },
    );
    expect(result.hasText("Click here")).toBe(true);
  });

  it("renders with color", () => {
    const result = renderForTest(
      React.createElement(Link, { url: "https://example.com", color: "#FF0000", children: null }, "Red link"),
      { width: 30, height: 3 },
    );
    expect(result.hasText("Red link")).toBe(true);
  });
});

// ── Footer ────────────────────────────────────────────────────────────

describe("Footer", () => {
  it("renders with border line", () => {
    const result = renderForTest(
      React.createElement(Footer, {},
        React.createElement("tui-text", null, "Footer text"),
      ),
      { width: 50, height: 5 },
    );
    expect(result.hasText("Footer text")).toBe(true);
    // Single border style uses ─
    expect(result.output.includes("\u2500")).toBe(true);
  });

  it("renders with double border style", () => {
    const result = renderForTest(
      React.createElement(Footer, { borderStyle: "double" },
        React.createElement("tui-text", null, "Double border"),
      ),
      { width: 50, height: 5 },
    );
    // Double border uses ━
    expect(result.output.includes("\u2501")).toBe(true);
  });

  it("renders with no border", () => {
    const result = renderForTest(
      React.createElement(Footer, { borderStyle: "none" },
        React.createElement("tui-text", null, "No border"),
      ),
      { width: 50, height: 5 },
    );
    expect(result.hasText("No border")).toBe(true);
  });

  it("renders without children", () => {
    const result = renderForTest(
      React.createElement(Footer, {}),
      { width: 50, height: 5 },
    );
    expect(result).toBeDefined();
  });
});

// ── GradientProgress ──────────────────────────────────────────────────

describe("GradientProgress", () => {
  it("renders at 0%", () => {
    const result = renderForTest(
      React.createElement(GradientProgress, { value: 0, width: 10 }),
      { width: 30, height: 3 },
    );
    // Should have dim empty blocks
    expect(result.output.includes("\u2591")).toBe(true);
  });

  it("renders at 100%", () => {
    const result = renderForTest(
      React.createElement(GradientProgress, { value: 100, width: 10 }),
      { width: 30, height: 3 },
    );
    // Should have full blocks
    expect(result.output.includes("\u2588")).toBe(true);
  });

  it("shows percentage when showPercentage is true", () => {
    const result = renderForTest(
      React.createElement(GradientProgress, { value: 75, width: 10, showPercentage: true }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("75%")).toBe(true);
  });

  it("renders with label", () => {
    const result = renderForTest(
      React.createElement(GradientProgress, { value: 50, width: 10, label: "Upload" }),
      { width: 40, height: 3 },
    );
    expect(result.hasText("Upload")).toBe(true);
  });

  it("clamps value to 0-100", () => {
    const result = renderForTest(
      React.createElement(GradientProgress, { value: 200, width: 10, showPercentage: true }),
      { width: 30, height: 3 },
    );
    expect(result.hasText("100%")).toBe(true);
  });
});

// ── DefinitionList ────────────────────────────────────────────────────

describe("DefinitionList", () => {
  it("renders terms and definitions in stacked layout", () => {
    const result = renderForTest(
      React.createElement(DefinitionList, {
        items: [
          { term: "Name", definition: "Alice" },
          { term: "Age", definition: "30" },
        ],
      }),
      { width: 40, height: 10 },
    );
    expect(result.hasText("Name")).toBe(true);
    expect(result.hasText("Alice")).toBe(true);
    expect(result.hasText("Age")).toBe(true);
    expect(result.hasText("30")).toBe(true);
  });

  it("renders inline layout with em-dash separator", () => {
    const result = renderForTest(
      React.createElement(DefinitionList, {
        items: [{ term: "Key", definition: "Value" }],
        layout: "inline",
      }),
      { width: 40, height: 5 },
    );
    expect(result.hasText("Key")).toBe(true);
    expect(result.hasText("Value")).toBe(true);
    expect(result.output.includes("\u2014")).toBe(true);
  });

  it("renders empty list without crashing", () => {
    const result = renderForTest(
      React.createElement(DefinitionList, { items: [] }),
      { width: 40, height: 5 },
    );
    expect(result).toBeDefined();
  });
});

// ── Tooltip ───────────────────────────────────────────────────────────

describe("Tooltip", () => {
  it("does not show tooltip when not visible", () => {
    const result = renderForTest(
      React.createElement(Tooltip, { content: "Help text", visible: false, children: null },
        React.createElement("tui-text", null, "Hover me"),
      ),
      { width: 40, height: 5 },
    );
    expect(result.hasText("Hover me")).toBe(true);
    expect(result.hasText("Help text")).toBe(false);
  });

  it("shows tooltip when visible is true", () => {
    const result = renderForTest(
      React.createElement(Tooltip, { content: "Helpful tip", visible: true, children: null },
        React.createElement("tui-text", null, "Content"),
      ),
      { width: 40, height: 5 },
    );
    expect(result.hasText("Content")).toBe(true);
    expect(result.hasText("Helpful tip")).toBe(true);
  });

  it("positions tooltip at top by default", () => {
    const result = renderForTest(
      React.createElement(Tooltip, { content: "Top tip", visible: true, children: null },
        React.createElement("tui-text", null, "Below"),
      ),
      { width: 40, height: 5 },
    );
    // Tooltip should appear before content in output
    const tipIdx = result.output.indexOf("Top tip");
    const contentIdx = result.output.indexOf("Below");
    expect(tipIdx).toBeLessThan(contentIdx);
  });

  it("positions tooltip at bottom", () => {
    const result = renderForTest(
      React.createElement(Tooltip, { content: "Bottom tip", visible: true, position: "bottom", children: null },
        React.createElement("tui-text", null, "Above"),
      ),
      { width: 40, height: 5 },
    );
    const contentIdx = result.output.indexOf("Above");
    const tipIdx = result.output.indexOf("Bottom tip");
    expect(contentIdx).toBeLessThan(tipIdx);
  });

  it("positions tooltip at right", () => {
    const result = renderForTest(
      React.createElement(Tooltip, { content: "Right tip", visible: true, position: "right", children: null },
        React.createElement("tui-text", null, "Left"),
      ),
      { width: 50, height: 3 },
    );
    expect(result.hasText("Left")).toBe(true);
    expect(result.hasText("Right tip")).toBe(true);
  });
});

// ── Avatar ────────────────────────────────────────────────────────────

describe("Avatar", () => {
  it("renders small avatar with initial in parens", () => {
    const result = renderForTest(
      React.createElement(Avatar, { name: "John" }),
      { width: 20, height: 3 },
    );
    expect(result.hasText("(J)")).toBe(true);
  });

  it("renders uppercase initial", () => {
    const result = renderForTest(
      React.createElement(Avatar, { name: "alice" }),
      { width: 20, height: 3 },
    );
    expect(result.hasText("(A)")).toBe(true);
  });

  it("renders ? for empty name", () => {
    const result = renderForTest(
      React.createElement(Avatar, { name: "" }),
      { width: 20, height: 3 },
    );
    expect(result.hasText("(?)")).toBe(true);
  });

  it("renders large avatar with border", () => {
    const result = renderForTest(
      React.createElement(Avatar, { name: "Bob", size: "large" }),
      { width: 20, height: 6 },
    );
    expect(result.output.includes("\u256D")).toBe(true); // ╭
    expect(result.output.includes("\u256F")).toBe(true); // ╯
    expect(result.hasText("B")).toBe(true);
  });

  it("large avatar shows initial centered", () => {
    const result = renderForTest(
      React.createElement(Avatar, { name: "Zara", size: "large" }),
      { width: 20, height: 6 },
    );
    // Middle line: │ Z │
    expect(result.output.includes("Z")).toBe(true);
  });
});

// ── Sparkline ─────────────────────────────────────────────────────────

describe("Sparkline", () => {
  it("renders data as block characters", () => {
    const result = renderForTest(
      React.createElement(Sparkline, { data: [1, 2, 3, 4, 5] }),
      { width: 20, height: 3 },
    );
    // Should contain block characters
    const hasBlock = /[\u2581-\u2588]/.test(result.output);
    expect(hasBlock).toBe(true);
  });

  it("renders empty data without crashing", () => {
    const result = renderForTest(
      React.createElement(Sparkline, { data: [] }),
      { width: 20, height: 3 },
    );
    expect(result).toBeDefined();
  });

  it("renders with label", () => {
    const result = renderForTest(
      React.createElement(Sparkline, { data: [5, 10, 15], height: 2, label: "CPU" }),
      { width: 20, height: 6 },
    );
    expect(result.hasText("CPU")).toBe(true);
  });

  it("renders single data point", () => {
    const result = renderForTest(
      React.createElement(Sparkline, { data: [42] }),
      { width: 20, height: 3 },
    );
    // Single data point renders a block character (lowest level since range=0)
    const hasBlock = /[\u2581-\u2588]/.test(result.output);
    expect(hasBlock).toBe(true);
  });

  it("renders multi-row sparkline", () => {
    const result = renderForTest(
      React.createElement(Sparkline, { data: [0, 50, 100], height: 2 }),
      { width: 20, height: 6 },
    );
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Table ─────────────────────────────────────────────────────────────

describe("Table", () => {
  const columns = [
    { key: "name", header: "Name" },
    { key: "age", header: "Age" },
  ];

  it("renders headers and data", () => {
    const result = renderForTest(
      React.createElement(Table, {
        columns,
        data: [
          { name: "Alice", age: 30 },
          { name: "Bob", age: 25 },
        ],
      }),
      { width: 40, height: 10 },
    );
    expect(result.hasText("Name")).toBe(true);
    expect(result.hasText("Age")).toBe(true);
    expect(result.hasText("Alice")).toBe(true);
    expect(result.hasText("Bob")).toBe(true);
  });

  it("renders 'No data' for empty data array", () => {
    const result = renderForTest(
      React.createElement(Table, { columns, data: [] }),
      { width: 40, height: 5 },
    );
    expect(result.hasText("No data")).toBe(true);
  });

  it("renders single row", () => {
    const result = renderForTest(
      React.createElement(Table, {
        columns,
        data: [{ name: "Charlie", age: 35 }],
      }),
      { width: 40, height: 8 },
    );
    expect(result.hasText("Charlie")).toBe(true);
    expect(result.hasText("35")).toBe(true);
  });

  it("renders with stripe option", () => {
    const result = renderForTest(
      React.createElement(Table, {
        columns,
        data: [
          { name: "A", age: 1 },
          { name: "B", age: 2 },
          { name: "C", age: 3 },
        ],
        stripe: true,
      }),
      { width: 40, height: 12 },
    );
    expect(result.hasText("A")).toBe(true);
    expect(result.hasText("B")).toBe(true);
    expect(result.hasText("C")).toBe(true);
  });
});

// ── Spacer ────────────────────────────────────────────────────────────

describe("Spacer", () => {
  it("renders without crashing", () => {
    const result = renderForTest(
      React.createElement("tui-box", { flexDirection: "row", width: 20 },
        React.createElement("tui-text", null, "L"),
        React.createElement(Spacer, null),
        React.createElement("tui-text", null, "R"),
      ),
      { width: 20, height: 3 },
    );
    expect(result.hasText("L")).toBe(true);
    expect(result.hasText("R")).toBe(true);
  });

  it("pushes siblings apart", () => {
    const result = renderForTest(
      React.createElement("tui-box", { flexDirection: "row", width: 20 },
        React.createElement("tui-text", null, "A"),
        React.createElement(Spacer, null),
        React.createElement("tui-text", null, "B"),
      ),
      { width: 20, height: 3 },
    );
    // A and B should be on the same line but separated
    const line = result.getLine(0);
    const aIdx = line.indexOf("A");
    const bIdx = line.indexOf("B");
    expect(aIdx).toBeGreaterThanOrEqual(0);
    expect(bIdx).toBeGreaterThan(aIdx + 1);
  });
});

// ── Newline ───────────────────────────────────────────────────────────

describe("Newline", () => {
  it("renders single newline by default", () => {
    const result = renderForTest(
      React.createElement("tui-box", { flexDirection: "column" },
        React.createElement("tui-text", null, "Before"),
        React.createElement(Newline, null),
        React.createElement("tui-text", null, "After"),
      ),
      { width: 30, height: 6 },
    );
    expect(result.hasText("Before")).toBe(true);
    expect(result.hasText("After")).toBe(true);
  });

  it("renders multiple newlines", () => {
    const result = renderForTest(
      React.createElement("tui-box", { flexDirection: "column" },
        React.createElement("tui-text", null, "Top"),
        React.createElement(Newline, { count: 3 }),
        React.createElement("tui-text", null, "Bottom"),
      ),
      { width: 30, height: 10 },
    );
    expect(result.hasText("Top")).toBe(true);
    expect(result.hasText("Bottom")).toBe(true);
  });
});

// ── expectOutput assertion helpers ────────────────────────────────────

describe("expectOutput assertion helpers", () => {
  it("toContainText passes for existing text", () => {
    const result = renderForTest(
      React.createElement("tui-text", null, "hello"),
      { width: 20, height: 3 },
    );
    expectOutput(result).toContainText("hello");
  });

  it("toContainText throws for missing text", () => {
    const result = renderForTest(
      React.createElement("tui-text", null, "hello"),
      { width: 20, height: 3 },
    );
    expect(() => expectOutput(result).toContainText("missing")).toThrow();
  });

  it("toNotContainText passes for absent text", () => {
    const result = renderForTest(
      React.createElement("tui-text", null, "hello"),
      { width: 20, height: 3 },
    );
    expectOutput(result).toNotContainText("missing");
  });

  it("lineAt().toContain works", () => {
    const result = renderForTest(
      React.createElement("tui-text", null, "line zero"),
      { width: 20, height: 3 },
    );
    expectOutput(result).lineAt(0).toContain("line zero");
  });
});
