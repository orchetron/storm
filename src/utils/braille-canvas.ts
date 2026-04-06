// Braille dot bit positions:
// Col 0: dots 1,2,3,7 (bits 0,1,2,6)
// Col 1: dots 4,5,6,8 (bits 3,4,5,7)
const BRAILLE_BITS: readonly [readonly number[], readonly number[]] = [
  [0x01, 0x02, 0x04, 0x40], // left column: rows 0-3
  [0x08, 0x10, 0x20, 0x80], // right column: rows 0-3
];

const BRAILLE_BASE = 0x2800;

export { BRAILLE_BASE };

export class BrailleCanvas {
  /** Cell dimensions (terminal characters). */
  readonly cols: number;
  readonly rows: number;

  /** Pixel dimensions (sub-dot resolution). */
  readonly pxWidth: number;
  readonly pxHeight: number;

  /** Cell grid storing accumulated braille bits. */
  private readonly grid: Uint8Array;

  /** Per-cell color (last writer wins). */
  private readonly colors: (string | number | null)[];

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.pxWidth = cols * 2;
    this.pxHeight = rows * 4;
    this.grid = new Uint8Array(cols * rows);
    this.colors = new Array<string | number | null>(cols * rows).fill(null);
  }

  /**
   * Set a single sub-pixel dot. Coordinates are in pixel space:
   *   px: 0 .. pxWidth-1   (left to right)
   *   py: 0 .. pxHeight-1  (top to bottom)
   */
  set(px: number, py: number, color?: string | number): void {
    if (px < 0 || px >= this.pxWidth || py < 0 || py >= this.pxHeight) return;

    const col = Math.floor(px / 2);
    const row = Math.floor(py / 4);
    const dx = px % 2;
    const dy = py % 4;
    const idx = row * this.cols + col;

    this.grid[idx]! |= BRAILLE_BITS[dx]![dy]!;
    if (color !== undefined) this.colors[idx] = color;
  }

  /**
   * Draw a line between two pixel coordinates using Bresenham's algorithm.
   * Produces clean, connected lines with no gaps.
   */
  line(x0: number, y0: number, x1: number, y1: number, color?: string | number): void {
    let ix0 = Math.round(x0);
    let iy0 = Math.round(y0);
    const ix1 = Math.round(x1);
    const iy1 = Math.round(y1);

    const dx = Math.abs(ix1 - ix0);
    const dy = Math.abs(iy1 - iy0);
    const sx = ix0 < ix1 ? 1 : -1;
    const sy = iy0 < iy1 ? 1 : -1;
    let err = dx - dy;

    for (;;) {
      this.set(ix0, iy0, color);

      if (ix0 === ix1 && iy0 === iy1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        ix0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        iy0 += sy;
      }
    }
  }

  /** Fill all pixels below a given y coordinate in a column (for area charts). */
  fillBelow(px: number, py: number, color?: string | number): void {
    for (let y = py; y < this.pxHeight; y++) {
      this.set(px, y, color);
    }
  }

  /**
   * Get the braille character at cell (col, row).
   * Returns an empty braille character (U+2800) if the cell has no dots.
   */
  getChar(col: number, row: number): string {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return " ";
    return String.fromCharCode(BRAILLE_BASE + (this.grid[row * this.cols + col] ?? 0));
  }

  /** Get the color at cell (col, row). */
  getColor(col: number, row: number): string | number | null {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    return this.colors[row * this.cols + col] ?? null;
  }

  /**
   * Render the canvas to an array of strings, one per cell row.
   * Each string is `this.cols` characters long.
   */
  render(): string[] {
    const lines: string[] = [];
    for (let r = 0; r < this.rows; r++) {
      let line = "";
      for (let c = 0; c < this.cols; c++) {
        const bits = this.grid[r * this.cols + c]!;
        line += String.fromCharCode(BRAILLE_BASE + bits);
      }
      lines.push(line);
    }
    return lines;
  }

  /** Clear the canvas, resetting all dots and colors. */
  clear(): void {
    this.grid.fill(0);
    this.colors.fill(null);
  }
}
