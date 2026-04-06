import { createRequire } from "node:module";
import { DEFAULT_COLOR, Attr } from "./types.js";
import { cursorTo, fullSgr, diffSgr, bgColor, RESET, CURSOR_HIDE, CURSOR_SHOW, CSI, SYNC_START, SYNC_END } from "./ansi.js";
import { ScreenBuffer, WIDE_CHAR_PLACEHOLDER } from "./buffer.js";
import type { LinkRange, RenderContext, ScrollViewFrame } from "./render-context.js";

/** Rainbow background colors (ANSI 256-color) for debug overlay. */
const RAINBOW_COLORS = [196, 208, 226, 46, 51, 21, 93, 201];

export interface DiffResult {
  /** ANSI output string to write to stdout. */
  output: string;
  /** Number of lines that changed in this frame. */
  changedLines: number;
  /** Total number of lines in the buffer. */
  totalLines: number;
}

// Try to load the Rust WASM module for renderLine (3.4x faster).
// Falls back to TypeScript if WASM is not available. Zero dependency.
// Uses createRequire to load CJS module from ESM context (Node.js official pattern).
let wasmModule: any = null;
try {
  const esmRequire = createRequire(import.meta.url);
  wasmModule = esmRequire("../../wasm/pkg/storm_wasm.js");
} catch {
  // WASM not available — pure TypeScript path (still fast)
}

/** Check if WASM acceleration is active */
export function isWasmAccelerated(): boolean {
  return wasmModule !== null;
}

export class DiffRenderer {
  private prevLines: string[] = [];
  private prevBuffer: ScreenBuffer | null = null;
  private bufferA: ScreenBuffer | null = null;
  private bufferB: ScreenBuffer | null = null;
  private cursorVisible = true;
  private debugRainbow = false;
  private rainbowIndex = 0;
  private wasmBuffer: any = null; // WasmBuffer mirror for WASM renderLine

  constructor(_width: number, _height: number) {
    // Width/height are accepted for API compatibility but not stored —
    // render() uses buffer dimensions directly.
  }

  /** Enable or disable debug rainbow mode — changed lines get a cycling background color. */
  setDebugRainbow(enabled: boolean): void {
    this.debugRainbow = enabled;
  }

  /** Swap double buffers instead of cloning — avoids allocation every frame.
   *  Handles dimension mismatches (e.g. terminal resize) by reallocating. */
  private swapPrevBuffer(next: ScreenBuffer): void {
    if (!this.bufferA) {
      this.bufferA = next.clone();
      this.prevBuffer = this.bufferA;
    } else if (!this.bufferB) {
      this.bufferB = next.clone();
      this.prevBuffer = this.bufferB;
    } else {
      let target = this.prevBuffer === this.bufferA ? this.bufferB : this.bufferA;
      // Ensure target buffer matches dimensions — copyFrom no-ops on mismatch
      if (target.width !== next.width || target.height !== next.height) {
        target = new ScreenBuffer(next.width, next.height);
        if (this.prevBuffer === this.bufferA) {
          this.bufferB = target;
        } else {
          this.bufferA = target;
        }
      }
      target.copyRowsFrom(next);
      this.prevBuffer = target;
    }
  }

