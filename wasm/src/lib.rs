//! Storm TUI WASM Hot Path
//!
//! Replaces the 4 hottest TypeScript functions with native Rust compiled to WASM.
//! Eliminates GC pauses in the render path. ~50KB binary.
//!
//! Functions:
//!   - ScreenBuffer: cell storage using flat Vec<u8>/Vec<i32> (no GC objects)
//!   - char_width: BMP lookup table (O(1) per character)
//!   - row_equals: fast row comparison for dirty diff
//!   - render_line: ANSI string building for changed rows

use wasm_bindgen::prelude::*;

// ── charWidth lookup table ──────────────────────────────────────────

static mut BMP_WIDTH: [u8; 65536] = [0u8; 65536];
static mut BMP_INITIALIZED: bool = false;

fn init_bmp_table() {
    unsafe {
        if BMP_INITIALIZED { return; }

        // Default: width 1 for all printable
        for i in 32..65536usize {
            BMP_WIDTH[i] = 1;
        }

        // Control characters: width 0
        for i in 0..32usize { BMP_WIDTH[i] = 0; }
        BMP_WIDTH[127] = 0;

        // Combining marks: width 0
        for i in 0x0300..=0x036F { BMP_WIDTH[i] = 0; }
        for i in 0x0483..=0x0489 { BMP_WIDTH[i] = 0; }
        for i in 0x0591..=0x05BD { BMP_WIDTH[i] = 0; }
        for i in 0x0610..=0x061A { BMP_WIDTH[i] = 0; }
        for i in 0x064B..=0x065F { BMP_WIDTH[i] = 0; }
        for i in 0x0670..=0x0670 { BMP_WIDTH[i] = 0; }
        for i in 0x06D6..=0x06DC { BMP_WIDTH[i] = 0; }
        for i in 0x06DF..=0x06E4 { BMP_WIDTH[i] = 0; }
        for i in 0x0730..=0x074A { BMP_WIDTH[i] = 0; }
        for i in 0x07A6..=0x07B0 { BMP_WIDTH[i] = 0; }
        for i in 0x0900..=0x0903 { BMP_WIDTH[i] = 0; }
        for i in 0x093A..=0x094F { BMP_WIDTH[i] = 0; }
        for i in 0x0951..=0x0957 { BMP_WIDTH[i] = 0; }
        for i in 0x0962..=0x0963 { BMP_WIDTH[i] = 0; }
        for i in 0x0981..=0x0983 { BMP_WIDTH[i] = 0; }
        for i in 0x0BC0..=0x0BC2 { BMP_WIDTH[i] = 0; }
        for i in 0x0BCD..=0x0BCD { BMP_WIDTH[i] = 0; }
        for i in 0x1AB0..=0x1AFF { BMP_WIDTH[i] = 0; }
        for i in 0x1DC0..=0x1DFF { BMP_WIDTH[i] = 0; }
        for i in 0x20D0..=0x20FF { BMP_WIDTH[i] = 0; }
        for i in 0xFE00..=0xFE0F { BMP_WIDTH[i] = 0; }
        for i in 0xFE20..=0xFE2F { BMP_WIDTH[i] = 0; }
        // Zero-width characters
        BMP_WIDTH[0x200B] = 0; // ZWSP
        BMP_WIDTH[0x200C] = 0; // ZWNJ
        BMP_WIDTH[0x200D] = 0; // ZWJ
        BMP_WIDTH[0xFEFF] = 0; // BOM

        // CJK / fullwidth: width 2
        for i in 0x1100..=0x115F { BMP_WIDTH[i] = 2; }
        for i in 0x2E80..=0x303E { BMP_WIDTH[i] = 2; }
        for i in 0x3041..=0x33BF { BMP_WIDTH[i] = 2; }
        for i in 0x3400..=0x4DBF { BMP_WIDTH[i] = 2; }
        for i in 0x4E00..=0x9FFF { BMP_WIDTH[i] = 2; }
        for i in 0xA000..=0xA4CF { BMP_WIDTH[i] = 2; }
        for i in 0xAC00..=0xD7AF { BMP_WIDTH[i] = 2; }
        for i in 0xF900..=0xFAFF { BMP_WIDTH[i] = 2; }
        for i in 0xFE30..=0xFE6F { BMP_WIDTH[i] = 2; }
        for i in 0xFF01..=0xFF60 { BMP_WIDTH[i] = 2; }
        for i in 0xFFE0..=0xFFE6 { BMP_WIDTH[i] = 2; }

        BMP_INITIALIZED = true;
    }
}

