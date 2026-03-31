/**
 * Image — multi-protocol inline image component.
 *
 * Supports Kitty Graphics Protocol, iTerm2 Inline Images, and a
 * built-in Unicode block renderer that decodes PNG files and displays
 * them as colored characters.
 *
 * The "block" protocol renders the image using Unicode sextant characters
 * (U+1FB00-U+1FB3B, 2x3 sub-pixel grid per cell). On terminals that
 * support colored underlines (Kitty, WezTerm, Ghostty, foot, Alacritty),
 * a 3rd color channel is applied via CSI 58;2;R;G;Bm to reduce banding
 * in the bottom sub-pixel row — the world's first 3-color sextant blitter.
 *
 * When chafa-wasm is installed, it takes priority for even higher quality
 * (symbol selection from sextant+wedge+braille, dithering, perceptual color).
 */

import React, { useRef } from "react";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { useTui } from "../context/TuiContext.js";
import { detectImageCaps, type ImageProtocol } from "../core/terminal-caps.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

// ── Optional chafa-wasm for high-quality block rendering ─────────────
// If chafa-wasm is installed, use it for dramatically better image quality
// (sextant+wedge+braille symbol selection, dithering, perceptual color).
// Falls back to the built-in quarter-block renderer if unavailable.
let chafaModule: any = null;
let chafaReady = false;
try {
  const ChafaFactory = (await import("chafa-wasm")).default;
  chafaModule = await ChafaFactory();
  chafaReady = true;
} catch {
  // chafa-wasm not installed — use built-in quarter-block renderer
}

/** Check if chafa-wasm acceleration is active */
export function isChafaAccelerated(): boolean {
  return chafaReady;
}

/**
 * Detect whether the terminal supports CSI 58;2;R;G;Bm colored underlines.
 * Delegates to the centralized {@link detectImageCaps} detection.
 */
export function isColoredUnderlineSupported(): boolean {
  return detectImageCaps().supportsColoredUnderline;
}

export interface ImageProps {
  src: string;
  width?: number;
  height?: number;
  // sixel: not yet implemented, falls back to block
  protocol?: "kitty" | "iterm2" | "sixel" | "block" | "auto";
  alt?: string;
  preserveAspectRatio?: boolean;
  basePath?: string;
}

type ResolvedProtocol = "kitty" | "iterm2" | "block";

interface RGB { r: number; g: number; b: number; }

// ── Protocol detection (delegates to terminal-caps) ──────────────────

/** Detect if we're running inside a Kitty-compatible terminal. */
function isKittyTerminal(): boolean {
  return detectImageCaps().supportsKittyGraphics;
}

/**
 * Map the fine-grained {@link ImageProtocol} from terminal-caps into
 * the coarser {@link ResolvedProtocol} that the rendering paths use.
 */
function detectProtocol(): ResolvedProtocol {
  const best = detectImageCaps().bestProtocol;
  switch (best) {
    case "kitty-placeholder":
    case "kitty":
      return "kitty";
    case "iterm2":
      return "iterm2";
    case "sextant-3color":
    case "sextant":
    case "quarter-block":
    case "half-block":
    case "none":
      return "block";
  }
}

// ── File read cache ─────────────────────────────────────────────────
// Module-level cache for fs.readFileSync results. Key: filePath + ":" + mtime.
// Prevents redundant synchronous reads during render.
const _fileReadCache = new Map<string, Buffer>();

function cachedReadFileSync(filePath: string): Buffer {
  let mtime: string;
  try { mtime = String(fs.statSync(filePath).mtimeMs); } catch { mtime = "0"; }
  const key = filePath + ":" + mtime;
  const cached = _fileReadCache.get(key);
  if (cached) return cached;
  const data = Buffer.from(fs.readFileSync(filePath));
  _fileReadCache.set(key, data);
  return data;
}

// Cache for isFilePath results to avoid fs.existsSync on every call.
const _fileExistsCache = new Map<string, boolean>();

// ── Path validation ─────────────────────────────────────────────────

function validateFilePath(src: string, basePath: string): string | null {
  try {
    const resolved = path.resolve(basePath, src);
    const realBase = fs.realpathSync(basePath);
    let realResolved: string;
    try { realResolved = fs.realpathSync(resolved); } catch { realResolved = resolved; }
    if (!realResolved.startsWith(realBase + path.sep) && realResolved !== realBase) return null;
    return realResolved;
  } catch { return null; }
}

function isFilePath(src: string): boolean {
  const cached = _fileExistsCache.get(src);
  if (cached !== undefined) return cached;
  let result: boolean;
  try { result = fs.existsSync(src); } catch { result = false; }
  _fileExistsCache.set(src, result);
  return result;
}

function readImageBase64(src: string, basePath?: string): string {
  if (isFilePath(src)) {
    const base = basePath ?? process.cwd();
    const validated = validateFilePath(src, base);
    if (!validated) throw new Error(`Path outside allowed directory`);
    return cachedReadFileSync(validated).toString("base64");
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(src)) return src.replace(/\s/g, "");
  return Buffer.from(src).toString("base64");
}

// ── PNG decoder (minimal, zero-dep) ─────────────────────────────────
// Only 8-bit RGB/RGBA (and 8-bit grayscale) PNGs are supported.
// 16-bit, indexed-color, and other formats will return null with a warning.