  /**
   * Diff next buffer against the previous frame and emit minimal ANSI.
   * Pass 1: identify changed rows (cheap cell comparison).
   * Pass 2: render changed rows -- WASM for sparse updates, TS for full repaints.
   * Cell-level diffing kicks in when <50% of rows changed; emits only changed runs.
   * Output is wrapped in synchronized update (DCS) for flicker-free atomic write.
   */
  render(next: ScreenBuffer, links: LinkRange[] = [], ctx?: RenderContext): DiffResult {
    // Try scroll region optimization first — ONLY for pure scroll (no content change).
    // When content changes simultaneously (e.g., message added + stickToBottom),
    // DECSTBM shifts OLD terminal content which doesn't match the new buffer.
    // Fall through to the full diff path which correctly handles both changes.
    if (ctx && !ctx.layoutInvalidated) {
      const scrollCommand = this.tryScrollRegion(ctx, next, links);
      if (scrollCommand) {
        // Always update prevBuffer — tryScrollRegion only updates scroll region rows,
        // but we need the full buffer state for the next frame's cell-level diff.
        this.swapPrevBuffer(next);
        return { output: scrollCommand, changedLines: 0, totalLines: next.height };
      }
    }

    const h = next.height;
    const w = next.width;

    // Index links by row for fast lookup
    const linksByRow = new Map<number, LinkRange[]>();
    for (const link of links) {
      let arr = linksByRow.get(link.y);
      if (!arr) {
        arr = [];
        linksByRow.set(link.y, arr);
      }
      arr.push(link);
    }

    const wasmAvailable = wasmModule !== null;
    if (wasmAvailable) {
      if (!this.wasmBuffer || this.wasmBuffer.get_width() !== w || this.wasmBuffer.get_height() !== h) {
        this.wasmBuffer = new wasmModule.WasmBuffer(w, h);
      }
    }

    // Two-pass approach for adaptive WASM/TS switching:
    // Pass 1: count changed rows (cheap cell comparison)
    // Pass 2: render changed rows with the best path
    //
    // WASM wins on scroll (few rows → low boundary-crossing overhead, 75x less GC)
    // TS wins on full repaint (many rows → boundary-crossing overhead > renderLine savings)
    // Threshold: use WASM when ≤ 30% of rows changed

    const nextLines: string[] = [];
    const changedRows: boolean[] = [];
    let changedCount = 0;

    // Pass 1: identify changed rows (skip unpainted rows)
    for (let y = 0; y < h; y++) {
      if (!next.wasRowPainted(y)) {
        changedRows.push(false);
      } else if (this.prevBuffer && next.rowEquals(this.prevBuffer, y)) {
        changedRows.push(false);
      } else {
        changedRows.push(true);
        changedCount++;
      }
    }

    // Adaptive: use WASM for scroll-like frames (few changes), TS for full repaints
    const useWasm = wasmAvailable && changedCount <= Math.ceil(h * 0.3);

    // Pass 2: render
    for (let y = 0; y < h; y++) {
      if (!changedRows[y]) {
        nextLines.push(this.prevLines[y] ?? "");
      } else {
        const hasLinks = linksByRow.has(y);
        // WASM set_cell/render_line don't support ulColor — if any cell on
        // this row has a non-default underline color, fall back to the TS
        // path so the color is emitted correctly.
        let rowHasUlColor = false;
        if (useWasm && !hasLinks) {
          const row = next.getRowRaw(y);
          if (row) {
            for (let x = 0; x < w; x++) {
              if (row.ulColors[row.base + x] !== DEFAULT_COLOR) {
                rowHasUlColor = true;
                break;
              }
            }
          }
        }
        if (useWasm && !hasLinks && !rowHasUlColor) {
          // WASM fast path: fewer rows = less boundary crossing = net win + less GC
          for (let x = 0; x < w; x++) {
            this.wasmBuffer.set_cell(x, y, next.getChar(x, y).codePointAt(0) ?? 32, next.getFg(x, y), next.getBg(x, y), next.getAttrs(x, y));
          }
          nextLines.push(wasmModule.render_line(this.wasmBuffer, y));
        } else {
          // TS path: full repaints, rows with links, or WASM unavailable
          nextLines.push(this.renderLine(next, y, w, linksByRow.get(y)));
        }
      }
    }

    // changedCount here counts rows with cell changes, but some may produce
    // the same ANSI string (e.g. style change that resolves identically).
    // Re-check actual string equality for the final diff output.
    let actualChanged = 0;
    for (let y = 0; y < h; y++) {
      if (nextLines[y] !== this.prevLines[y]) actualChanged++;
    }

    if (actualChanged === 0) {
      this.prevLines = nextLines;
      this.swapPrevBuffer(next);
      return { output: "", changedLines: 0, totalLines: h };
    }

    changedCount = actualChanged;

    // Three rendering paths, selected by situation:
    //
    // 1. CELL-LEVEL DIFF (few changes, prevBuffer available, not WASM/link rows):
    //    Compare cell-by-cell, emit only changed runs with cursor positioning.
    //    This is the primary path for typing, cursor blink, scrollbar updates.
    //
    // 2. FULL-LINE REPLACEMENT (many changes, or fallback):
    //    Used when >50% of rows changed (cheaper than many cursor jumps).
    //
    // 3. WASM lines and link rows always produce full renderLine strings,
    //    so those rows use full-line replacement even in cell-diff mode.

    const manyChanged = changedCount > h * 0.5;

    // Can we use cell-level diffing? Need prevBuffer AND few changed rows.
    const useCellDiff = !manyChanged && this.prevBuffer !== null;

    const parts: string[] = [];
    parts.push(SYNC_START);
    if (this.cursorVisible) parts.push(CURSOR_HIDE);

    const imageSkipRows = new Set<number>();
    if (ctx?.imageRegions) {
      for (const [row, ranges] of ctx.imageRegions) {
        for (const r of ranges) {
          if (r.x1 <= 0 && r.x2 >= w) imageSkipRows.add(row);
        }
      }
    }

    if (useCellDiff) {
      // ── Cell-level diff path ──────────────────────────────────
      const prev = this.prevBuffer!;
      for (let y = 0; y < h; y++) {
        if (imageSkipRows.has(y)) continue;
        // Fast path: row-level check already passed — skip entirely
        if (nextLines[y] === this.prevLines[y]) continue;

        let debugColor: number | null = null;
        if (this.debugRainbow) {
          debugColor = RAINBOW_COLORS[this.rainbowIndex % RAINBOW_COLORS.length]!;
          this.rainbowIndex++;
        }

        // If this row was rendered by WASM, we don't have the prev
        // buffer's rendered string to compare cells — we already have
        // the full ANSI line. Use full-line replacement for this row.
        // (WASM rows are only used when useWasm is true, meaning
        // changedCount <= 30%, so we're always in cell-diff mode here
        // only if manyChanged is false.)
        //
        // For rows with links, renderChangedCells handles the fallback
        // internally (it calls renderLine for link rows).
        const rowLinks = linksByRow.get(y);
        if (prev.width === next.width && y < prev.height) {
          // Cell-level diff: emit only changed cells.
          // If this row has links, renderChangedCells handles the
          // fallback to renderLine internally.
          this.renderChangedCells(next, prev, y, w, rowLinks, parts, debugColor);
        } else {
          // Full-line fallback: dimension mismatch or out-of-bounds prev row
          parts.push(cursorTo(y, 0));
          if (debugColor !== null) parts.push(bgColor(debugColor));
          parts.push(nextLines[y]!);
          // Only clear to EOL if line doesn't fill full width — writing to the
          // last column and then emitting CSI K triggers terminal auto-wrap.
          if (!this.lineFullWidth(next, y, w)) parts.push(`${CSI}K`);
        }
      }
    } else {
      // ── Full-line replacement path ────────────────────────────
      // Many rows changed or no prevBuffer — write full lines.
      // Always use cursor positioning per line — never \n (which can
      // cause scroll artifacts at the bottom of alternate screen buffer).
      for (let y = 0; y < h; y++) {
        if (imageSkipRows.has(y)) continue;
        if (!manyChanged && nextLines[y] === this.prevLines[y]) continue;
        parts.push(cursorTo(y, 0));
        if (this.debugRainbow) {
          const color = RAINBOW_COLORS[this.rainbowIndex % RAINBOW_COLORS.length]!;
          parts.push(bgColor(color));
          this.rainbowIndex++;
        }
        parts.push(nextLines[y]!);
        if (!this.lineFullWidth(next, y, w)) parts.push(`${CSI}K`);
      }
    }

    parts.push(RESET);
    if (this.cursorVisible) parts.push(CURSOR_SHOW);
    parts.push(SYNC_END);
    const out = parts.join("");

    this.prevLines = nextLines;
    this.swapPrevBuffer(next);
    return { output: out, changedLines: changedCount, totalLines: h };
  }