#[wasm_bindgen]
pub fn char_width(code: u32) -> u32 {
    unsafe {
        if !BMP_INITIALIZED { init_bmp_table(); }
        if code < 0x10000 {
            return BMP_WIDTH[code as usize] as u32;
        }
    }
    // Supplementary planes
    if code >= 0x1F300 && code <= 0x1F9FF { return 2; } // Emoji
    if code >= 0x20000 && code <= 0x2FA1F { return 2; } // CJK extensions
    if code >= 0x1F3FB && code <= 0x1F3FF { return 0; } // Skin tone modifiers
    1
}

#[wasm_bindgen]
pub fn string_width(s: &str) -> u32 {
    let mut w: u32 = 0;
    for c in s.chars() {
        w += char_width(c as u32);
    }
    w
}

// ── ScreenBuffer ────────────────────────────────────────────────────

#[wasm_bindgen]
pub struct WasmBuffer {
    width: usize,
    height: usize,
    chars: Vec<u32>,      // Unicode code points (not char objects)
    fgs: Vec<i32>,        // Foreground colors (-1 = default)
    bgs: Vec<i32>,        // Background colors (-1 = default)
    attrs: Vec<u8>,       // Attribute bitmask
}

#[wasm_bindgen]
impl WasmBuffer {
    #[wasm_bindgen(constructor)]
    pub fn new(width: usize, height: usize) -> WasmBuffer {
        let size = width * height;
        WasmBuffer {
            width,
            height,
            chars: vec![32u32; size],  // space
            fgs: vec![-1i32; size],    // default
            bgs: vec![-1i32; size],    // default
            attrs: vec![0u8; size],    // none
        }
    }

    #[wasm_bindgen]
    pub fn get_width(&self) -> usize { self.width }

    #[wasm_bindgen]
    pub fn get_height(&self) -> usize { self.height }

    #[wasm_bindgen]
    pub fn set_cell(&mut self, x: usize, y: usize, ch: u32, fg: i32, bg: i32, attr: u8) {
        if x >= self.width || y >= self.height { return; }
        let i = y * self.width + x;
        self.chars[i] = ch;
        self.fgs[i] = fg;
        self.bgs[i] = bg;
        self.attrs[i] = attr;
    }

    #[wasm_bindgen]
    pub fn get_char(&self, x: usize, y: usize) -> u32 {
        if x >= self.width || y >= self.height { return 32; }
        self.chars[y * self.width + x]
    }

    #[wasm_bindgen]
    pub fn get_fg(&self, x: usize, y: usize) -> i32 {
        if x >= self.width || y >= self.height { return -1; }
        self.fgs[y * self.width + x]
    }

    #[wasm_bindgen]
    pub fn get_bg(&self, x: usize, y: usize) -> i32 {
        if x >= self.width || y >= self.height { return -1; }
        self.bgs[y * self.width + x]
    }

    #[wasm_bindgen]
    pub fn get_attrs(&self, x: usize, y: usize) -> u8 {
        if x >= self.width || y >= self.height { return 0; }
        self.attrs[y * self.width + x]
    }

    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.chars.fill(32);
        self.fgs.fill(-1);
        self.bgs.fill(-1);
        self.attrs.fill(0);
    }

    /// Fast row equality check — returns true if row y is identical in both buffers.
    /// This is the key to cell-level dirty diff: skip unchanged rows entirely.
    #[wasm_bindgen]
    pub fn row_equals(&self, other: &WasmBuffer, y: usize) -> bool {
        if y >= self.height || y >= other.height { return false; }
        if self.width != other.width { return false; }

        let start = y * self.width;
        let end = start + self.width;

        // Compare all 4 arrays for this row
        self.chars[start..end] == other.chars[start..end]
            && self.fgs[start..end] == other.fgs[start..end]
            && self.bgs[start..end] == other.bgs[start..end]
            && self.attrs[start..end] == other.attrs[start..end]
    }

    /// Write a string starting at (x, y) with given colors/attrs.
    /// Handles wide characters (CJK) by setting next cell to 0 (null placeholder).
    #[wasm_bindgen]
    pub fn write_string(&mut self, x: usize, y: usize, s: &str, fg: i32, bg: i32, attr: u8) {
        if y >= self.height { return; }
        let mut col = x;
        for c in s.chars() {
            if col >= self.width { break; }
            let code = c as u32;
            let w = char_width(code) as usize;
            if w == 0 { continue; } // skip zero-width

            let i = y * self.width + col;
            self.chars[i] = code;
            self.fgs[i] = fg;
            self.bgs[i] = bg;
            self.attrs[i] = attr;

            // Wide character: fill next cell with null placeholder
            if w == 2 && col + 1 < self.width {
                let j = i + 1;
                self.chars[j] = 0; // null = wide char continuation
                self.fgs[j] = fg;
                self.bgs[j] = bg;
                self.attrs[j] = attr;
            }

            col += w;
        }
    }

    /// Clone the buffer
    #[wasm_bindgen]
    pub fn clone_buffer(&self) -> WasmBuffer {
        WasmBuffer {
            width: self.width,
            height: self.height,
            chars: self.chars.clone(),
            fgs: self.fgs.clone(),
            bgs: self.bgs.clone(),
            attrs: self.attrs.clone(),
        }
    }
}

