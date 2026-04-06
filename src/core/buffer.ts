import { type Cell, EMPTY_CELL, DEFAULT_COLOR, Attr } from "./types.js";
import { charWidth } from "./unicode.js";

/** Sentinel codepoint placed after a wide (2-column) character. */
const WIDE_CHAR_CODE = 0;

/** Sentinel string for wide-char placeholder (used by diff for skip detection). */
export const WIDE_CHAR_PLACEHOLDER = "\0";

/** Space codepoint — default cell content. */
const SPACE = 0x20;

/** Flat packed Uint32 cell buffer. Zero per-cell GC pressure -- all typed arrays. */
export class ScreenBuffer {
  width: number;
  height: number;

  // Packed flat storage: index = y * width + x
  // ALL typed arrays — zero per-cell GC pressure
  private codes: Uint32Array;   // Unicode codepoints (was string[] chars)
  private fgs: Int32Array;
  private bgs: Int32Array;
  private attrArr: Uint8Array;
  private ulColors: Int32Array;

  /** Tracks which rows were written to during the current paint cycle. */
  private _paintedRows: Uint8Array;

  /** Rows painted in the previous cycle — used for selective clearing. */
  private _prevPaintedRows: Uint8Array;

  /** Damage rect — bounding box of all writes this frame. */
  private _damageX1 = 0;
  private _damageY1 = 0;
  private _damageX2 = 0;
  private _damageY2 = 0;
  private _hasDamage = false;