  /**
   * Render only the changed cells of a row, comparing against prevBuffer.
   *
   * Algorithm:
   *  1. Walk cells left-to-right, comparing next vs prev buffer
   *  2. Collect consecutive changed cells into "runs"
   *  3. For each run: emit cursor-position + SGR + characters
   *  4. Unchanged cells produce zero output (no cursor movement needed)
   *
   * This avoids rewriting an entire 200-column row when only a cursor blinks.
   * Returns the ANSI fragments to write (caller handles SYNC wrapping).
   *
   * Link handling: if any link spans the row, we fall back to renderLine
   * since OSC 8 open/close must bracket entire link ranges correctly.
   */
  private renderChangedCells(
    next: ScreenBuffer,
    prev: ScreenBuffer,
    y: number,
    w: number,
    rowLinks: LinkRange[] | undefined,
    parts: string[],
    debugRainbowColor: number | null,
  ): void {
    // ── Identify runs of changed cells ────────────────────────────
    //
    // A "run" is a maximal sequence of consecutive columns where at least
    // one cell property differs between next and prev. We collect all runs
    // first, then emit them. This two-pass approach lets us avoid emitting
    // anything for rows where all "changes" cancel out (e.g., same content
    // written twice).

    interface CellRun {
      startX: number;
      endX: number; // exclusive
    }

    const runs: CellRun[] = [];
    let runStart = -1;

    // Unpack raw arrays once — avoids 5 getter calls + bounds checks per cell
    const nRow = next.getRowRaw(y);
    const pRow = prev.getRowRaw(y);

    for (let x = 0; x < w; x++) {
      let changed: boolean;
      if (nRow && pRow) {
        const ni = nRow.base + x, pi = pRow.base + x;
        changed = nRow.codes[ni] !== pRow.codes[pi] || nRow.fgs[ni] !== pRow.fgs[pi] ||
          nRow.bgs[ni] !== pRow.bgs[pi] || nRow.attrs[ni] !== pRow.attrs[pi] || nRow.ulColors[ni] !== pRow.ulColors[pi];
      } else {
        changed = next.getChar(x, y) !== prev.getChar(x, y) || next.getFg(x, y) !== prev.getFg(x, y) ||
          next.getBg(x, y) !== prev.getBg(x, y) || next.getAttrs(x, y) !== prev.getAttrs(x, y) ||
          next.getUlColor(x, y) !== prev.getUlColor(x, y);
      }

      if (changed) {
        if (runStart < 0) runStart = x;
      } else {
        if (runStart >= 0) {
          runs.push({ startX: runStart, endX: x });
          runStart = -1;
        }
      }
    }
    // Close trailing run
    if (runStart >= 0) {
      runs.push({ startX: runStart, endX: w });
    }

    if (runs.length === 0) return; // all cells identical — nothing to emit

    // ── Merge runs that are close together ────────────────────────
    // If two runs are separated by a small gap (< 4 unchanged cells),
    // it's cheaper to emit the gap chars than the cursor-position escape.
    // A cursor-position sequence like "\x1b[1;50H" is 7-9 bytes.
    // A few plain characters are 1 byte each, plus possible SGR.
    const GAP_MERGE_THRESHOLD = 4;
    const merged: CellRun[] = [runs[0]!];
    for (let i = 1; i < runs.length; i++) {
      const last = merged[merged.length - 1]!;
      const curr = runs[i]!;
      if (curr.startX - last.endX <= GAP_MERGE_THRESHOLD) {
        // Merge: extend previous run to cover the gap and current run
        last.endX = curr.endX;
      } else {
        merged.push(curr);
      }
    }

    // Links require exact open/close bracketing across cell ranges.
    // Cell-level diffing could leave a link partially open.
    // Only fall back to full-line rendering if a link actually overlaps
    // the changed cell range — links elsewhere on the row don't need it.
    if (rowLinks && rowLinks.length > 0) {
      const hasOverlappingLink = rowLinks.some(link =>
        link.x2 > merged[0]!.startX && link.x1 < merged[merged.length - 1]!.endX
      );
      if (hasOverlappingLink) {
        parts.push(cursorTo(y, 0));
        if (debugRainbowColor !== null) parts.push(bgColor(debugRainbowColor));
        parts.push(this.renderLine(next, y, w, rowLinks));
        if (!this.lineFullWidth(next, y, w)) parts.push(`${CSI}K`);
        return;
      }
    }

    // ── Emit each run ─────────────────────────────────────────────
    // For each run, position the cursor and emit styled characters.
    // We track SGR state across cells within a run to use diffSgr
    // (minimizing escape sequences).
    for (const run of merged) {
      parts.push(cursorTo(y, run.startX));
      if (debugRainbowColor !== null) parts.push(bgColor(debugRainbowColor));

      // SGR state tracker — starts at "reset" state (or rainbow bg if active)
      let curFg = DEFAULT_COLOR;
      let curBg = debugRainbowColor !== null ? debugRainbowColor : DEFAULT_COLOR;
      let curAttrs: number = Attr.NONE;
      let curUlColor = DEFAULT_COLOR;

      for (let x = run.startX; x < run.endX; x++) {
        const ch = next.getChar(x, y);
        const fg = next.getFg(x, y);
        const bg = next.getBg(x, y);
        const attrs = next.getAttrs(x, y);
        const ulColor = next.getUlColor(x, y);

        // Skip wide-char placeholder cells — the terminal renders the wide
        // char as 2 columns with the wide char's own attributes. The
        // placeholder's attributes don't affect terminal rendering.
        if (ch === WIDE_CHAR_PLACEHOLDER) continue;

        if (fg !== curFg || bg !== curBg || attrs !== curAttrs || ulColor !== curUlColor) {
          // When ulColor changes, we need a full SGR reset+set to ensure
          // the underline color is correctly applied
          if (ulColor !== curUlColor) {
            parts.push(fullSgr(fg, bg, attrs, ulColor));
          } else {
            const sgr = diffSgr(curFg, curBg, curAttrs, fg, bg, attrs);
            if (sgr) parts.push(sgr);
          }
          curFg = fg;
          curBg = bg;
          curAttrs = attrs;
          curUlColor = ulColor;
        }

        parts.push(ch);
      }

      // After each run, reset SGR so next run starts clean.
      // This prevents style leaking into characters the terminal
      // might paint when the cursor moves.
      if (curFg !== DEFAULT_COLOR || curBg !== DEFAULT_COLOR || curAttrs !== Attr.NONE || curUlColor !== DEFAULT_COLOR) {
        parts.push(RESET);
      }

      // If this run extends to the end of the row, clear remainder — but only
      // if the line doesn't fill full width. Writing to the last column and
      // then emitting CSI K triggers terminal auto-wrap.
      if (run.endX >= w && !this.lineFullWidth(next, y, w)) {
        parts.push(`${CSI}K`);
      }
    }
  }

