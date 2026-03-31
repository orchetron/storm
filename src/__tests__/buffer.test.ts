import { describe, it, expect } from "vitest";
import { ScreenBuffer } from "../core/buffer.js";
import { DEFAULT_COLOR, Attr } from "../core/types.js";

describe("ScreenBuffer", () => {
  it("creates buffer with correct dimensions", () => {
    const buf = new ScreenBuffer(80, 24);
    expect(buf.width).toBe(80);
    expect(buf.height).toBe(24);
  });

  it("initializes all cells to empty", () => {
    const buf = new ScreenBuffer(5, 5);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        expect(buf.getChar(x, y)).toBe(" ");
        expect(buf.getFg(x, y)).toBe(DEFAULT_COLOR);
        expect(buf.getBg(x, y)).toBe(DEFAULT_COLOR);
        expect(buf.getAttrs(x, y)).toBe(Attr.NONE);
      }
    }
  });

  it("setCell and getCell round-trip", () => {
    const buf = new ScreenBuffer(10, 10);
    buf.setCell(5, 3, { char: "X", fg: 0xFF0000, bg: 0x00FF00, attrs: 1, ulColor: -1 });
    expect(buf.getChar(5, 3)).toBe("X");
    expect(buf.getFg(5, 3)).toBe(0xFF0000);
    expect(buf.getBg(5, 3)).toBe(0x00FF00);
    expect(buf.getAttrs(5, 3)).toBe(1);
  });

  it("getCell returns full Cell object", () => {
    const buf = new ScreenBuffer(10, 10);
    buf.setCell(2, 2, { char: "Q", fg: 42, bg: 99, attrs: Attr.BOLD | Attr.ITALIC, ulColor: -1 });
    const cell = buf.getCell(2, 2);
    expect(cell.char).toBe("Q");
    expect(cell.fg).toBe(42);
    expect(cell.bg).toBe(99);
    expect(cell.attrs).toBe(Attr.BOLD | Attr.ITALIC);
  });

  it("out of bounds setCell is no-op", () => {
    const buf = new ScreenBuffer(10, 10);
    // None of these should throw
    buf.setCell(-1, 0, { char: "X", fg: 0, bg: 0, attrs: 0, ulColor: -1 });
    buf.setCell(0, -1, { char: "X", fg: 0, bg: 0, attrs: 0, ulColor: -1 });
    buf.setCell(10, 0, { char: "X", fg: 0, bg: 0, attrs: 0, ulColor: -1 });
    buf.setCell(0, 10, { char: "X", fg: 0, bg: 0, attrs: 0, ulColor: -1 });
  });

  it("out of bounds getters return defaults", () => {
    const buf = new ScreenBuffer(5, 5);
    expect(buf.getChar(-1, 0)).toBe(" ");
    expect(buf.getFg(0, -1)).toBe(DEFAULT_COLOR);
    expect(buf.getBg(5, 0)).toBe(DEFAULT_COLOR);
    expect(buf.getAttrs(0, 5)).toBe(Attr.NONE);
  });

  it("clear resets all cells", () => {
    const buf = new ScreenBuffer(10, 10);
    buf.setCell(5, 5, { char: "A", fg: 1, bg: 2, attrs: 3, ulColor: -1 });
    buf.clear();
    expect(buf.getChar(5, 5)).toBe(" ");
    expect(buf.getFg(5, 5)).toBe(DEFAULT_COLOR);
    expect(buf.getBg(5, 5)).toBe(DEFAULT_COLOR);
    expect(buf.getAttrs(5, 5)).toBe(Attr.NONE);
  });

  it("rowEquals compares correctly", () => {
    const a = new ScreenBuffer(10, 5);
    const b = new ScreenBuffer(10, 5);
    expect(a.rowEquals(b, 0)).toBe(true);
    a.setCell(3, 0, { char: "X", fg: 0, bg: 0, attrs: 0, ulColor: -1 });
    expect(a.rowEquals(b, 0)).toBe(false);
    expect(a.rowEquals(b, 1)).toBe(true); // other rows still equal
  });

  it("rowEquals returns false for different-width buffers", () => {
    const a = new ScreenBuffer(10, 5);
    const b = new ScreenBuffer(12, 5);
    expect(a.rowEquals(b, 0)).toBe(false);
  });

  it("rowEquals returns false for out-of-bounds row", () => {
    const a = new ScreenBuffer(10, 5);
    const b = new ScreenBuffer(10, 5);
    expect(a.rowEquals(b, -1)).toBe(false);
    expect(a.rowEquals(b, 5)).toBe(false);
  });

  it("copyFrom copies all data", () => {
    const src = new ScreenBuffer(10, 5);
    src.setCell(2, 2, { char: "Z", fg: 100, bg: 200, attrs: 5, ulColor: -1 });
    const dst = new ScreenBuffer(10, 5);
    dst.copyFrom(src);
    expect(dst.getChar(2, 2)).toBe("Z");
    expect(dst.getFg(2, 2)).toBe(100);
    expect(dst.rowEquals(src, 2)).toBe(true);
  });

  it("copyFrom is no-op for mismatched dimensions", () => {
    const src = new ScreenBuffer(10, 5);
    src.setCell(0, 0, { char: "A", fg: 1, bg: 2, attrs: 3, ulColor: -1 });
    const dst = new ScreenBuffer(8, 5);
    dst.copyFrom(src);
    // dst should be unchanged (still empty)
    expect(dst.getChar(0, 0)).toBe(" ");
  });

  it("clone creates independent copy", () => {
    const orig = new ScreenBuffer(10, 5);
    orig.setCell(0, 0, { char: "A", fg: 1, bg: 2, attrs: 3, ulColor: -1 });
    const copy = orig.clone();
    expect(copy.rowEquals(orig, 0)).toBe(true);
    copy.setCell(0, 0, { char: "B", fg: 9, bg: 9, attrs: 9, ulColor: -1 });
    expect(copy.rowEquals(orig, 0)).toBe(false); // independent
  });

  it("writeString writes characters correctly", () => {
    const buf = new ScreenBuffer(20, 1);
    buf.writeString(0, 0, "Hello", 0xFF0000, DEFAULT_COLOR, Attr.NONE);
    expect(buf.getChar(0, 0)).toBe("H");
    expect(buf.getChar(1, 0)).toBe("e");
    expect(buf.getChar(2, 0)).toBe("l");
    expect(buf.getChar(3, 0)).toBe("l");
    expect(buf.getChar(4, 0)).toBe("o");
    expect(buf.getFg(0, 0)).toBe(0xFF0000);
    expect(buf.getFg(4, 0)).toBe(0xFF0000);
  });

  it("writeString returns columns consumed", () => {
    const buf = new ScreenBuffer(20, 1);
    const cols = buf.writeString(0, 0, "Test");
    expect(cols).toBe(4);
  });

  it("writeString out of bounds row returns 0", () => {
    const buf = new ScreenBuffer(20, 1);
    expect(buf.writeString(0, -1, "X")).toBe(0);
    expect(buf.writeString(0, 1, "X")).toBe(0);
  });

  it("fill fills rectangle", () => {
    const buf = new ScreenBuffer(10, 10);
    buf.fill(2, 2, 3, 3, "#", 0xFF, 0x00);
    expect(buf.getChar(2, 2)).toBe("#");
    expect(buf.getChar(4, 4)).toBe("#");
    expect(buf.getChar(5, 5)).toBe(" "); // outside fill
    expect(buf.getFg(3, 3)).toBe(0xFF);
    expect(buf.getBg(3, 3)).toBe(0x00);
  });

  it("fill clips to buffer bounds", () => {
    const buf = new ScreenBuffer(5, 5);
    // Fill that extends beyond buffer — should not throw
    buf.fill(-2, -2, 10, 10, "X", 0, 0);
    expect(buf.getChar(0, 0)).toBe("X");
    expect(buf.getChar(4, 4)).toBe("X");
  });

  it("equals detects identical buffers", () => {
    const a = new ScreenBuffer(5, 5);
    const b = new ScreenBuffer(5, 5);
    expect(a.equals(b)).toBe(true);
    a.setCell(0, 0, { char: "X", fg: 0, bg: 0, attrs: 0, ulColor: -1 });
    expect(a.equals(b)).toBe(false);
  });

  it("equals returns false for different dimensions", () => {
    const a = new ScreenBuffer(5, 5);
    const b = new ScreenBuffer(5, 6);
    expect(a.equals(b)).toBe(false);
  });

  it("resize preserves content where possible", () => {
    const buf = new ScreenBuffer(10, 10);
    buf.setCell(2, 2, { char: "K", fg: 42, bg: 0, attrs: 0, ulColor: -1 });
    buf.resize(20, 20);
    expect(buf.width).toBe(20);
    expect(buf.height).toBe(20);
    expect(buf.getChar(2, 2)).toBe("K");
    expect(buf.getFg(2, 2)).toBe(42);
    // New cells should be empty
    expect(buf.getChar(15, 15)).toBe(" ");
  });

  it("resize to smaller clips content", () => {
    const buf = new ScreenBuffer(10, 10);
    buf.setCell(8, 8, { char: "Z", fg: 0, bg: 0, attrs: 0, ulColor: -1 });
    buf.resize(5, 5);
    expect(buf.width).toBe(5);
    expect(buf.height).toBe(5);
    // (8,8) is now out of bounds
    expect(buf.getChar(8, 8)).toBe(" "); // returns default for OOB
  });

  it("blit copies a region from another buffer", () => {
    const src = new ScreenBuffer(10, 10);
    src.setCell(3, 3, { char: "B", fg: 77, bg: 88, attrs: 0, ulColor: -1 });
    const dst = new ScreenBuffer(20, 20);
    dst.blit(src, 2, 2, 5, 5, 0, 0);
    // src (3,3) relative to srcX=2,srcY=2 maps to dst (1,1)
    expect(dst.getChar(1, 1)).toBe("B");
    expect(dst.getFg(1, 1)).toBe(77);
  });

  it("blit clips to both buffer bounds", () => {
    const src = new ScreenBuffer(5, 5);
    src.fill(0, 0, 5, 5, "S", 0, 0);
    const dst = new ScreenBuffer(3, 3);
    // Should not throw, just clips
    dst.blit(src, 0, 0, 5, 5, 0, 0);
    expect(dst.getChar(0, 0)).toBe("S");
    expect(dst.getChar(2, 2)).toBe("S");
  });
});