  /** Per-row damage columns — narrowest range of changed cells per row.
   *  renderChangedCells scans only this range instead of all columns. */
  private _rowDmgX1: Uint16Array;
  private _rowDmgX2: Uint16Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    const size = width * height;
    this.codes = new Uint32Array(size).fill(SPACE);
    this.fgs = new Int32Array(size).fill(DEFAULT_COLOR);
    this.bgs = new Int32Array(size).fill(DEFAULT_COLOR);
    this.attrArr = new Uint8Array(size); // 0 = Attr.NONE
    this.ulColors = new Int32Array(size).fill(DEFAULT_COLOR);
    this._paintedRows = new Uint8Array(height);
    this._prevPaintedRows = new Uint8Array(height);
    this._rowDmgX1 = new Uint16Array(height).fill(width);
    this._rowDmgX2 = new Uint16Array(height);
  }

  getCell(x: number, y: number): Readonly<Cell> {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return EMPTY_CELL;
    const i = y * this.width + x;
    const code = this.codes[i]!;
    return {
      char: code === SPACE ? " " : code === WIDE_CHAR_CODE ? WIDE_CHAR_PLACEHOLDER : String.fromCodePoint(code),
      fg: this.fgs[i]!, bg: this.bgs[i]!, attrs: this.attrArr[i]!, ulColor: this.ulColors[i]!,
    };
  }

  /** Read char as string — only call in render output path, not hot loops. */
  getChar(x: number, y: number): string {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return " ";
    const code = this.codes[y * this.width + x]!;
    if (code === SPACE) return " ";
    if (code === WIDE_CHAR_CODE) return WIDE_CHAR_PLACEHOLDER;
    return String.fromCodePoint(code);
  }

  /** Read raw codepoint — fast path for internal comparisons. */
  getCode(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return SPACE;
    return this.codes[y * this.width + x]!;
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
    this.setCellDirect(x, y, cell.char, cell.fg, cell.bg, cell.attrs, cell.ulColor);
  }

  /**
   * Write a single cell with flat scalar arguments — no object allocation.
   */
  private expandDamage(x1: number, y1: number, x2: number, y2: number): void {
    if (!this._hasDamage) {
      this._damageX1 = x1; this._damageY1 = y1; this._damageX2 = x2; this._damageY2 = y2;
      this._hasDamage = true;
    } else {
      if (x1 < this._damageX1) this._damageX1 = x1;
      if (y1 < this._damageY1) this._damageY1 = y1;
      if (x2 > this._damageX2) this._damageX2 = x2;
      if (y2 > this._damageY2) this._damageY2 = y2;
    }
  }

  setCellDirect(x: number, y: number, char: string, fg: number, bg: number, attrs: number, ulColor: number): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const i = y * this.width + x;
    this.codes[i] = char.length === 0 ? WIDE_CHAR_CODE : char.codePointAt(0)!;
    this.fgs[i] = fg;
    this.bgs[i] = bg;
    this.attrArr[i] = attrs;
    this.ulColors[i] = ulColor;
    this._paintedRows[y] = 1;

    if (x < this._rowDmgX1[y]!) this._rowDmgX1[y] = x;
    if (x + 1 > this._rowDmgX2[y]!) this._rowDmgX2[y] = x + 1;
    this.expandDamage(x, y, x + 1, y + 1);
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
    const w = this.width;
    this._paintedRows[y] = 1;
    this.expandDamage(Math.max(0, x), y, w, y + 1);

    const rowBase = y * w;
    const len = text.length;
    // Hoist array refs for V8 TurboFan
    const codes = this.codes;
    const fgs = this.fgs;
    const bgs = this.bgs;
    const attrArr = this.attrArr;
    const ulColors = this.ulColors;

    // ── Fast path: ASCII-only text ────────────────────────────────
    // All typed array operations: fill() compiles to memset,
    // charCodeAt() is a direct integer read. Zero string allocation.
    if (x >= 0 && x + len <= clipRight && x + len <= w) {
      let allAscii = true;
      for (let i = 0; i < len; i++) {
        const c = text.charCodeAt(i);
        if (c < 0x20 || c > 0x7e) { allAscii = false; break; }
      }
      if (allAscii) {
        const base = rowBase + x;
        const end = base + len;
        fgs.fill(fg, base, end);
        bgs.fill(bg, base, end);
        attrArr.fill(attrs, base, end);
        ulColors.fill(ulColor, base, end);
        for (let i = 0; i < len; i++) codes[base + i] = text.charCodeAt(i);
        // Per-row damage + hash invalidation
        if (x < this._rowDmgX1[y]!) this._rowDmgX1[y] = x;
        if (x + len > this._rowDmgX2[y]!) this._rowDmgX2[y] = x + len;

        return len;
      }
    }

    // ── Slow path: Unicode, wide chars, clipping ──────────────────
    const safeText = text.indexOf('\0') >= 0 ? text.replace(/\0/g, " ") : text;
    let col = x;
    for (let i = 0; i < safeText.length && col < clipRight; i++) {
      const code = safeText.codePointAt(i)!;
      if (code > 0xffff) i++;
      const cw = charWidth(code);
      if (cw === 0) continue;
      if (col >= 0 && col < w) {
        if (cw === 2 && col + 1 >= w) {
          // Wide char doesn't fit — skip it, leave space
          col += cw;
          continue;
        }
        const idx = rowBase + col;
        codes[idx] = code;
        fgs[idx] = fg;
        bgs[idx] = bg;
        attrArr[idx] = attrs;
        ulColors[idx] = ulColor;
        if (cw === 2) {
          const nIdx = idx + 1;
          codes[nIdx] = WIDE_CHAR_CODE;
          fgs[nIdx] = fg;
          bgs[nIdx] = bg;
          attrArr[nIdx] = attrs;
          ulColors[nIdx] = ulColor;
        }
      }
      col += cw;
    }
    // Per-row damage + hash invalidation for slow path
    const wx1 = Math.max(0, x);
    if (wx1 < this._rowDmgX1[y]!) this._rowDmgX1[y] = wx1;
    if (col > this._rowDmgX2[y]!) this._rowDmgX2[y] = Math.min(col, w);
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
    this.expandDamage(x1, y1, x2, y2);
    const charCode = char.length === 0 ? SPACE : char.codePointAt(0)!;
    const codes = this.codes;
    const fgs = this.fgs;
    const bgs = this.bgs;
    const attrArr = this.attrArr;
    const ulColors = this.ulColors;
    for (let y = y1; y < y2; y++) {
      const rowBase = y * this.width;
      this._paintedRows[y] = 1;
      // Use TypedArray.fill for uniform values — compiles to memset
      codes.fill(charCode, rowBase + x1, rowBase + x2);
      fgs.fill(fg, rowBase + x1, rowBase + x2);
      bgs.fill(bg, rowBase + x1, rowBase + x2);
      attrArr.fill(attrs, rowBase + x1, rowBase + x2);
      ulColors.fill(ulColor, rowBase + x1, rowBase + x2);
    }
  }

  /**
   * Copy a region from another buffer into this buffer.
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
        this.codes[di] = src.codes[si]!;
        this.fgs[di] = src.fgs[si]!;
        this.bgs[di] = src.bgs[si]!;
        this.attrArr[di] = src.attrArr[si]!;
        this.ulColors[di] = src.ulColors[si]!;
      }
      this._paintedRows[ty] = 1;
    }
  }

  clear(): void {
    this.codes.fill(SPACE);
    this.fgs.fill(DEFAULT_COLOR);
    this.bgs.fill(DEFAULT_COLOR);
    this.attrArr.fill(Attr.NONE);
    this.ulColors.fill(DEFAULT_COLOR);
    this._prevPaintedRows.set(this._paintedRows);
    this._paintedRows.fill(1);
    this._hasDamage = false;
    this._rowDmgX1.fill(this.width);
    this._rowDmgX2.fill(0);
  }

  /**
   * Selective clear: only reset rows painted in the previous cycle.
   */
  clearPaintedRows(): void {
    const w = this.width;
    this._prevPaintedRows.set(this._paintedRows);
    this._paintedRows.fill(0);
    this._hasDamage = false;
    this._rowDmgX1.fill(w);
    this._rowDmgX2.fill(0);

    let paintedCount = 0;
    for (let y = 0; y < this.height; y++) if (this._prevPaintedRows[y]) paintedCount++;
    if (paintedCount > this.height * 0.6) {
      this.codes.fill(SPACE);
      this.fgs.fill(DEFAULT_COLOR);
      this.bgs.fill(DEFAULT_COLOR);
      this.attrArr.fill(Attr.NONE);
      this.ulColors.fill(DEFAULT_COLOR);
      this._paintedRows.fill(1);
      this._rowDmgX1.fill(0);  // full-width damage for all rows
      this._rowDmgX2.fill(w);
      return;
    }

    for (let y = 0; y < this.height; y++) {
      if (this._prevPaintedRows[y]) {
        const base = y * w;
        const end = base + w;
        this.codes.fill(SPACE, base, end);
        this.fgs.fill(DEFAULT_COLOR, base, end);
        this.bgs.fill(DEFAULT_COLOR, base, end);
        this.attrArr.fill(Attr.NONE, base, end);
        this.ulColors.fill(DEFAULT_COLOR, base, end);
        this._paintedRows[y] = 1;
        this._rowDmgX1[y] = 0;  // full-width damage for cleared rows
        this._rowDmgX2[y] = w;
      }
    }
  }

  /**
   * Reset paint tracking without clearing cell content.
   * Used for incremental painting.
   */
  resetPaintTracking(): void {
    this._prevPaintedRows.set(this._paintedRows);
    this._paintedRows.fill(0);
    this._hasDamage = false;
    this._rowDmgX1.fill(this.width);
    this._rowDmgX2.fill(0);
  }

  wasRowPainted(y: number): boolean {
    return y >= 0 && y < this.height && this._paintedRows[y] === 1;
  }

  getDamageRect(): { x1: number; y1: number; x2: number; y2: number } | null {
    return this._hasDamage ? { x1: this._damageX1, y1: this._damageY1, x2: this._damageX2, y2: this._damageY2 } : null;
  }

  isRowDamaged(y: number): boolean {
    return this._hasDamage && y >= this._damageY1 && y < this._damageY2;
  }

  /**
   * Get raw typed array refs + base index for a row. Bounds-check once,
   * then caller reads arrays directly — eliminates 5 method calls +
   * 5 bounds checks per cell in the cell-diff tight loop.
   */
  getRowRaw(y: number): { codes: Uint32Array; fgs: Int32Array; bgs: Int32Array; attrs: Uint8Array; ulColors: Int32Array; base: number } | null {
    if (y < 0 || y >= this.height) return null;
    return { codes: this.codes, fgs: this.fgs, bgs: this.bgs, attrs: this.attrArr, ulColors: this.ulColors, base: y * this.width };
  }

  /** Get the per-row damage column range. Returns [x1, x2) or null if no damage. */
  getRowDamage(y: number): [number, number] | null {
    if (y < 0 || y >= this.height) return null;
    const x1 = this._rowDmgX1[y]!;
    const x2 = this._rowDmgX2[y]!;
    return x1 < x2 ? [x1, x2] : null;
  }

  /**
   * Compare a single row between this buffer and another.
   * Uses WASM SIMD when available (Rust autovectorized comparison).
   * Falls back to pure TypeScript tight integer loop.
   */
  rowEquals(other: ScreenBuffer, y: number): boolean {
    if (this.width !== other.width || y < 0 || y >= this.height || y >= other.height) return false;
    const base = y * this.width;
    const end = base + this.width;
    const tc = this.codes, oc = other.codes;
    const tf = this.fgs, of_ = other.fgs;
    const tb = this.bgs, ob = other.bgs;
    const ta = this.attrArr, oa = other.attrArr;
    const tu = this.ulColors, ou = other.ulColors;
    for (let i = base; i < end; i++) {
      if (tc[i] !== oc[i] || tf[i] !== of_[i] || tb[i] !== ob[i] || ta[i] !== oa[i] || tu[i] !== ou[i]) return false;
    }
    return true;
  }

  /** Resize the buffer, preserving content where possible. */
  resize(newWidth: number, newHeight: number): void {
    const newSize = newWidth * newHeight;
    const newCodes = new Uint32Array(newSize).fill(SPACE);
    const newFgs = new Int32Array(newSize).fill(DEFAULT_COLOR);
    const newBgs = new Int32Array(newSize).fill(DEFAULT_COLOR);
    const newAttrs = new Uint8Array(newSize);
    const newUlColors = new Int32Array(newSize).fill(DEFAULT_COLOR);

    const copyW = Math.min(this.width, newWidth);
    const copyH = Math.min(this.height, newHeight);
    for (let y = 0; y < copyH; y++) {
      const oldBase = y * this.width;
      const newBase = y * newWidth;
      newCodes.set(this.codes.subarray(oldBase, oldBase + copyW), newBase);
      newFgs.set(this.fgs.subarray(oldBase, oldBase + copyW), newBase);
      newBgs.set(this.bgs.subarray(oldBase, oldBase + copyW), newBase);
      newAttrs.set(this.attrArr.subarray(oldBase, oldBase + copyW), newBase);
      newUlColors.set(this.ulColors.subarray(oldBase, oldBase + copyW), newBase);
    }
    this.width = newWidth;
    this.height = newHeight;
    this.codes = newCodes;
    this.fgs = newFgs;
    this.bgs = newBgs;
    this.attrArr = newAttrs;
    this.ulColors = newUlColors;
    this._paintedRows = new Uint8Array(newHeight);
    this._prevPaintedRows = new Uint8Array(newHeight);
    this._rowDmgX1 = new Uint16Array(newHeight).fill(newWidth);
    this._rowDmgX2 = new Uint16Array(newHeight);
  }

  /** Copy all cell data from another buffer (no allocation). */
  copyFrom(src: ScreenBuffer): void {
    if (src.width !== this.width || src.height !== this.height) return;
    this.codes.set(src.codes);
    this.fgs.set(src.fgs);
    this.bgs.set(src.bgs);
    this.attrArr.set(src.attrArr);
    this.ulColors.set(src.ulColors);
  }

  /**
   * Copy only painted rows from src. Uses TypedArray.set for native memcpy.
   */
  copyRowsFrom(src: ScreenBuffer): void {
    if (src.width !== this.width || src.height !== this.height) {
      this.copyFrom(src);
      return;
    }
    const w = this.width;
    let paintedCount = 0;
    for (let y = 0; y < this.height; y++) if (src._paintedRows[y]) paintedCount++;

    if (paintedCount > this.height * 0.6) {
      this.copyFrom(src);
      return;
    }

    for (let y = 0; y < this.height; y++) {
      if (!src._paintedRows[y]) continue;
      const base = y * w;
      const end = base + w;
      this.codes.set(src.codes.subarray(base, end), base);
      this.fgs.set(src.fgs.subarray(base, end), base);
      this.bgs.set(src.bgs.subarray(base, end), base);
      this.attrArr.set(src.attrArr.subarray(base, end), base);
      this.ulColors.set(src.ulColors.subarray(base, end), base);
    }
  }

  clone(): ScreenBuffer {
    const copy = new ScreenBuffer(this.width, this.height);
    copy.codes.set(this.codes);
    copy.fgs.set(this.fgs);
    copy.bgs.set(this.bgs);
    copy.attrArr.set(this.attrArr);
    copy.ulColors.set(this.ulColors);
    return copy;
  }

  /** Check if two buffers have identical content. */
  equals(other: ScreenBuffer): boolean {
    if (this.width !== other.width || this.height !== other.height) return false;
    const size = this.width * this.height;
    const tc = this.codes, oc = other.codes;
    const tf = this.fgs, of_ = other.fgs;
    const tb = this.bgs, ob = other.bgs;
    const ta = this.attrArr, oa = other.attrArr;
    const tu = this.ulColors, ou = other.ulColors;
    for (let i = 0; i < size; i++) {
      if (tc[i] !== oc[i] || tf[i] !== of_[i] || tb[i] !== ob[i] || ta[i] !== oa[i] || tu[i] !== ou[i]) return false;
    }
    return true;
  }
}