  /**
   * Check if a row fills the full terminal width (last column has non-default content).
   * When true, emitting \x1b[K after the line would trigger terminal auto-wrap on the
   * last column, corrupting cursor position.
   */
  private lineFullWidth(buf: ScreenBuffer, y: number, w: number): boolean {
    if (w <= 0) return false;
    const row = buf.getRowRaw(y);
    if (!row) return false;
    const i = row.base + w - 1;
    return (
      row.codes[i] !== 0x20 ||
      row.fgs[i] !== DEFAULT_COLOR ||
      row.bgs[i] !== DEFAULT_COLOR ||
      row.attrs[i] !== Attr.NONE ||
      row.ulColors[i] !== DEFAULT_COLOR
    );
  }

  /** Render one row to a styled string with minimal ANSI. */
  private renderLine(buf: ScreenBuffer, y: number, w: number, rowLinks?: LinkRange[]): string {
    if (y < 0 || y >= buf.height) return "";

    const row = buf.getRowRaw(y);
    if (!row) return "";
    const { codes: rc, fgs: rf, bgs: rb, attrs: ra, ulColors: ru, base } = row;

    const parts: string[] = [];
    let curFg = DEFAULT_COLOR;
    let curBg = DEFAULT_COLOR;
    let curAttrs: number = Attr.NONE;
    let curUlColor = DEFAULT_COLOR;
    let needsReset = false;
    let inLink = false;

    let last = 0;
    for (let x = w - 1; x >= 0; x--) {
      const i = base + x;
      if (rc[i] !== 0x20 || rf[i] !== DEFAULT_COLOR || rb[i] !== DEFAULT_COLOR || ra[i] !== Attr.NONE || ru[i] !== DEFAULT_COLOR) {
        last = x + 1;
        break;
      }
    }

    for (let x = 0; x < last; x++) {
      const i = base + x;
      const code = rc[i]!;
      const cFg = rf[i]!;
      const cBg = rb[i]!;
      const cAttrs = ra[i]!;
      const cUlColor = ru[i]!;
      if (code === 0) continue; // skip wide-char placeholder — wide char covers both columns
      const cChar = code === 0x20 ? " " : String.fromCodePoint(code);

      if (rowLinks) {
        // Close link if we've passed its end
        if (inLink) {
          const activeLink = rowLinks.find(l => x >= l.x1 && x < l.x2);
          if (!activeLink) {
            parts.push(`\x1b]8;;\x1b\\`);
            inLink = false;
          }
        }
        // Open link if we're entering a link range
        if (!inLink) {
          const link = rowLinks.find(l => x >= l.x1 && x < l.x2);
          if (link) {
            parts.push(`\x1b]8;;${link.url}\x1b\\`);
            inLink = true;
          }
        }
      }

      if (cFg !== curFg || cBg !== curBg || cAttrs !== curAttrs || cUlColor !== curUlColor) {
        if (cUlColor !== curUlColor) {
          // Full reset + set when underline color changes
          parts.push(fullSgr(cFg, cBg, cAttrs, cUlColor));
        } else {
          const sgr = diffSgr(curFg, curBg, curAttrs, cFg, cBg, cAttrs);
          if (sgr) parts.push(sgr);
        }
        curFg = cFg;
        curBg = cBg;
        curAttrs = cAttrs;
        curUlColor = cUlColor;
        needsReset = curFg !== DEFAULT_COLOR || curBg !== DEFAULT_COLOR || curAttrs !== Attr.NONE || curUlColor !== DEFAULT_COLOR;
      }

      parts.push(cChar);
    }

    // Close any open link
    if (inLink) {
      parts.push(`\x1b]8;;\x1b\\`);
    }

    if (needsReset) {
      parts.push(RESET);
    }
    return parts.join("");
  }