function decodePNG(data: Buffer): { width: number; height: number; pixels: RGB[] } | null {
  try {
    // Verify PNG signature
    if (data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4E || data[3] !== 0x47) return null;

    let offset = 8;
    let width = 0, height = 0, bitDepth = 0, colorType = 0;
    const idatChunks: Buffer[] = [];

    while (offset < data.length) {
      const len = data.readUInt32BE(offset);
      const type = data.subarray(offset + 4, offset + 8).toString("ascii");

      if (type === "IHDR") {
        width = data.readUInt32BE(offset + 8);
        height = data.readUInt32BE(offset + 12);
        bitDepth = data[offset + 16]!;
        colorType = data[offset + 17]!;
      } else if (type === "IDAT") {
        idatChunks.push(data.subarray(offset + 8, offset + 8 + len));
      } else if (type === "IEND") {
        break;
      }

      offset += 12 + len; // 4 length + 4 type + data + 4 CRC
    }

    if (width === 0 || height === 0) return null;
    if (bitDepth !== 8) {
      // Only 8-bit RGB/RGBA PNGs are supported
      console.warn(`[storm-tui Image] Unsupported PNG bit depth: ${bitDepth} (only 8-bit is supported)`);
      return null;
    }

    const compressed = Buffer.concat(idatChunks);
    const raw = zlib.inflateSync(compressed);

    // Bytes per pixel
    const bpp = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : 0;
    if (bpp === 0) {
      // Only RGB (type 2), RGBA (type 6), and grayscale (type 0) are supported
      console.warn(`[storm-tui Image] Unsupported PNG color type: ${colorType} (only RGB/RGBA/grayscale supported)`);
      return null;
    }

    const stride = width * bpp;
    const pixels: RGB[] = new Array(width * height);

    // Unfilter scanlines
    const prev = new Uint8Array(stride);
    const cur = new Uint8Array(stride);

    for (let y = 0; y < height; y++) {
      const rowOffset = y * (1 + stride);
      const filter = raw[rowOffset]!;

      for (let i = 0; i < stride; i++) {
        cur[i] = raw[rowOffset + 1 + i]!;
      }

      // Apply PNG filter
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? cur[i - bpp]! : 0;    // left
        const b = prev[i]!;                          // above
        const c = i >= bpp ? prev[i - bpp]! : 0;    // upper-left

        switch (filter) {
          case 0: break; // None
          case 1: cur[i] = (cur[i]! + a) & 0xFF; break; // Sub
          case 2: cur[i] = (cur[i]! + b) & 0xFF; break; // Up
          case 3: cur[i] = (cur[i]! + ((a + b) >>> 1)) & 0xFF; break; // Average
          case 4: { // Paeth
            const p = a + b - c;
            const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
            const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            cur[i] = (cur[i]! + pr) & 0xFF;
            break;
          }
        }
      }

      // Extract pixels
      for (let x = 0; x < width; x++) {
        const pi = x * bpp;
        if (colorType === 0) {
          // Grayscale
          const v = cur[pi]!;
          pixels[y * width + x] = { r: v, g: v, b: v };
        } else {
          // RGB or RGBA (ignore alpha)
          pixels[y * width + x] = { r: cur[pi]!, g: cur[pi + 1]!, b: cur[pi + 2]! };
        }
      }

      prev.set(cur);
    }

    return { width, height, pixels };
  } catch {
    return null;
  }
}

// ── Quarter-block renderer ───────────────────────────────────────────

// 4 sub-pixels per cell: TL(bit3) TR(bit2) BL(bit1) BR(bit0)
// Each sub-pixel is either fg (1) or bg (0)
const QUARTER_CHARS: Record<number, string> = {
  0b0000: " ",   // all bg
  0b0001: "\u2597",  // ▗ BR only
  0b0010: "\u2596",  // ▖ BL only
  0b0011: "\u2584",  // ▄ bottom half
  0b0100: "\u259D",  // ▝ TR only
  0b0101: "\u2590",  // ▐ right half
  0b0110: "\u259E",  // ▞ TR+BL diagonal
  0b0111: "\u259F",  // ▟ all except TL
  0b1000: "\u2598",  // ▘ TL only
  0b1001: "\u259A",  // ▚ TL+BR diagonal
  0b1010: "\u258C",  // ▌ left half
  0b1011: "\u2599",  // ▙ all except TR
  0b1100: "\u2580",  // ▀ top half
  0b1101: "\u259C",  // ▜ all except BL
  0b1110: "\u259B",  // ▛ all except BR
  0b1111: "\u2588",  // █ all fg
};

