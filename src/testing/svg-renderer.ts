/**
 * Terminal-to-SVG renderer for visual regression testing.
 *
 * Converts rendered terminal output (with ANSI escape codes) to SVG strings,
 * enabling pixel-perfect visual regression snapshots.
 */

export interface SvgOptions {
  /** Font size in pixels (default 14) */
  fontSize?: number;
  /** Line height multiplier (default 1.2) */
  lineHeight?: number;
  /** Font family (default "Menlo, Monaco, monospace") */
  fontFamily?: string;
  /** Background color (default "#0B0E14") */
  backgroundColor?: string;
  /** Padding in pixels (default 16) */
  padding?: number;
}

interface CharStyle {
  fg: string | undefined;
  bg: string | undefined;
  bold: boolean;
  italic: boolean;
  dim: boolean;
  underline: boolean;
}

interface StyledChar {
  char: string;
  style: CharStyle;
}

function defaultCharStyle(): CharStyle {
  return { fg: undefined, bg: undefined, bold: false, italic: false, dim: false, underline: false };
}

/**
 * Parse an ANSI-styled string into an array of arrays of StyledChar (one per line).
 * Handles: 24-bit fg/bg, bold, italic, dim, underline, reset.
 */
function parseAnsi(styledOutput: string): StyledChar[][] {
  const lines: StyledChar[][] = [[]];
  let current = defaultCharStyle();
  let i = 0;

  while (i < styledOutput.length) {
    if (styledOutput[i] === "\x1b" && styledOutput[i + 1] === "[") {
      let j = i + 2;
      while (j < styledOutput.length && !isLetter(styledOutput[j]!)) {
        j++;
      }
      if (j < styledOutput.length) {
        const params = styledOutput.slice(i + 2, j);
        const code = styledOutput[j];
        if (code === "m") {
          applyAnsiParams(params, current);
        }
        i = j + 1;
        continue;
      }
    }

    // Newline handling
    if (styledOutput[i] === "\n") {
      lines.push([]);
      i++;
      continue;
    }

    // Regular character
    if (styledOutput[i] !== undefined) {
      lines[lines.length - 1]!.push({
        char: styledOutput[i]!,
        style: { ...current },
      });
    }
    i++;
  }

  return lines;
}