  /**
   * Detect if this frame is a pure scroll operation.
   * Returns the scroll command string if so, null otherwise.
   * A pure scroll: only one ScrollView's scrollTop changed,
   * the ScrollView fills full width, and content didn't change.
   */
  tryScrollRegion(
    ctx: RenderContext,
    next: ScreenBuffer,
    _links?: LinkRange[],
  ): string | null {
    const prev = ctx.prevScrollViewStates;
    const curr = ctx.scrollViewStates;

    if (prev.size === 0 || curr.size === 0) return null;

    let scrolled: { id: string; prev: ScrollViewFrame; curr: ScrollViewFrame } | null = null;

    for (const [id, currState] of curr) {
      const prevState = prev.get(id);
      if (!prevState) continue;

      if (currState.scrollTop !== prevState.scrollTop) {
        if (scrolled) return null; // Multiple scrolls — can't optimize
        scrolled = { id, prev: prevState, curr: currState };
      }
    }

    if (!scrolled) return null; // No scroll happened

    const { prev: ps, curr: cs } = scrolled;
    const delta = cs.scrollTop - ps.scrollTop;
    const absDelta = Math.abs(delta);
    // Only optimize small scrolls (1-5 lines)
    if (absDelta > 5 || absDelta === 0) return null;

    // Must fill full width for DECSTBM to work
    if (cs.screenX1 !== 0 || cs.screenX2 !== next.width) return null;

    const parts: string[] = [];

    // Set scroll region (1-indexed)
    parts.push(`\x1b[${cs.screenY1 + 1};${cs.screenY2 + 1}r`);

    // Scroll
    if (delta > 0) {
      // Content scrolled up — new content appears at bottom
      parts.push(`\x1b[${absDelta}S`);
    } else {
      // Content scrolled down — new content appears at top
      parts.push(`\x1b[${absDelta}T`);
    }

    parts.push(`\x1b[r`);

    // Now paint ONLY the newly revealed rows
    if (delta > 0) {
      // Scrolled up — new rows at bottom
      for (let i = 0; i < absDelta; i++) {
        const y = cs.screenY2 - absDelta + 1 + i;
        if (y >= 0 && y < next.height) {
          const line = this.renderLine(next, y, next.width, undefined);
          parts.push(`\x1b[${y + 1};1H`); // Move cursor to row
          parts.push(line);
        }
      }
    } else {
      // Scrolled down — new rows at top
      for (let i = 0; i < absDelta; i++) {
        const y = cs.screenY1 + i;
        if (y >= 0 && y < next.height) {
          const line = this.renderLine(next, y, next.width, undefined);
          parts.push(`\x1b[${y + 1};1H`);
          parts.push(line);
        }
      }
    }

    // Also repaint scrollbar column if present (rightmost column of viewport)
    // Scrollbar changed position — need to repaint it
    for (let y = cs.screenY1; y <= cs.screenY2; y++) {
      const scrollbarX = cs.screenX2 - 1;
      if (scrollbarX >= 0 && this.prevBuffer) {
        const prevChar = this.prevBuffer.getChar(scrollbarX, y);
        const prevFg = this.prevBuffer.getFg(scrollbarX, y);
        const char = next.getChar(scrollbarX, y);
        const fg = next.getFg(scrollbarX, y);
        if (char !== prevChar || fg !== prevFg ||
            next.getBg(scrollbarX, y) !== this.prevBuffer.getBg(scrollbarX, y) ||
            next.getAttrs(scrollbarX, y) !== this.prevBuffer.getAttrs(scrollbarX, y)) {
          parts.push(`\x1b[${y + 1};${scrollbarX + 1}H`);
          parts.push(this.formatCell(next, scrollbarX, y));
        }
      }
    }

    if (this.prevBuffer) {
      for (let y = cs.screenY1; y <= cs.screenY2; y++) {
        for (let x = 0; x < next.width; x++) {
          this.prevBuffer.setCell(x, y, next.getCell(x, y));
        }
      }
    }
    // Only clear affected rows — other rows' ANSI strings are still valid
    for (let y = cs.screenY1; y <= cs.screenY2; y++) {
      this.prevLines[y] = "";
    }

    return parts.join("");
  }

  /** Format a single cell with full SGR styling. */
  private formatCell(buf: ScreenBuffer, x: number, y: number): string {
    const fg = buf.getFg(x, y);
    const bg = buf.getBg(x, y);
    const attrs = buf.getAttrs(x, y);
    const ulColor = buf.getUlColor(x, y);
    const char = buf.getChar(x, y);
    return fullSgr(fg, bg, attrs, ulColor) + char + RESET;
  }

  invalidate(): void { this.prevLines = []; this.prevBuffer = null; this.bufferA = null; this.bufferB = null; }
  resize(_w: number, _h: number): void { this.prevLines = []; this.prevBuffer = null; this.bufferA = null; this.bufferB = null; }
  setCursorVisible(v: boolean): void { this.cursorVisible = v; }
}
