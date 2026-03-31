/**
 * Screenshot Plugin — capture the current screen as SVG.
 *
 * Listens for Ctrl+Shift+S and writes the current buffer state to
 * an SVG file using the built-in SVG renderer. Files are named with
 * timestamps and saved to the current directory (configurable).
 */

import * as fs from "fs";
import * as path from "path";
import type { StormPlugin } from "../core/plugin.js";
import type { KeyEvent } from "../input/types.js";
import type { ScreenBuffer } from "../core/buffer.js";
import type { RenderContext } from "../core/render-context.js";

export interface ScreenshotPluginOptions {
  /** Directory to save screenshots (default: current working directory). */
  outputDir?: string;
  /** File name prefix (default: "storm-screenshot"). */
  prefix?: string;
  /** SVG font size in pixels (default: 14). */
  fontSize?: number;
  /** SVG font family (default: "Menlo, Monaco, monospace"). */
  fontFamily?: string;
  /** SVG background color (default: "#0B0E14"). */
  backgroundColor?: string;
  /** SVG padding in pixels (default: 16). */
  padding?: number;
  /** Callback invoked after a screenshot is saved. */
  onCapture?: (filePath: string) => void;
}

/**
 * Create a screenshot plugin with the given options.
 *
 * @example
 * ```ts
 * import { render, screenshotPlugin } from "@orchetron/storm-tui";
 *
 * const app = render(<App />, {
 *   plugins: [screenshotPlugin({ outputDir: "./screenshots" })],
 * });
 * ```
 */
export function screenshotPlugin(options: ScreenshotPluginOptions = {}): StormPlugin {
  const outputDir = options.outputDir ?? process.cwd();
  const prefix = options.prefix ?? "storm-screenshot";
  const fontSize = options.fontSize ?? 14;
  const fontFamily = options.fontFamily ?? "Menlo, Monaco, monospace";
  const backgroundColor = options.backgroundColor ?? "#0B0E14";
  const padding = options.padding ?? 16;

  let renderContext: RenderContext | null = null;

  return {
    name: "screenshot",

    setup(ctx) {
      renderContext = ctx.renderContext;
    },

    onKey(event: KeyEvent): KeyEvent | null {
      // Ctrl+Shift+S triggers a screenshot
      if (event.key === "S" && event.ctrl && event.shift && !event.meta) {
        captureScreenshot();
        return null; // consume the event
      }
      return event;
    },

    cleanup() {
      renderContext = null;
    },
  };

  function captureScreenshot(): void {
    if (!renderContext) return;

    const buffer = renderContext.buffer;
    if (!buffer) {
      process.stderr.write("[storm-tui/screenshot] No buffer available — skipping capture.\n");
      return;
    }

    const svg = bufferToSvg(buffer);

    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${prefix}-${timestamp}.svg`;
    const filePath = path.join(outputDir, fileName);

    fs.writeFileSync(filePath, svg, "utf-8");

    if (options.onCapture) {
      options.onCapture(filePath);
    } else {
      process.stderr.write(`[storm-tui/screenshot] Saved: ${filePath}\n`);
    }
  }

  function bufferToSvg(buffer: ScreenBuffer): string {
    const charWidthPx = fontSize * 0.6;
    const lineHeight = fontSize * 1.2;
    const svgWidth = buffer.width * charWidthPx + padding * 2;
    const svgHeight = buffer.height * lineHeight + padding * 2;

    const parts: string[] = [];

    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`,
    );

    // Background
    parts.push(
      `<rect width="${svgWidth}" height="${svgHeight}" fill="${escapeXml(backgroundColor)}" />`,
    );

    // Render each row from the buffer
    for (let row = 0; row < buffer.height; row++) {
      const y = padding + (row + 1) * lineHeight - fontSize * 0.2;

      // Group runs of characters with identical styling
      let runStart = 0;
      let runFg = fgHex(buffer, 0, row);
      let runBold = isBold(buffer, 0, row);
      let runChars = "";

      for (let col = 0; col < buffer.width; col++) {
        const ch = buffer.getChar(col, row);
        const fg = fgHex(buffer, col, row);
        const bold = isBold(buffer, col, row);

        if (fg !== runFg || bold !== runBold) {
          // Flush the current run
          if (runChars.length > 0) {
            parts.push(buildTextSpan(runStart, y, runChars, runFg, runBold, charWidthPx));
          }
          runStart = col;
          runFg = fg;
          runBold = bold;
          runChars = ch;
        } else {
          runChars += ch;
        }
      }

      // Flush last run
      if (runChars.length > 0) {
        parts.push(buildTextSpan(runStart, y, runChars, runFg, runBold, charWidthPx));
      }
    }

    parts.push("</svg>");
    return parts.join("\n");
  }

  function buildTextSpan(
    col: number,
    y: number,
    text: string,
    fg: string,
    bold: boolean,
    charWidthPx: number,
  ): string {
    const x = padding + col * charWidthPx;
    const weight = bold ? ' font-weight="bold"' : "";
    return `<text x="${x}" y="${y}" font-family="${escapeXml(fontFamily)}" font-size="${fontSize}"${weight} fill="${fg}">${escapeXml(text)}</text>`;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

const DEFAULT_COLOR = -1;

function fgHex(buffer: ScreenBuffer, x: number, y: number): string {
  const fg = buffer.getFg(x, y);
  if (fg === DEFAULT_COLOR) return "#D4D4D4"; // default terminal fg
  // Convert packed RGB int to hex
  const r = (fg >> 16) & 0xff;
  const g = (fg >> 8) & 0xff;
  const b = fg & 0xff;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function isBold(buffer: ScreenBuffer, x: number, y: number): boolean {
  // Attr.BOLD = 1 << 0 = 1
  return (buffer.getAttrs(x, y) & 1) !== 0;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