function isLetter(ch: string): boolean {
  return (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z");
}

function applyAnsiParams(params: string, style: CharStyle): void {
  if (params === "" || params === "0") {
    style.fg = undefined;
    style.bg = undefined;
    style.bold = false;
    style.italic = false;
    style.dim = false;
    style.underline = false;
    return;
  }

  const parts = params.split(";");
  let idx = 0;

  while (idx < parts.length) {
    const p = parseInt(parts[idx]!, 10);

    if (p === 0) {
      style.fg = undefined;
      style.bg = undefined;
      style.bold = false;
      style.italic = false;
      style.dim = false;
      style.underline = false;
    } else if (p === 1) {
      style.bold = true;
    } else if (p === 2) {
      style.dim = true;
    } else if (p === 3) {
      style.italic = true;
    } else if (p === 4) {
      style.underline = true;
    } else if (p === 38 && parts[idx + 1] === "2") {
      // 24-bit foreground: 38;2;r;g;b
      const r = parts[idx + 2];
      const g = parts[idx + 3];
      const b = parts[idx + 4];
      if (r !== undefined && g !== undefined && b !== undefined) {
        style.fg = `rgb(${r},${g},${b})`;
      }
      idx += 4;
    } else if (p === 48 && parts[idx + 1] === "2") {
      // 24-bit background: 48;2;r;g;b
      const r = parts[idx + 2];
      const g = parts[idx + 3];
      const b = parts[idx + 4];
      if (r !== undefined && g !== undefined && b !== undefined) {
        style.bg = `rgb(${r},${g},${b})`;
      }
      idx += 4;
    }

    idx++;
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Convert rendered terminal output to SVG string.
 *
 * @param lines - Plain text output lines (used for dimensions)
 * @param styledOutput - ANSI-styled output string
 * @param width - Width of the render area in columns
 * @param height - Height of the render area in rows
 * @param options - SVG rendering options
 * @returns SVG string
 */
export function renderToSvg(
  lines: string[],
  styledOutput: string,
  width: number,
  height: number,
  options?: SvgOptions,
): string {
  const fontSize = options?.fontSize ?? 14;
  const lineHeightMul = options?.lineHeight ?? 1.2;
  const fontFamily = options?.fontFamily ?? "Menlo, Monaco, monospace";
  const backgroundColor = options?.backgroundColor ?? "#0B0E14";
  const padding = options?.padding ?? 16;

  const charWidth = fontSize * 0.6;
  const lineHeight = fontSize * lineHeightMul;

  const svgWidth = width * charWidth + padding * 2;
  const svgHeight = height * lineHeight + padding * 2;

  const parsedLines = parseAnsi(styledOutput);

  const svgParts: string[] = [];

  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`,
  );

  // Background
  svgParts.push(
    `<rect width="${svgWidth}" height="${svgHeight}" fill="${escapeXml(backgroundColor)}" />`,
  );

  for (let lineIdx = 0; lineIdx < parsedLines.length && lineIdx < height; lineIdx++) {
    const parsedLine = parsedLines[lineIdx]!;
    if (parsedLine.length === 0) continue;

    const y = padding + (lineIdx + 1) * lineHeight - fontSize * 0.2;

    // Group characters with the same style into spans
    const spans = buildSpans(parsedLine);

    svgParts.push(`<text x="${padding}" y="${y}" font-family="${escapeXml(fontFamily)}" font-size="${fontSize}">`);

    let xOffset = 0;
    for (const span of spans) {
      const attrs: string[] = [];

      if (span.style.fg) {
        attrs.push(`fill="${escapeXml(span.style.fg)}"`);
      } else {
        attrs.push(`fill="#D4D4D4"`);
      }
      if (span.style.bold) {
        attrs.push(`font-weight="700"`);
      }
      if (span.style.italic) {
        attrs.push(`font-style="italic"`);
      }
      if (span.style.dim) {
        attrs.push(`opacity="0.5"`);
      }
      if (span.style.underline) {
        attrs.push(`text-decoration="underline"`);
      }

      const x = padding + xOffset * charWidth;
      attrs.push(`x="${x}"`);

      svgParts.push(`<tspan ${attrs.join(" ")}>${escapeXml(span.text)}</tspan>`);
      xOffset += span.text.length;
    }

    svgParts.push(`</text>`);

    const bgRects = buildBgRects(parsedLine, lineIdx, charWidth, lineHeight, padding, fontSize);
    if (bgRects.length > 0) {
      // We'll collect them separately and inject them
      for (const rect of bgRects) {
        svgParts.splice(svgParts.length - (spans.length + 2), 0, rect);
      }
    }
  }

  svgParts.push(`</svg>`);

  return svgParts.join("\n");
}

interface TextSpan {
  text: string;
  style: CharStyle;
}

function stylesEqual(a: CharStyle, b: CharStyle): boolean {
  return (
    a.fg === b.fg &&
    a.bg === b.bg &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.dim === b.dim &&
    a.underline === b.underline
  );
}

function buildSpans(chars: StyledChar[]): TextSpan[] {
  if (chars.length === 0) return [];

  const spans: TextSpan[] = [];
  let current: TextSpan = { text: chars[0]!.char, style: { ...chars[0]!.style } };

  for (let i = 1; i < chars.length; i++) {
    const ch = chars[i]!;
    if (stylesEqual(current.style, ch.style)) {
      current.text += ch.char;
    } else {
      spans.push(current);
      current = { text: ch.char, style: { ...ch.style } };
    }
  }
  spans.push(current);

  return spans;
}

function buildBgRects(
  chars: StyledChar[],
  lineIdx: number,
  charW: number,
  lineH: number,
  padding: number,
  fontSize: number,
): string[] {
  const rects: string[] = [];
  let runStart = -1;
  let runBg: string | undefined;

  for (let i = 0; i <= chars.length; i++) {
    const bg = i < chars.length ? chars[i]!.style.bg : undefined;

    if (bg !== runBg) {
      if (runBg !== undefined && runStart >= 0) {
        const x = padding + runStart * charW;
        const y = padding + lineIdx * lineH;
        const w = (i - runStart) * charW;
        rects.push(
          `<rect x="${x}" y="${y}" width="${w}" height="${lineH}" fill="${escapeXml(runBg)}" />`,
        );
      }
      runStart = i;
      runBg = bg;
    }
  }

  return rects;
}