// ── ANSI rendering ──────────────────────────────────────────────────

const ATTR_BOLD: u8 = 1;
const ATTR_DIM: u8 = 2;
const ATTR_ITALIC: u8 = 4;
const ATTR_UNDERLINE: u8 = 8;
const ATTR_INVERSE: u8 = 16;
const ATTR_STRIKETHROUGH: u8 = 32;

fn push_sgr(out: &mut String, fg: i32, bg: i32, attrs: u8) {
    out.push_str("\x1b[0");

    if attrs & ATTR_BOLD != 0 { out.push_str(";1"); }
    if attrs & ATTR_DIM != 0 { out.push_str(";2"); }
    if attrs & ATTR_ITALIC != 0 { out.push_str(";3"); }
    if attrs & ATTR_UNDERLINE != 0 { out.push_str(";4"); }
    if attrs & ATTR_INVERSE != 0 { out.push_str(";7"); }
    if attrs & ATTR_STRIKETHROUGH != 0 { out.push_str(";9"); }

    // Foreground: true color (0x1RRGGBB format from Storm)
    if fg >= 0x1000000 {
        let r = (fg >> 16) & 0xFF;
        let g = (fg >> 8) & 0xFF;
        let b = fg & 0xFF;
        out.push_str(&format!(";38;2;{};{};{}", r, g, b));
    } else if fg >= 0 && fg <= 255 {
        out.push_str(&format!(";38;5;{}", fg));
    }

    // Background
    if bg >= 0x1000000 {
        let r = (bg >> 16) & 0xFF;
        let g = (bg >> 8) & 0xFF;
        let b = bg & 0xFF;
        out.push_str(&format!(";48;2;{};{};{}", r, g, b));
    } else if bg >= 0 && bg <= 255 {
        out.push_str(&format!(";48;5;{}", bg));
    }

    out.push('m');
}

/// Render a single row to an ANSI string.
/// Only called for rows that differ from the previous frame (dirty check passed).
#[wasm_bindgen]
pub fn render_line(buf: &WasmBuffer, y: usize) -> String {
    if y >= buf.height { return String::new(); }

    let mut out = String::with_capacity(buf.width * 4);
    let mut cur_fg: i32 = -2; // impossible value to force first SGR
    let mut cur_bg: i32 = -2;
    let mut cur_attrs: u8 = 255;

    // Find last non-space column to avoid trailing spaces
    let mut last = buf.width;
    while last > 0 {
        let i = y * buf.width + (last - 1);
        if buf.chars[i] != 32 || buf.fgs[i] != -1 || buf.bgs[i] != -1 || buf.attrs[i] != 0 {
            break;
        }
        last -= 1;
    }

    for x in 0..last {
        let i = y * buf.width + x;
        let ch = buf.chars[i];
        let fg = buf.fgs[i];
        let bg = buf.bgs[i];
        let attrs = buf.attrs[i];

        // Skip wide char continuation cells
        if ch == 0 { continue; }

        // Only emit SGR if style changed
        if fg != cur_fg || bg != cur_bg || attrs != cur_attrs {
            push_sgr(&mut out, fg, bg, attrs);
            cur_fg = fg;
            cur_bg = bg;
            cur_attrs = attrs;
        }

        // Write character
        if let Some(c) = char::from_u32(ch) {
            out.push(c);
        } else {
            out.push(' ');
        }
    }

    // Reset at end of line
    if cur_fg != -1 || cur_bg != -1 || cur_attrs != 0 {
        out.push_str("\x1b[0m");
    }

    // Clear to end of line
    out.push_str("\x1b[K");

    out
}