/** Area-average all source pixels within the given floating-point rectangle. */
function sampleArea(
  pixels: RGB[],
  imgWidth: number,
  imgHeight: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): RGB {
  let r = 0, g = 0, b = 0, count = 0;
  const iy0 = Math.max(0, Math.floor(y0));
  const iy1 = Math.min(imgHeight, Math.ceil(y1));
  const ix0 = Math.max(0, Math.floor(x0));
  const ix1 = Math.min(imgWidth, Math.ceil(x1));
  for (let y = iy0; y < iy1; y++) {
    for (let x = ix0; x < ix1; x++) {
      const px = pixels[y * imgWidth + x]!;
      r += px.r; g += px.g; b += px.b;
      count++;
    }
  }
  if (count === 0) return { r: 0, g: 0, b: 0 };
  return { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
}

/** Luminance of an RGB color (perceived brightness). */
function luminance(c: RGB): number {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

/** Squared Euclidean distance in RGB space. */
function colorDistSq(a: RGB, b: RGB): number {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

/** Average of an array of colors. */
function avgColor(colors: RGB[]): RGB {
  if (colors.length === 0) return { r: 0, g: 0, b: 0 };
  let r = 0, g = 0, b = 0;
  for (const c of colors) { r += c.r; g += c.g; b += c.b; }
  const n = colors.length;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

/**
 * Find optimal 2-color partition of 4 pixels.
 * Sort by luminance, try 3 split points, pick minimum variance.
 * Returns [fg (brighter cluster mean), bg (darker cluster mean)].
 */
function findPartition(quads: RGB[]): { fg: RGB; bg: RGB } {
  // Sort by luminance
  const sorted = quads
    .map((c, i) => ({ c, l: luminance(c), i }))
    .sort((a, b) => a.l - b.l);

  let bestCost = Infinity;
  let bestFg: RGB = sorted[sorted.length - 1]!.c;
  let bestBg: RGB = sorted[0]!.c;

  // Try each split: [0..split-1] = dark cluster, [split..3] = bright cluster
  for (let split = 1; split < sorted.length; split++) {
    const darkGroup = sorted.slice(0, split).map(s => s.c);
    const brightGroup = sorted.slice(split).map(s => s.c);
    const darkMean = avgColor(darkGroup);
    const brightMean = avgColor(brightGroup);

    // Total within-cluster variance
    let cost = 0;
    for (const c of darkGroup) cost += colorDistSq(c, darkMean);
    for (const c of brightGroup) cost += colorDistSq(c, brightMean);

    if (cost < bestCost) {
      bestCost = cost;
      bestFg = brightMean;
      bestBg = darkMean;
    }
  }

  return { fg: bestFg, bg: bestBg };
}

function renderBlockImage(
  img: { width: number; height: number; pixels: RGB[] },
  targetWidth: number,
  targetHeight: number,
): React.ReactElement[] {
  // Each cell maps to a 2x2 grid of sub-pixels
  const subPixelCols = targetWidth * 2;
  const subPixelRows = targetHeight * 2;
  const scaleX = img.width / subPixelCols;
  const scaleY = img.height / subPixelRows;

  const rows: React.ReactElement[] = [];

  for (let ty = 0; ty < targetHeight; ty++) {
    const parts: React.ReactElement[] = [];

    for (let tx = 0; tx < targetWidth; tx++) {
      // Sample 4 sub-pixels with area averaging
      // TL = sub-pixel (tx*2, ty*2), TR = (tx*2+1, ty*2)
      // BL = (tx*2, ty*2+1), BR = (tx*2+1, ty*2+1)
      const sx = tx * 2;
      const sy = ty * 2;

      const tl = sampleArea(img.pixels, img.width, img.height,
        sx * scaleX, sy * scaleY, (sx + 1) * scaleX, (sy + 1) * scaleY);
      const tr = sampleArea(img.pixels, img.width, img.height,
        (sx + 1) * scaleX, sy * scaleY, (sx + 2) * scaleX, (sy + 1) * scaleY);
      const bl = sampleArea(img.pixels, img.width, img.height,
        sx * scaleX, (sy + 1) * scaleY, (sx + 1) * scaleX, (sy + 2) * scaleY);
      const br = sampleArea(img.pixels, img.width, img.height,
        (sx + 1) * scaleX, (sy + 1) * scaleY, (sx + 2) * scaleX, (sy + 2) * scaleY);

      const quads = [tl, tr, bl, br];

      // Find optimal fg/bg partition
      const { fg, bg } = findPartition(quads);

      // Assign each sub-pixel to fg or bg
      const distTL = colorDistSq(tl, fg) <= colorDistSq(tl, bg);
      const distTR = colorDistSq(tr, fg) <= colorDistSq(tr, bg);
      const distBL = colorDistSq(bl, fg) <= colorDistSq(bl, bg);
      const distBR = colorDistSq(br, fg) <= colorDistSq(br, bg);

      const pattern =
        (distTL ? 0b1000 : 0) |
        (distTR ? 0b0100 : 0) |
        (distBL ? 0b0010 : 0) |
        (distBR ? 0b0001 : 0);

      const ch = QUARTER_CHARS[pattern] ?? " ";
      const fgHex = `#${hex(fg.r)}${hex(fg.g)}${hex(fg.b)}`;
      const bgHex = `#${hex(bg.r)}${hex(bg.g)}${hex(bg.b)}`;

      parts.push(React.createElement("tui-text", {
        key: tx,
        color: fgHex,
        backgroundColor: bgHex,
      }, ch));
    }

    rows.push(React.createElement("tui-box", {
      key: `row-${ty}`,
      flexDirection: "row",
    }, ...parts));
  }

  return rows;
}

function hex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

// ── Perceptual image renderer ───────────────────────────────────────
//
// World-first: OKLab chroma subsampling + sub-pixel Floyd-Steinberg
// error diffusion for terminal image rendering.
//
// The human visual system has ~4× higher spatial resolution for luminance
// than for chrominance. This renderer exploits that asymmetry:
//
//   1. Convert all sub-pixels to OKLab (perceptually uniform color space)
//   2. Subsample chrominance across 2×1 cell pairs (8 sub-pixels share a/b)
//   3. Optimize fg/bg partition per cell using luminance-weighted distance
//   4. Diffuse quantization error in OKLab space (Floyd-Steinberg variant)
//   5. Convert back to sRGB for rendering
//
// The combination of perceptual color space, chroma subsampling, and
// sub-pixel error diffusion produces significantly smoother gradients
// and more accurate color reproduction than naive RGB partitioning.

interface OKLab { L: number; a: number; b: number; }

/**
 * sRGB component (0-255) to linear-light value.
 * Applies the inverse sRGB transfer function (gamma expansion).
 */
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Convert sRGB (0-255) to OKLab.
 *
 * OKLab (Björn Ottosson, 2020) is a perceptually uniform color space where
 * Euclidean distance correlates with perceived color difference. The L axis
 * is lightness (0-1), a is green-red, b is blue-yellow.
 *
 * The transform chain is: sRGB → linear RGB → LMS (via M1) → cube root →
 * OKLab (via M2). Both M1 and M2 are fixed 3×3 matrices.
 */
function rgbToOklab(r: number, g: number, b: number): OKLab {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

/**
 * Convert OKLab back to sRGB (0-255), clamped.
 *
 * Inverse of rgbToOklab: OKLab → LMS cube → linear RGB → sRGB.
 */
function oklabToRgb(lab: OKLab): RGB {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.2914855480 * lab.b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const toSrgb = (c: number) => Math.max(0, Math.min(255, Math.round(
    c <= 0.0031308 ? c * 12.92 * 255 : (1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255
  )));
  return { r: toSrgb(lr), g: toSrgb(lg), b: toSrgb(lb) };
}

/** Average an array of OKLab colors. */
function avgOklab(colors: OKLab[]): OKLab {
  if (colors.length === 0) return { L: 0, a: 0, b: 0 };
  let L = 0, a = 0, b = 0;
  for (const c of colors) { L += c.L; a += c.a; b += c.b; }
  const n = colors.length;
  return { L: L / n, a: a / n, b: b / n };
}

/**
 * Perceptually weighted distance in OKLab space.
 *
 * Luminance (L) is weighted 3× higher than chrominance (a, b) because
 * the human visual system resolves spatial luminance detail at roughly
 * 4× the resolution of chrominance — the same principle behind 4:2:0
 * chroma subsampling in JPEG and video codecs.
 */
function oklabDistWeighted(c1: OKLab, c2: OKLab): number {
  const dL = c1.L - c2.L;
  const da = c1.a - c2.a;
  const db = c1.b - c2.b;
  return 3 * dL * dL + da * da + db * db;
}

/**
 * Perceptual image renderer: OKLab chroma subsampling + sub-pixel
 * Floyd-Steinberg error diffusion.
 *
 * This is, to our knowledge, the first terminal image renderer to combine
 * these three techniques:
 *
 * 1. **OKLab color space** — all optimization happens in a perceptually
 *    uniform space, so "minimize error" actually means "minimize visible
 *    difference to the human eye."
 *
 * 2. **Chroma subsampling** — adjacent cell pairs (2×1) share chrominance
 *    (a, b) while keeping per-sub-pixel luminance (L). This mirrors how
 *    JPEG/H.264 4:2:0 works: the eye's low chroma acuity means we can
 *    halve the chroma resolution with no visible loss.
 *
 * 3. **Sub-pixel error diffusion** — after quantizing each cell to 2 colors,
 *    the OKLab error is distributed to neighboring unprocessed sub-pixels
 *    using Floyd-Steinberg weights (7/16, 3/16, 5/16, 1/16). This turns
 *    banding artifacts into smooth perceptual noise.
 *
 * The result: smoother gradients, more accurate color reproduction, and
 * fewer banding artifacts than any existing terminal image renderer.
 */
function renderPerceptualImage(
  img: { width: number; height: number; pixels: RGB[] },
  targetWidth: number,
  targetHeight: number,
): React.ReactElement[] {
  const subW = targetWidth * 2;
  const subH = targetHeight * 2;
  const scaleX = img.width / subW;
  const scaleY = img.height / subH;

  // ── Step 1: Sample all sub-pixels and convert to OKLab ────────────
  const subPixels: OKLab[][] = [];
  for (let sy = 0; sy < subH; sy++) {
    const row: OKLab[] = [];
    for (let sx = 0; sx < subW; sx++) {
      const rgb = sampleArea(img.pixels, img.width, img.height,
        sx * scaleX, sy * scaleY, (sx + 1) * scaleX, (sy + 1) * scaleY);
      row.push(rgbToOklab(rgb.r, rgb.g, rgb.b));
    }
    subPixels.push(row);
  }

  // ── Step 2: Initialize error diffusion buffer ─────────────────────
  // Each sub-pixel accumulates OKLab error from previously processed
  // neighbors. Initialized to zero; updated as cells are processed
  // in scan-line order.
  const errBuf: OKLab[][] = [];
  for (let sy = 0; sy < subH; sy++) {
    errBuf.push(Array.from({ length: subW }, () => ({ L: 0, a: 0, b: 0 })));
  }

  // ── Step 3: Compute chroma subsampling groups ─────────────────────
  // Group cells into 2×1 horizontal pairs. Each pair of cells (= 4×2
  // sub-pixels) shares a single chrominance value (average of all
  // sub-pixels in the group). Individual luminance is preserved.
  //
  // For odd-width images, the last column forms its own group.
  const chromaGroups: { a: number; b: number }[][] = [];
  for (let cy = 0; cy < targetHeight; cy++) {
    const row: { a: number; b: number }[] = [];
    for (let cx = 0; cx < targetWidth; cx += 2) {
      let sumA = 0, sumB = 0, count = 0;
      // Span up to 4 sub-pixel columns (2 cells × 2 sub-pixels each)
      for (let dx = 0; dx < 4 && (cx * 2 + dx) < subW; dx++) {
        for (let dy = 0; dy < 2; dy++) {
          const spRow = subPixels[cy * 2 + dy];
          const sp = spRow ? spRow[cx * 2 + dx] : undefined;
          if (sp) { sumA += sp.a; sumB += sp.b; count++; }
        }
      }
      row.push({ a: count > 0 ? sumA / count : 0, b: count > 0 ? sumB / count : 0 });
    }
    chromaGroups.push(row);
  }

  // ── Step 4-6: Process cells in scan-line order ────────────────────
  const rows: React.ReactElement[] = [];

  for (let cy = 0; cy < targetHeight; cy++) {
    const parts: React.ReactElement[] = [];

    for (let cx = 0; cx < targetWidth; cx++) {
      const groupChroma = chromaGroups[cy]![Math.floor(cx / 2)]!;

      // Build 4 target colors: original luminance + shared chrominance + accumulated error
      // Sub-pixel order: [TL, TR, BL, BR] = indices [0, 1, 2, 3]
      const targets: OKLab[] = [];
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const sy = cy * 2 + dy;
          const sx = cx * 2 + dx;
          const orig = subPixels[sy]![sx]!;
          const err = errBuf[sy]![sx]!;
          targets.push({
            L: orig.L + err.L,
            a: groupChroma.a + err.a,  // shared chrominance + diffused error
            b: groupChroma.b + err.b,
          });
        }
      }

      // ── Luminance-weighted 2-color partition ──────────────────────
      // Sort sub-pixels by luminance, try all 3 split points, pick the
      // partition that minimizes luminance-weighted OKLab distance.
      const indexed = targets.map((t, i) => ({ t, i, L: t.L }));
      indexed.sort((a, b) => a.L - b.L);

      let bestFg: OKLab = indexed[indexed.length - 1]!.t;
      let bestBg: OKLab = indexed[0]!.t;
      let bestCost = Infinity;

      for (let split = 1; split <= 3; split++) {
        const darkGroup = indexed.slice(0, split).map(s => s.t);
        const brightGroup = indexed.slice(split).map(s => s.t);
        const darkMean = avgOklab(darkGroup);
        const brightMean = avgOklab(brightGroup);
        let cost = 0;
        for (const c of darkGroup) cost += oklabDistWeighted(c, darkMean);
        for (const c of brightGroup) cost += oklabDistWeighted(c, brightMean);
        if (cost < bestCost) {
          bestCost = cost;
          bestFg = brightMean;
          bestBg = darkMean;
        }
      }

      // ── Assign sub-pixels to fg or bg ─────────────────────────────
      let pattern = 0;
      const assignments: boolean[] = []; // true = fg
      for (let i = 0; i < 4; i++) {
        const t = targets[i]!;
        const dFg = oklabDistWeighted(t, bestFg);
        const dBg = oklabDistWeighted(t, bestBg);
        const isFg = dFg <= dBg;
        assignments.push(isFg);
        // Quarter-block bit layout: TL=bit3, TR=bit2, BL=bit1, BR=bit0
        if (isFg) pattern |= (1 << (3 - i));
      }

      // ── Floyd-Steinberg error diffusion ───────────────────────────
      // For each sub-pixel, compute the OKLab quantization error
      // (target - rendered) and distribute it to unprocessed neighbors.
      //
      // Standard Floyd-Steinberg weights:
      //            ·  7/16
      //   3/16  5/16  1/16
      //
      // The "unprocessed" check ensures error only flows forward in
      // scan-line order (right and downward), preventing feedback loops.
      for (let i = 0; i < 4; i++) {
        const dy = i < 2 ? 0 : 1;
        const dx = i % 2;
        const sy = cy * 2 + dy;
        const sx = cx * 2 + dx;
        const rendered = assignments[i]! ? bestFg : bestBg;
        const target = targets[i]!;
        const eL = target.L - rendered.L;
        const eA = target.a - rendered.a;
        const eB = target.b - rendered.b;

        // Distribute error to neighboring sub-pixels
        const distribute = (tsy: number, tsx: number, weight: number) => {
          if (tsy >= 0 && tsy < subH && tsx >= 0 && tsx < subW) {
            // Only distribute to sub-pixels in cells not yet processed
            const targetCy = Math.floor(tsy / 2);
            const targetCx = Math.floor(tsx / 2);
            if (targetCy > cy || (targetCy === cy && targetCx > cx)) {
              errBuf[tsy]![tsx]!.L += eL * weight;
              errBuf[tsy]![tsx]!.a += eA * weight;
              errBuf[tsy]![tsx]!.b += eB * weight;
            }
          }
        };

        distribute(sy, sx + 1, 7 / 16);  // right
        distribute(sy + 1, sx - 1, 3 / 16);  // below-left
        distribute(sy + 1, sx, 5 / 16);  // below
        distribute(sy + 1, sx + 1, 1 / 16);  // below-right
      }

      // ── Convert optimized OKLab colors to sRGB hex ────────────────
      const fgRgb = oklabToRgb(bestFg);
      const bgRgb = oklabToRgb(bestBg);
      const fgHex = `#${hex(fgRgb.r)}${hex(fgRgb.g)}${hex(fgRgb.b)}`;
      const bgHex = `#${hex(bgRgb.r)}${hex(bgRgb.g)}${hex(bgRgb.b)}`;

      const ch = QUARTER_CHARS[pattern] ?? " ";
      parts.push(React.createElement("tui-text", {
        key: cx,
        color: fgHex,
        backgroundColor: bgHex,
      }, ch));
    }

    rows.push(React.createElement("tui-box", {
      key: `row-${cy}`,
      flexDirection: "row",
    }, ...parts));
  }

  return rows;
}

// ── Sextant character helper ────────────────────────────────────────
// Sextant characters (Unicode 13, U+1FB00-U+1FB3B) encode a 2×3 sub-pixel
// grid per cell. 6 sub-pixels = 64 patterns.
// Pattern 0 (all bg) = space, pattern 63 (all fg) = full block U+2588.
// Patterns 1-62 map to U+1FB00 + (pattern - 1).
//
// Sub-pixel layout and bit assignments:
//   [bit0][bit1]  (top row)
//   [bit2][bit3]  (middle row)
//   [bit4][bit5]  (bottom row)

function sextantChar(pattern: number): string {
  if (pattern === 0) return " ";
  if (pattern === 63) return "\u2588"; // █
  return String.fromCodePoint(0x1FB00 + pattern - 1);
}

/**
 * Find optimal 2-color partition for an arbitrary number of sub-pixels.
 * Sorts by luminance and tries every split point.
 */
function findPartitionN(colors: RGB[]): { fg: RGB; bg: RGB } {
  if (colors.length === 0) return { fg: { r: 0, g: 0, b: 0 }, bg: { r: 0, g: 0, b: 0 } };
  if (colors.length === 1) return { fg: colors[0]!, bg: colors[0]! };

  const sorted = colors
    .map((c, i) => ({ c, l: luminance(c), i }))
    .sort((a, b) => a.l - b.l);

  let bestCost = Infinity;
  let bestFg: RGB = sorted[sorted.length - 1]!.c;
  let bestBg: RGB = sorted[0]!.c;

  for (let split = 1; split < sorted.length; split++) {
    const darkGroup = sorted.slice(0, split).map(s => s.c);
    const brightGroup = sorted.slice(split).map(s => s.c);
    const darkMean = avgColor(darkGroup);
    const brightMean = avgColor(brightGroup);

    let cost = 0;
    for (const c of darkGroup) cost += colorDistSq(c, darkMean);
    for (const c of brightGroup) cost += colorDistSq(c, brightMean);

    if (cost < bestCost) {
      bestCost = cost;
      bestFg = brightMean;
      bestBg = darkMean;
    }
  }

  return { fg: bestFg, bg: bestBg };
}

// ── 3-color sextant blitter with colored underline ──────────────────
//
// Each terminal cell is a 2×3 sub-pixel grid (sextant).
// Standard rendering uses 2 colors (fg + bg). The 3-color variant adds
// a colored underline (CSI 58;2;R;G;Bm) that paints a thin stripe over
// the bottom sub-pixel row, effectively introducing a 3rd color channel.
//
// Algorithm:
// 1. Sample 6 sub-pixels (2 cols × 3 rows) via area averaging
// 2. Partition the top 4 sub-pixels into fg/bg clusters
// 3. Assign all 6 sub-pixels to fg or bg → build sextant pattern
// 4. Check if a 3rd color for the bottom 2 sub-pixels reduces error:
//    - Compute error of bottom 2 under current fg/bg assignment
//    - Compute error if we use the average of bottom 2 as underline color
//    - If underline reduces total error by a meaningful threshold, emit it

function renderSextantWithUnderline(
  img: { width: number; height: number; pixels: RGB[] },
  targetWidth: number,
  targetHeight: number,
  useUnderline: boolean,
): React.ReactElement[] {
  // Each cell maps to a 2×3 grid of sub-pixels
  const subPixelCols = targetWidth * 2;
  const subPixelRows = targetHeight * 3;
  const scaleX = img.width / subPixelCols;
  const scaleY = img.height / subPixelRows;

  const rows: React.ReactElement[] = [];

  for (let ty = 0; ty < targetHeight; ty++) {
    const parts: React.ReactElement[] = [];

    for (let tx = 0; tx < targetWidth; tx++) {
      const sx = tx * 2;
      const sy = ty * 3;

      // Sample 6 sub-pixels: [row0: TL, TR] [row1: ML, MR] [row2: BL, BR]
      const sp: RGB[] = [];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          sp.push(sampleArea(
            img.pixels, img.width, img.height,
            (sx + col) * scaleX, (sy + row) * scaleY,
            (sx + col + 1) * scaleX, (sy + row + 1) * scaleY,
          ));
        }
      }

      // Partition the top 4 sub-pixels to find fg/bg
      const top4 = [sp[0]!, sp[1]!, sp[2]!, sp[3]!];
      const { fg, bg } = findPartitionN(top4);

      // Assign all 6 sub-pixels to fg (1) or bg (0) and build sextant pattern
      let pattern = 0;
      for (let i = 0; i < 6; i++) {
        if (colorDistSq(sp[i]!, fg) <= colorDistSq(sp[i]!, bg)) {
          pattern |= (1 << i);
        }
      }

      const ch = sextantChar(pattern);
      const fgHex = `#${hex(fg.r)}${hex(fg.g)}${hex(fg.b)}`;
      const bgHex = `#${hex(bg.r)}${hex(bg.g)}${hex(bg.b)}`;

      // 3-color underline optimization for bottom 2 sub-pixels
      let ulColor: string | undefined;
      if (useUnderline) {
        const bl = sp[4]!;
        const br = sp[5]!;

        // Error of bottom 2 sub-pixels under current fg/bg assignment
        const blAssigned = colorDistSq(bl, fg) <= colorDistSq(bl, bg) ? fg : bg;
        const brAssigned = colorDistSq(br, fg) <= colorDistSq(br, bg) ? fg : bg;
        const currentError = colorDistSq(bl, blAssigned) + colorDistSq(br, brAssigned);

        // Candidate underline color: average of the two bottom sub-pixels
        const ulCandidate = avgColor([bl, br]);
        const ulError = colorDistSq(bl, ulCandidate) + colorDistSq(br, ulCandidate);

        // Use underline if it meaningfully reduces error.
        // The underline is a thin stripe, so it only partially covers the bottom
        // sub-pixels. We require a substantial improvement (>30% error reduction
        // AND absolute threshold) to avoid adding underline noise on smooth areas.
        const errorReduction = currentError - ulError;
        const ERROR_THRESHOLD = 800; // ~10 intensity units squared × 2 pixels × 3 channels
        if (errorReduction > ERROR_THRESHOLD && currentError > 0 && errorReduction / currentError > 0.3) {
          ulColor = `#${hex(ulCandidate.r)}${hex(ulCandidate.g)}${hex(ulCandidate.b)}`;
        }
      }

      parts.push(React.createElement("tui-text", {
        key: tx,
        color: fgHex,
        backgroundColor: bgHex,
        ...(ulColor ? { underline: true, underlineColor: ulColor } : {}),
      }, ch));
    }

    rows.push(React.createElement("tui-box", {
      key: `row-${ty}`,
      flexDirection: "row",
    }, ...parts));
  }

  return rows;
}

// ── Kitty Unicode placeholder protocol ──────────────────────────────
//
// Kitty's Unicode placeholder protocol solves the fundamental problem with
// graphics protocols in scrollable containers: normal Kitty graphics render
// at absolute screen positions, so they don't scroll with text content.
//
// The placeholder protocol works by:
// 1. Transmitting the image data with `U=1` (Unicode placement mode) — this
//    uploads the image but does NOT display it at a fixed position.
// 2. Filling the cell grid with U+10EEEE placeholder characters. The terminal
//    renders the image pixels AT those cell positions.
// 3. Since the placeholders are actual characters in the cell buffer, they
//    scroll naturally with ScrollView content.
//
// The U+10EEEE character is a private-use character in the Supplementary
// Private Use Area-B. Kitty recognizes it as an image placeholder.

/** The Kitty image placeholder character (U+10EEEE). */
const KITTY_PLACEHOLDER = String.fromCodePoint(0x10EEEE);

/**
 * Build the Kitty graphics protocol transmit sequence with Unicode placement.
 * Uses chunked transfer for large images. Returns the escape sequence that
 * must be written to stdout (via pendingImageSequences) to upload the image.
 *
 * Key parameters in the sequence:
 * - a=T: transmit action
 * - U=1: enable Unicode placement mode (image renders at placeholder chars)
 * - f=100: format is PNG
 * - c=cols, r=rows: cell dimensions for the image
 * - t=f: transfer via file path (when source is a file)
 * - t=d: transfer via direct data (inline base64)
 */
function buildKittyPlaceholderTransmit(
  src: string,
  cols: number,
  rows: number,
  basePath?: string,
): string {
  const CHUNK = 4096;

  if (isFilePath(src)) {
    const validated = validateFilePath(src, basePath ?? process.cwd());
    if (!validated) throw new Error("Path outside allowed directory");
    const pb64 = Buffer.from(validated).toString("base64");
    // File-based transfer — single chunk (path is short)
    return `\x1b_Ga=T,U=1,f=100,t=f,c=${cols},r=${rows};${pb64}\x1b\\`;
  }

  // Direct data transfer — may need chunking for large payloads
  const b64 = readImageBase64(src, basePath);
  const seqParts: string[] = [];
  for (let i = 0; i < b64.length; i += CHUNK) {
    const chunk = b64.slice(i, i + CHUNK);
    const isLast = i + CHUNK >= b64.length;
    const m = isLast ? 0 : 1;
    if (i === 0) {
      seqParts.push(`\x1b_Ga=T,U=1,f=100,t=d,c=${cols},r=${rows},m=${m};${chunk}\x1b\\`);
    } else {
      seqParts.push(`\x1b_Gm=${m};${chunk}\x1b\\`);
    }
  }
  return seqParts.join("");
}

/**
 * Build the React element tree for a Kitty Unicode placeholder image.
 * Returns a column of tui-text rows, each filled with U+10EEEE characters.
 * These placeholder characters cause Kitty to render the transmitted image
 * pixels at those cell positions.
 *
 * The transmit sequence is attached via `_imageSeq` on the outer box so it
 * gets written to stdout once (via the existing pendingImageSequences path).
 * Unlike the old Kitty path, the cells contain actual characters instead of
 * an opaque black spacer — so they scroll naturally with content.
 */
function renderKittyPlaceholder(
  cols: number,
  rows: number,
): React.ReactElement[] {
  const placeholderRow = KITTY_PLACEHOLDER.repeat(cols);
  const elements: React.ReactElement[] = [];
  for (let y = 0; y < rows; y++) {
    elements.push(
      React.createElement("tui-text", { key: y }, placeholderRow),
    );
  }
  return elements;
}

// ── Escape sequence builders ────────────────────────────────────────

function buildKittySequence(src: string, w?: number, h?: number, basePath?: string): string {
  if (isFilePath(src)) {
    const validated = validateFilePath(src, basePath ?? process.cwd());
    if (!validated) throw new Error("Path outside allowed directory");
    const pb64 = Buffer.from(validated).toString("base64");
    const p = ["f=100", "t=f", "a=T"];
    if (w != null) p.push(`s=${w}`);
    if (h != null) p.push(`v=${h}`);
    return `\x1b_G${p.join(",")};${pb64}\x1b\\`;
  }
  const b64 = readImageBase64(src, basePath);
  const p = ["f=100", "t=d", "a=T"];
  if (w != null) p.push(`s=${w}`);
  if (h != null) p.push(`v=${h}`);
  return `\x1b_G${p.join(",")};${b64}\x1b\\`;
}

function buildIterm2Sequence(src: string, w?: number, h?: number, par = true, basePath?: string): string {
  const b64 = readImageBase64(src, basePath);
  const p = ["inline=1"];
  if (w != null) p.push(`width=${w}`);
  if (h != null) p.push(`height=${h}`);
  p.push(`preserveAspectRatio=${par ? 1 : 0}`);
  return `\x1b]1337;File=${p.join(";")}:${b64}\x07`;
}

// ── Component ───────────────────────────────────────────────────────

export const Image = React.memo(function Image(rawProps: ImageProps): React.ReactElement {
  const props = usePluginProps("Image", rawProps as unknown as Record<string, unknown>) as unknown as ImageProps;
  const { src, width: pw, height: ph, protocol: pp = "auto", alt = "", preserveAspectRatio = true, basePath } = props;
  useTui(); // validates we're inside a TuiProvider

  // Protocol resolution:
  //
  // "auto" selects the best scrollable rendering path:
  //   1. Kitty Unicode placeholders — pixel-perfect AND scrollable (Kitty/Ghostty)
  //   2. Block characters — universal fallback (works everywhere)
  //
  // Explicit "kitty" now uses the Unicode placeholder path too (scrollable).
  // Explicit "iterm2" still uses the old absolute-position spacer path.
  // sixel: not yet implemented, falls back to block
  const detected = pp === "auto" ? detectProtocol() : (pp === "sixel" ? "block" as const : pp);
  const useKittyPlaceholder = (detected === "kitty") && isKittyTerminal();
  const resolvedProtocol: ResolvedProtocol = useKittyPlaceholder ? "kitty" : (pp === "auto" || pp === "sixel" ? "block" : (pp === "kitty" || pp === "iterm2" ? pp : "block"));
  const displayWidth = pw ?? 20;
  const displayHeight = ph ?? 6;

  // ── Cache layer ───────────────────────────────────────────────────
  // Decode PNG and build React elements ONCE. Only rebuild if src/size changes.
  // This eliminates: fs.readFileSync (2-5ms), decodePNG (3-10ms), and
  // renderBlockImage (15-30ms) from running on every re-render.
  // For graphics protocols (kitty/iterm2/kitty-placeholder), also caches
  // the escape sequence to avoid re-reading the file and re-encoding base64.
  const cacheRef = useRef<{
    src: string;
    width: number;
    height: number;
    protocol: string;
    elements: React.ReactElement | null;
    /** Cached escape sequence for graphics protocols. */
    escapeSeq: string;
  }>({ src: "", width: 0, height: 0, protocol: "", elements: null, escapeSeq: "" });

  // ── Tier 1: Kitty Unicode placeholders (scrollable, pixel-perfect) ──
  //
  // When running inside Kitty/Ghostty, we use the Unicode placeholder protocol:
  // - Transmit image data with `U=1` (uploaded once via _imageSeq -> pendingImageSequences)
  // - Fill cells with U+10EEEE placeholder characters that the terminal renders as pixels
  // - The placeholders are real characters in the cell buffer, so they scroll with content
  //
  // This replaces the old Kitty path which used an opaque black spacer box with absolute
  // positioning — that approach broke inside ScrollView because the image didn't move
  // when cells scrolled.
  if (useKittyPlaceholder) {
    const cache = cacheRef.current;
    if (cache.src === src && cache.width === displayWidth && cache.height === displayHeight && cache.protocol === resolvedProtocol && cache.elements && cache.escapeSeq) {
      return cache.elements;
    }

    let transmitSeq = "";
    try {
      transmitSeq = buildKittyPlaceholderTransmit(src, displayWidth, displayHeight, basePath);
    } catch { /* fall through to block fallback below */ }

    if (transmitSeq) {
      const placeholderRows = renderKittyPlaceholder(displayWidth, displayHeight);
      // The outer box carries _imageSeq so the renderer can emit the transmit
      // sequence to stdout (once) via the existing pendingImageSequences pipeline.
      // The placeholder characters inside provide the actual cell content that
      // Kitty renders as image pixels — and they scroll naturally.
      const result = React.createElement("tui-box", {
        flexDirection: "column",
        width: displayWidth,
        height: displayHeight,
        _imageSeq: transmitSeq,
      }, ...placeholderRows);
      cacheRef.current = { src, width: displayWidth, height: displayHeight, protocol: resolvedProtocol, elements: result, escapeSeq: transmitSeq };
      return result;
    }
    // If transmit failed, fall through to block protocol below
  }

  // ── Build escape sequence for non-placeholder graphics protocols ──
  // (iterm2, or kitty when placeholder is not available)
  let imageSeq = "";
  if (resolvedProtocol !== "block" && !useKittyPlaceholder) {
    const cache = cacheRef.current;
    if (cache.src === src && cache.width === displayWidth && cache.height === displayHeight && cache.protocol === resolvedProtocol && cache.escapeSeq) {
      imageSeq = cache.escapeSeq;
    } else {
      try {
        if (resolvedProtocol === "kitty") imageSeq = buildKittySequence(src, pw, ph, basePath);
        else if (resolvedProtocol === "iterm2") imageSeq = buildIterm2Sequence(src, pw, ph, preserveAspectRatio, basePath);
        cacheRef.current = { src, width: displayWidth, height: displayHeight, protocol: resolvedProtocol, elements: null, escapeSeq: imageSeq };
      } catch { /* fallback to spacer */ }
    }
  }

  // ── Tier 2: Block characters (scrollable, lower quality) ──────────
  // Universal fallback — works in every terminal.
  if (resolvedProtocol === "block") {
    // Return cached elements if src/size haven't changed
    const cache = cacheRef.current;
    if (cache.src === src && cache.width === displayWidth && cache.height === displayHeight && cache.protocol === resolvedProtocol && cache.elements) {
      return cache.elements;
    }

    // Try chafa-wasm first (dramatically better quality)
    if (chafaReady && chafaModule) {
      try {
        const filePath = isFilePath(src) ? (validateFilePath(src, basePath ?? process.cwd()) ?? src) : null;
        if (filePath) {
          const imageData = cachedReadFileSync(filePath);
          let ansiResult = "";
          let done = false;
          chafaModule.imageToAnsi(imageData.buffer, {
            width: displayWidth,
            height: displayHeight,
            fontRatio: 0.5,
            colors: "truecolor",
            symbols: "block+border+sextant+wedge-wide-inverted",
            work: 9,
            optimize: 5,
          }, (err: unknown, data: { ansi: string }) => {
            if (!err && data) ansiResult = data.ansi;
            done = true;
          });
          // chafa-wasm callback is synchronous
          if (done && ansiResult) {
            // Parse ANSI output into rows of tui-text elements
            const lines = ansiResult.split("\n").filter(l => l.length > 0);
            const rows = lines.slice(0, displayHeight).map((line, y) =>
              React.createElement("tui-text", { key: y }, line),
            );
            const result = React.createElement("tui-box", {
              flexDirection: "column",
            }, ...rows);
            cacheRef.current = { src, width: displayWidth, height: displayHeight, protocol: resolvedProtocol, elements: result, escapeSeq: "" };
            return result;
          }
        }
      } catch { /* fall through to built-in renderer */ }
    }

    // Built-in block character renderer.
    // Uses renderPerceptualImage (OKLab chroma subsampling + Floyd-Steinberg
    // error diffusion) for superior gradient smoothness and color accuracy.
    // Falls back to renderBlockImage if perceptual rendering fails.
    try {
      const filePath = isFilePath(src) ? (validateFilePath(src, basePath ?? process.cwd()) ?? src) : null;
      if (filePath) {
        const data = cachedReadFileSync(filePath);
        const img = decodePNG(data);
        if (img) {
          const result = React.createElement("tui-box", {
            flexDirection: "column",
          }, ...renderPerceptualImage(img, displayWidth, displayHeight));
          cacheRef.current = { src, width: displayWidth, height: displayHeight, protocol: resolvedProtocol, elements: result, escapeSeq: "" };
          return result;
        }
      }
    } catch { /* fall through to alt text */ }

    // Fallback: show alt text if PNG decode fails
    const fallback = React.createElement("tui-text", { dim: true }, alt || "[image]");
    cacheRef.current = { src, width: displayWidth, height: displayHeight, protocol: resolvedProtocol, elements: fallback, escapeSeq: "" };
    return fallback;
  }

  // ── Non-scrollable graphics protocols (iterm2 fallback) ───────────
  // Spacer box holds layout position for absolute-position image protocols.
  // _imageSeq is picked up by paintBox and queued for post-diff output.
  // backgroundColor keeps the diff renderer from treating these cells as blank
  // (prevents overwriting the image region with empty space on subsequent frames).
  return React.createElement("tui-box", {
    width: displayWidth,
    height: displayHeight,
    backgroundColor: "#000000",
    ...(imageSeq ? { _imageSeq: imageSeq } : {}),
  });
});
