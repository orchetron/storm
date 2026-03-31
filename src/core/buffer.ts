/**
 * ScreenBuffer -- 2D grid of cells using typed arrays.
 *
 * The fundamental data structure for our renderer. All painting writes
 * into a buffer; diffing compares two buffers to produce minimal output.
 *
 * Storage: fg/bg in Int32Array, attrs in Uint8Array, chars in string[].
 * This eliminates ~30,000 Cell objects per buffer (300x100 terminal),
 * reducing GC pressure by ~90% compared to the object-per-cell approach.
 */

import { type Cell, EMPTY_CELL, DEFAULT_COLOR, Attr } from "./types.js";
import { charWidth, iterGraphemes, isAscii } from "./unicode.js";

/** Sentinel placed in the cell immediately after a wide (2-column) character. */
export const WIDE_CHAR_PLACEHOLDER = "\0";

export class ScreenBuffer {
  width: number;
  height: number;

  // Packed flat storage: index = y * width + x
  private chars: string[];
  private fgs: Int32Array;
  private bgs: Int32Array;
  private attrArr: Uint8Array;
  private ulColors: Int32Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    const size = width * height;
    this.chars = new Array<string>(size).fill(" ");
    this.fgs = new Int32Array(size).fill(DEFAULT_COLOR);
    this.bgs = new Int32Array(size).fill(DEFAULT_COLOR);
    this.attrArr = new Uint8Array(size); // 0 = Attr.NONE
    this.ulColors = new Int32Array(size).fill(DEFAULT_COLOR);
  }

  getCell(x: number, y: number): Readonly<Cell> {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return EMPTY_CELL;
    const i = y * this.width + x;
    return { char: this.chars[i]!, fg: this.fgs[i]!, bg: this.bgs[i]!, attrs: this.attrArr[i]!, ulColor: this.ulColors[i]! };
  }

  /** Read a single field without allocating a Cell object. */
  getChar(x: number, y: number): string {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return " ";
    return this.chars[y * this.width + x]!;
  }
  getFg(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return DEFAULT_COLOR;
    return this.fgs[y * this.width + x]!;
  }
  getBg(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return DEFAULT_COLOR;
    return this.bgs[y * this.width + x]!;
  }
  getAttrs(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return Attr.NONE;
    return this.attrArr[y * this.width + x]!;
  }
  getUlColor(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return DEFAULT_COLOR;
    return this.ulColors[y * this.width + x]!;
  }

  setCell(x: number, y: number, cell: Readonly<Cell>): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const i = y * this.width + x;
    this.chars[i] = cell.char;
    this.fgs[i] = cell.fg;
    this.bgs[i] = cell.bg;
    this.attrArr[i] = cell.attrs;
    this.ulColors[i] = cell.ulColor;
  }

  /**
   * Write a string at (x, y) with the given style.
   * Returns the number of columns consumed.
   */
  writeString(
    x: number,
    y: number,
    text: string,
    fg: number = DEFAULT_COLOR,
    bg: number = DEFAULT_COLOR,
    attrs: number = Attr.NONE,
    clipRight: number = this.width,
    ulColor: number = DEFAULT_COLOR,
  ): number {
    if (y < 0 || y >= this.height) return 0;
    // Sanitize null bytes in user text so they don't collide with WIDE_CHAR_PLACEHOLDER
    const safeText = text.replace(/\0/g, " ");
    const rowBase = y * this.width;
    let col = x;

    // Fast path: pure ASCII — skip grapheme segmentation entirely.
    // This is the overwhelmingly common case (UI chrome, code text, etc.)
    // and avoids generator/Intl.Segmenter overhead.
    if (isAscii(safeText)) {
      for (let i = 0; i < safeText.length && col < clipRight; i++) {
        const code = safeText.charCodeAt(i);
        const cw = charWidth(code);
        if (cw === 0) continue;
        if (col >= 0 && col < this.width) {
          const idx = rowBase + col;
          this.chars[idx] = safeText[i]!;
          this.fgs[idx] = fg;
          this.bgs[idx] = bg;
          this.attrArr[idx] = attrs;
          this.ulColors[idx] = ulColor;
        }
        col += cw;
      }
      return col - x;
    }

    // Slow path: non-ASCII — use grapheme iteration for correct emoji handling
    for (const g of iterGraphemes(safeText)) {
      if (col >= clipRight) break;
      const cw = g.width;
      if (cw === 0) continue; // skip zero-width graphemes
      if (col >= 0 && col < this.width) {
        const idx = rowBase + col;
        this.chars[idx] = g.text;
        this.fgs[idx] = fg;
        this.bgs[idx] = bg;
        this.attrArr[idx] = attrs;
        this.ulColors[idx] = ulColor;
        // For wide chars (incl. multi-codepoint emoji), fill the next cell with a placeholder
        if (cw === 2 && col + 1 < this.width) {
          const nIdx = idx + 1;
          this.chars[nIdx] = WIDE_CHAR_PLACEHOLDER;
          this.fgs[nIdx] = fg;
          this.bgs[nIdx] = bg;
          this.attrArr[nIdx] = attrs;
          this.ulColors[nIdx] = ulColor;
        }
      }
      col += cw;
    }
    return col - x;
  }

  /** Fill a rectangular region with a character and style. */
  fill(
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    char: string = " ",
    fg: number = DEFAULT_COLOR,
    bg: number = DEFAULT_COLOR,
    attrs: number = Attr.NONE,
    ulColor: number = DEFAULT_COLOR,
  ): void {
    const x1 = Math.max(0, rx);
    const y1 = Math.max(0, ry);
    const x2 = Math.min(this.width, rx + rw);
    const y2 = Math.min(this.height, ry + rh);
    for (let y = y1; y < y2; y++) {
      const rowBase = y * this.width;
      for (let x = x1; x < x2; x++) {
        const i = rowBase + x;
        this.chars[i] = char;
        this.fgs[i] = fg;
        this.bgs[i] = bg;
        this.attrArr[i] = attrs;
        this.ulColors[i] = ulColor;
      }
    }
  }

  /**
   * Copy a region from another buffer into this buffer.
   * srcY/srcH define the vertical slice of `src` to copy.
   * dstX/dstY define where to place it in this buffer.
   */
  blit(
    src: ScreenBuffer,
    srcX: number,
    srcY: number,
    srcW: number,
    srcH: number,
    dstX: number,
    dstY: number,
  ): void {
    for (let dy = 0; dy < srcH; dy++) {
      const sy = srcY + dy;
      const ty = dstY + dy;
      if (sy < 0 || sy >= src.height || ty < 0 || ty >= this.height) continue;
      const srcBase = sy * src.width;
      const dstBase = ty * this.width;
      for (let dx = 0; dx < srcW; dx++) {
        const sx = srcX + dx;
        const tx = dstX + dx;
        if (sx < 0 || sx >= src.width || tx < 0 || tx >= this.width) continue;
        const si = srcBase + sx;
        const di = dstBase + tx;
        this.chars[di] = src.chars[si]!;
        this.fgs[di] = src.fgs[si]!;
        this.bgs[di] = src.bgs[si]!;
        this.attrArr[di] = src.attrArr[si]!;
        this.ulColors[di] = src.ulColors[si]!;
      }
    }
  }

  /** Reset all cells to EMPTY_CELL. */
  clear(): void {
    this.chars.fill(" ");
    this.fgs.fill(DEFAULT_COLOR);
    this.bgs.fill(DEFAULT_COLOR);
    this.attrArr.fill(Attr.NONE);
    this.ulColors.fill(DEFAULT_COLOR);
  }

  /** Resize the buffer, preserving content where possible. */
  resize(newWidth: number, newHeight: number): void {
    const newSize = newWidth * newHeight;
    const newChars = new Array<string>(newSize).fill(" ");
    const newFgs = new Int32Array(newSize).fill(DEFAULT_COLOR);
    const newBgs = new Int32Array(newSize).fill(DEFAULT_COLOR);
    const newAttrs = new Uint8Array(newSize);
    const newUlColors = new Int32Array(newSize).fill(DEFAULT_COLOR);

    const copyW = Math.min(this.width, newWidth);
    const copyH = Math.min(this.height, newHeight);
    for (let y = 0; y < copyH; y++) {
      const oldBase = y * this.width;
      const newBase = y * newWidth;
      for (let x = 0; x < copyW; x++) {
        newChars[newBase + x] = this.chars[oldBase + x]!;
        newFgs[newBase + x] = this.fgs[oldBase + x]!;
        newBgs[newBase + x] = this.bgs[oldBase + x]!;
        newAttrs[newBase + x] = this.attrArr[oldBase + x]!;
        newUlColors[newBase + x] = this.ulColors[oldBase + x]!;
      }
    }
    this.width = newWidth;
    this.height = newHeight;
    this.chars = newChars;
    this.fgs = newFgs;
    this.bgs = newBgs;
    this.attrArr = newAttrs;
    this.ulColors = newUlColors;
  }

  /** Copy all cell data from another buffer of the same dimensions (no allocation). */
  copyFrom(src: ScreenBuffer): void {
    if (src.width !== this.width || src.height !== this.height) return;
    const size = this.width * this.height;
    for (let i = 0; i < size; i++) this.chars[i] = src.chars[i]!;
    this.fgs.set(src.fgs);
    this.bgs.set(src.bgs);
    this.attrArr.set(src.attrArr);
    this.ulColors.set(src.ulColors);
  }

  /** Create a deep copy. */
  clone(): ScreenBuffer {
    const copy = new ScreenBuffer(this.width, this.height);
    const size = this.width * this.height;
    for (let i = 0; i < size; i++) {
      copy.chars[i] = this.chars[i]!;
    }
    copy.fgs.set(this.fgs);
    copy.bgs.set(this.bgs);
    copy.attrArr.set(this.attrArr);
    copy.ulColors.set(this.ulColors);
    return copy;
  }

  /**
   * Compare a single row between this buffer and another.
   * Returns true if all cells in the row are identical.
   * This is O(width) integer comparisons — much cheaper than building ANSI strings.
   */
  rowEquals(other: ScreenBuffer, y: number): boolean {
    if (this.width !== other.width || y < 0 || y >= this.height || y >= other.height) return false;
    const base = y * this.width;
    const end = base + this.width;
    for (let i = base; i < end; i++) {
      if (
        this.chars[i] !== other.chars[i] ||
        this.fgs[i] !== other.fgs[i] ||
        this.bgs[i] !== other.bgs[i] ||
        this.attrArr[i] !== other.attrArr[i] ||
        this.ulColors[i] !== other.ulColors[i]
      ) return false;
    }
    return true;
  }

  /** Check if two buffers have identical content. */
  equals(other: ScreenBuffer): boolean {
    if (this.width !== other.width || this.height !== other.height) return false;
    const size = this.width * this.height;
    for (let i = 0; i < size; i++) {
      if (
        this.chars[i] !== other.chars[i] ||
        this.fgs[i] !== other.fgs[i] ||
        this.bgs[i] !== other.bgs[i] ||
        this.attrArr[i] !== other.attrArr[i] ||
        this.ulColors[i] !== other.ulColors[i]
      ) return false;
    }
    return true;
  }
}
