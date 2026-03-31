import { describe, it, expect } from "vitest";
import {
  DEFAULT_COLOR,
  rgb,
  isRgbColor,
  rgbR,
  rgbG,
  rgbB,
  parseColor,
  Attr,
  EMPTY_CELL,
  cellEquals,
  makeCell,
  styleToAttrs,
  styleToCellProps,
  BORDER_CHARS,
} from "../core/types.js";

describe("color encoding", () => {
  it("rgb encodes r/g/b into a single number", () => {
    const c = rgb(255, 128, 0);
    expect(rgbR(c)).toBe(255);
    expect(rgbG(c)).toBe(128);
    expect(rgbB(c)).toBe(0);
  });

  it("isRgbColor detects RGB-encoded colors", () => {
    expect(isRgbColor(rgb(0, 0, 0))).toBe(true);
    expect(isRgbColor(DEFAULT_COLOR)).toBe(false);
    expect(isRgbColor(128)).toBe(false); // ANSI 256
  });

  it("rgb(0,0,0) is still recognized as RGB (not ANSI)", () => {
    const black = rgb(0, 0, 0);
    expect(isRgbColor(black)).toBe(true);
    expect(black).toBeGreaterThanOrEqual(0x1000000);
  });
});

describe("parseColor", () => {
  it("returns DEFAULT_COLOR for undefined", () => {
    expect(parseColor(undefined)).toBe(DEFAULT_COLOR);
  });

  it("passes through numeric values", () => {
    expect(parseColor(42)).toBe(42);
  });

  it("parses named colors", () => {
    expect(parseColor("red")).toBe(1);
    expect(parseColor("green")).toBe(2);
    expect(parseColor("white")).toBe(7);
    expect(parseColor("gray")).toBe(8);
    expect(parseColor("grey")).toBe(8);
  });

  it("parses #RRGGBB hex", () => {
    const c = parseColor("#ff8000");
    expect(rgbR(c)).toBe(255);
    expect(rgbG(c)).toBe(128);
    expect(rgbB(c)).toBe(0);
  });

  it("parses #RGB shorthand hex", () => {
    const c = parseColor("#f00");
    expect(rgbR(c)).toBe(255);
    expect(rgbG(c)).toBe(0);
    expect(rgbB(c)).toBe(0);
  });

  it("parses rgb() functional notation", () => {
    const c = parseColor("rgb(100, 200, 50)");
    expect(rgbR(c)).toBe(100);
    expect(rgbG(c)).toBe(200);
    expect(rgbB(c)).toBe(50);
  });

  it("returns DEFAULT_COLOR for unknown strings", () => {
    expect(parseColor("notacolor")).toBe(DEFAULT_COLOR);
  });
});

describe("Attr bitmask", () => {
  it("has distinct bit positions", () => {
    const attrs = [Attr.BOLD, Attr.DIM, Attr.ITALIC, Attr.UNDERLINE, Attr.BLINK, Attr.INVERSE, Attr.HIDDEN, Attr.STRIKETHROUGH];
    for (let i = 0; i < attrs.length; i++) {
      for (let j = i + 1; j < attrs.length; j++) {
        expect(attrs[i]! & attrs[j]!).toBe(0); // no overlap
      }
    }
  });

  it("can combine multiple attrs", () => {
    const combined = Attr.BOLD | Attr.ITALIC | Attr.UNDERLINE;
    expect(combined & Attr.BOLD).toBeTruthy();
    expect(combined & Attr.ITALIC).toBeTruthy();
    expect(combined & Attr.UNDERLINE).toBeTruthy();
    expect(combined & Attr.DIM).toBeFalsy();
  });
});

describe("Cell utilities", () => {
  it("EMPTY_CELL has default values", () => {
    expect(EMPTY_CELL.char).toBe(" ");
    expect(EMPTY_CELL.fg).toBe(DEFAULT_COLOR);
    expect(EMPTY_CELL.bg).toBe(DEFAULT_COLOR);
    expect(EMPTY_CELL.attrs).toBe(Attr.NONE);
  });

  it("cellEquals compares all fields", () => {
    const a = makeCell("A", 1, 2, 3);
    const b = makeCell("A", 1, 2, 3);
    expect(cellEquals(a, b)).toBe(true);

    expect(cellEquals(a, makeCell("B", 1, 2, 3))).toBe(false); // diff char
    expect(cellEquals(a, makeCell("A", 9, 2, 3))).toBe(false); // diff fg
    expect(cellEquals(a, makeCell("A", 1, 9, 3))).toBe(false); // diff bg
    expect(cellEquals(a, makeCell("A", 1, 2, 9))).toBe(false); // diff attrs
  });

  it("makeCell creates correct Cell", () => {
    const c = makeCell("X", 10, 20, Attr.BOLD);
    expect(c.char).toBe("X");
    expect(c.fg).toBe(10);
    expect(c.bg).toBe(20);
    expect(c.attrs).toBe(Attr.BOLD);
  });

  it("makeCell uses defaults for optional params", () => {
    const c = makeCell("Z");
    expect(c.fg).toBe(DEFAULT_COLOR);
    expect(c.bg).toBe(DEFAULT_COLOR);
    expect(c.attrs).toBe(Attr.NONE);
  });
});

describe("Style conversion", () => {
  it("styleToAttrs converts boolean flags to bitmask", () => {
    expect(styleToAttrs({ bold: true, italic: true })).toBe(Attr.BOLD | Attr.ITALIC);
    expect(styleToAttrs({})).toBe(Attr.NONE);
    expect(styleToAttrs({ dim: true })).toBe(Attr.DIM);
    expect(styleToAttrs({ underline: true, strikethrough: true })).toBe(Attr.UNDERLINE | Attr.STRIKETHROUGH);
  });

  it("styleToCellProps converts full style", () => {
    const props = styleToCellProps({ color: "red", bgColor: "#00ff00", bold: true });
    expect(props.fg).toBe(1); // named "red" = ANSI 1
    expect(rgbG(props.bg)).toBe(255); // green channel
    expect(props.attrs & Attr.BOLD).toBeTruthy();
  });
});

describe("BORDER_CHARS", () => {
  it("has all expected border styles", () => {
    const styles = ["single", "double", "heavy", "round", "ascii", "storm"] as const;
    for (const style of styles) {
      const chars = BORDER_CHARS[style];
      expect(chars).toHaveProperty("topLeft");
      expect(chars).toHaveProperty("topRight");
      expect(chars).toHaveProperty("bottomLeft");
      expect(chars).toHaveProperty("bottomRight");
      expect(chars).toHaveProperty("horizontal");
      expect(chars).toHaveProperty("vertical");
    }
  });

  it("single border uses box-drawing characters", () => {
    expect(BORDER_CHARS.single.topLeft).toBe("\u250c"); // ┌
    expect(BORDER_CHARS.single.horizontal).toBe("\u2500"); // ─
  });
});
