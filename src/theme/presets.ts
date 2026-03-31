/**
 * Storm theme presets.
 *
 * 11 professionally curated palettes — Storm's own brand identity,
 * plus calm, high-contrast, and monochrome accessibility variants.
 *
 * Each theme defines ALL fields of StormColors with role colors derived
 * consistently from the base semantic palette.
 */

import { colors as defaultColors } from "./colors.js";
import type { StormColors } from "./colors.js";

export { defaultColors };

// ── 1. Arctic ───────────────────────────────────────────────────────
// Cool blue frost — crisp, calm, Scandinavian clarity.

export const arcticTheme: StormColors = {
  brand: {
    primary: "#5CB8C8",   // Storm frost — warmer, greener teal
    light:   "#8AD0D8",   // Lighter frost (+20% white)
    glow:    "#4A94A0",   // Dimmer frost (−20%)
  },

  text: {
    primary:   "#D8DEE9",
    secondary: "#B0B8C8",
    dim:       "#616E88",
    disabled:  "#4C566A",
  },

  surface: {
    base:      "#1C2028",   // Deeper, more contrast
    raised:    "#2A3040",
    overlay:   "#384050",
    highlight: "#4C566A",
  },

  divider: "#2A3040",

  success: "#7EC9A8",   // Vibrant sage-green, less olive
  warning: "#EBCB8B",
  error:   "#BF616A",
  info:    "#81A1C1",

  system:    { text: "#616E88" },
  user:      { symbol: "#5CB8C8" },
  assistant: { symbol: "#7EC9A8" },
  thinking:  { symbol: "#5CB8C8", shimmer: "#8AD0D8" },

  tool: {
    running:   "#5CB8C8",
    completed: "#7EC9A8",
    failed:    "#BF616A",
    pending:   "#B0B8C8",
    cancelled: "#616E88",
  },

  approval: {
    approve: "#7EC9A8",
    deny:    "#BF616A",
    always:  "#EBCB8B",
    header:  "#D8DEE9",
    border:  "#2A3040",
  },

  input: {
    border:       "#2A3040",
    borderActive: "#5CB8C8",
    prompt:       "#5CB8C8",
  },

  diff: {
    added:     "#7EC9A8",
    removed:   "#BF616A",
    addedBg:   "#142820",   // Deep tinted success
    removedBg: "#2E1A1A",   // Deep tinted error
  },

  syntax: {
    keyword:  "#5CB8C8",
    string:   "#7EC9A8",
    number:   "#EBCB8B",
    function: "#D8DEE9",
    type:     "#81A1C1",
    comment:  "#616E88",
    operator: "#BF616A",
  },
} as const;

// ── 2. Midnight ─────────────────────────────────────────────────────
// Deep blue night — luminous accents against a dark sky.

export const midnightTheme: StormColors = {
  brand: {
    primary: "#6B9EF0",   // Storm midnight — slightly muted, more refined
    light:   "#90B8F4",   // Lighter (+20% white)
    glow:    "#4878C0",   // Dimmer (−20%)
  },

  text: {
    primary:   "#A9B1D6",
    secondary: "#787C99",
    dim:       "#565F89",
    disabled:  "#414868",
  },

  surface: {
    base:      "#12141E",   // Even deeper midnight
    raised:    "#1E2234",
    overlay:   "#2C3350",
    highlight: "#414868",
  },

  divider: "#1E2234",

  success: "#9ECE6A",
  warning: "#E0AF68",
  error:   "#E8657A",   // Deeper, less pink — warm crimson accent
  info:    "#BB9AF7",

  system:    { text: "#565F89" },
  user:      { symbol: "#6B9EF0" },
  assistant: { symbol: "#9ECE6A" },
  thinking:  { symbol: "#6B9EF0", shimmer: "#90B8F4" },

  tool: {
    running:   "#6B9EF0",
    completed: "#9ECE6A",
    failed:    "#E8657A",
    pending:   "#787C99",
    cancelled: "#565F89",
  },

  approval: {
    approve: "#9ECE6A",
    deny:    "#E8657A",
    always:  "#E0AF68",
    header:  "#A9B1D6",
    border:  "#1E2234",
  },

  input: {
    border:       "#1E2234",
    borderActive: "#6B9EF0",
    prompt:       "#6B9EF0",
  },

  diff: {
    added:     "#9ECE6A",
    removed:   "#E8657A",
    addedBg:   "#141E14",   // Deep tinted success
    removedBg: "#241418",   // Deep tinted error
  },

  syntax: {
    keyword:  "#6B9EF0",
    string:   "#9ECE6A",
    number:   "#E0AF68",
    function: "#A9B1D6",
    type:     "#BB9AF7",
    comment:  "#565F89",
    operator: "#E8657A",
  },
} as const;

// ── 3. Ember ────────────────────────────────────────────────────────
// Warm earth tones — cozy amber glow and toasted neutrals.

export const emberTheme: StormColors = {
  brand: {
    primary: "#6EB0A0",   // Storm ember — teal undercurrent in warm earth
    light:   "#90C8B8",   // Lighter (+20% white)
    glow:    "#588E80",   // Dimmer (−20%)
  },

  text: {
    primary:   "#EBDBB2",
    secondary: "#BDAE93",
    dim:       "#928374",
    disabled:  "#665C54",
  },

  surface: {
    base:      "#1E1C18",   // Warmer, less gray
    raised:    "#302C24",
    overlay:   "#443E34",
    highlight: "#665C54",
  },

  divider: "#302C24",

  success: "#A0C840",   // Brighter, less yellow-green
  warning: "#FABD2F",
  error:   "#FB4934",
  info:    "#D3869B",

  system:    { text: "#928374" },
  user:      { symbol: "#6EB0A0" },
  assistant: { symbol: "#A0C840" },
  thinking:  { symbol: "#6EB0A0", shimmer: "#90C8B8" },

  tool: {
    running:   "#6EB0A0",
    completed: "#A0C840",
    failed:    "#FB4934",
    pending:   "#BDAE93",
    cancelled: "#928374",
  },

  approval: {
    approve: "#A0C840",
    deny:    "#FB4934",
    always:  "#FABD2F",
    header:  "#EBDBB2",
    border:  "#302C24",
  },

  input: {
    border:       "#302C24",
    borderActive: "#6EB0A0",
    prompt:       "#6EB0A0",
  },

  diff: {
    added:     "#A0C840",
    removed:   "#FB4934",
    addedBg:   "#1A2410",   // Deep tinted success
    removedBg: "#2A1410",   // Deep tinted error
  },

  syntax: {
    keyword:  "#6EB0A0",
    string:   "#A0C840",
    number:   "#FABD2F",
    function: "#EBDBB2",
    type:     "#D3869B",
    comment:  "#928374",
    operator: "#FB4934",
  },
} as const;

// ── 4. Mist ─────────────────────────────────────────────────────────
// Soft pastels — gentle, soothing tones that never tire the eye.

export const mistTheme: StormColors = {
  brand: {
    primary: "#78B0E8",   // Storm mist — less saturated, more mature
    light:   "#A0C8F0",   // Lighter (+20% white)
    glow:    "#5888B8",   // Dimmer (−20%)
  },

  text: {
    primary:   "#CDD6F4",
    secondary: "#BAC2DE",
    dim:       "#A6ADC8",
    disabled:  "#585B70",
  },

  surface: {
    base:      "#181824",   // Deeper
    raised:    "#282840",
    overlay:   "#3C3C54",
    highlight: "#585B70",
  },

  divider: "#282840",

  success: "#A6E3A1",
  warning: "#E8C870",   // Warmer gold (swapped unique)
  error:   "#F38BA8",
  info:    "#A090D8",   // Lavender instead of purple (swapped unique)

  system:    { text: "#A6ADC8" },
  user:      { symbol: "#78B0E8" },
  assistant: { symbol: "#A6E3A1" },
  thinking:  { symbol: "#78B0E8", shimmer: "#A0C8F0" },

  tool: {
    running:   "#78B0E8",
    completed: "#A6E3A1",
    failed:    "#F38BA8",
    pending:   "#BAC2DE",
    cancelled: "#A6ADC8",
  },

  approval: {
    approve: "#A6E3A1",
    deny:    "#F38BA8",
    always:  "#E8C870",
    header:  "#CDD6F4",
    border:  "#282840",
  },

  input: {
    border:       "#282840",
    borderActive: "#78B0E8",
    prompt:       "#78B0E8",
  },

  diff: {
    added:     "#A6E3A1",
    removed:   "#F38BA8",
    addedBg:   "#142418",   // Deep tinted success
    removedBg: "#281820",   // Deep tinted error
  },

  syntax: {
    keyword:  "#78B0E8",
    string:   "#A6E3A1",
    number:   "#E8C870",
    function: "#CDD6F4",
    type:     "#A090D8",
    comment:  "#A6ADC8",
    operator: "#F38BA8",
  },
} as const;

// ── 5. Voltage ──────────────────────────────────────────────────────
// Vivid electric — high-energy saturated colors that pop.

export const voltageTheme: StormColors = {
  brand: {
    primary: "#A080E8",   // Storm voltage — less pink, more blue-violet
    light:   "#BCA0F0",   // Lighter (+20% white)
    glow:    "#7860B8",   // Dimmer (−20%)
  },

  text: {
    primary:   "#F8F8F2",
    secondary: "#BFBFBF",
    dim:       "#6272A4",
    disabled:  "#424450",
  },

  surface: {
    base:      "#1A1C28",   // Darker for more contrast
    raised:    "#30324A",
    overlay:   "#3C3E50",
    highlight: "#343746",
  },

  divider: "#30324A",

  success: "#40E890",   // Turquoise-green — unique Storm voltage accent
  warning: "#F1FA8C",
  error:   "#F04060",   // Deeper, more crimson
  info:    "#8BE9FD",

  system:    { text: "#6272A4" },
  user:      { symbol: "#A080E8" },
  assistant: { symbol: "#40E890" },
  thinking:  { symbol: "#A080E8", shimmer: "#BCA0F0" },

  tool: {
    running:   "#A080E8",
    completed: "#40E890",
    failed:    "#F04060",
    pending:   "#BFBFBF",
    cancelled: "#6272A4",
  },

  approval: {
    approve: "#40E890",
    deny:    "#F04060",
    always:  "#F1FA8C",
    header:  "#F8F8F2",
    border:  "#30324A",
  },

  input: {
    border:       "#30324A",
    borderActive: "#A080E8",
    prompt:       "#A080E8",
  },

  diff: {
    added:     "#40E890",
    removed:   "#F04060",
    addedBg:   "#102818",   // Deep tinted success
    removedBg: "#281014",   // Deep tinted error
  },

  syntax: {
    keyword:  "#A080E8",
    string:   "#40E890",
    number:   "#F1FA8C",
    function: "#F8F8F2",
    type:     "#8BE9FD",
    comment:  "#6272A4",
    operator: "#F04060",
  },
} as const;

// ── 6. Dusk ─────────────────────────────────────────────────────────
// Muted purple twilight — soft sunset hues fading into night.

export const duskTheme: StormColors = {
  brand: {
    primary: "#B898D8",   // Storm dusk — slightly warmer iris
    light:   "#D0B8E8",   // Lighter (+20% white)
    glow:    "#9070B0",   // Dimmer (−20%)
  },

  text: {
    primary:   "#E0DEF4",
    secondary: "#908CAA",
    dim:       "#6E6A86",
    disabled:  "#403D52",
  },

  surface: {
    base:      "#14121E",   // Deeper purple-black
    raised:    "#1C1A2A",
    overlay:   "#242034",
    highlight: "#403D52",
  },

  divider: "#1C1A2A",

  success: "#80C0B8",   // Sage-teal, less cyan — Storm's twilight green
  warning: "#D8A870",   // Amber-rose — unique warm accent
  error:   "#EB6F92",
  info:    "#31748F",

  system:    { text: "#6E6A86" },
  user:      { symbol: "#B898D8" },
  assistant: { symbol: "#80C0B8" },
  thinking:  { symbol: "#B898D8", shimmer: "#D0B8E8" },

  tool: {
    running:   "#B898D8",
    completed: "#80C0B8",
    failed:    "#EB6F92",
    pending:   "#908CAA",
    cancelled: "#6E6A86",
  },

  approval: {
    approve: "#80C0B8",
    deny:    "#EB6F92",
    always:  "#D8A870",
    header:  "#E0DEF4",
    border:  "#1C1A2A",
  },

  input: {
    border:       "#1C1A2A",
    borderActive: "#B898D8",
    prompt:       "#B898D8",
  },

  diff: {
    added:     "#80C0B8",
    removed:   "#EB6F92",
    addedBg:   "#141E1C",   // Deep tinted success
    removedBg: "#24141C",   // Deep tinted error
  },

  syntax: {
    keyword:  "#B898D8",
    string:   "#80C0B8",
    number:   "#D8A870",
    function: "#E0DEF4",
    type:     "#31748F",
    comment:  "#6E6A86",
    operator: "#EB6F92",
  },
} as const;

// ── 7. Horizon ──────────────────────────────────────────────────────
// Precise blue-gold — clean, balanced, engineered for clarity.

export const horizonTheme: StormColors = {
  brand: {
    primary: "#2890C8",   // Storm horizon — slightly greener blue
    light:   "#58B0D8",   // Lighter (+20% white)
    glow:    "#1C6898",   // Dimmer (−20%)
  },

  text: {
    primary:   "#839496",
    secondary: "#657B83",
    dim:       "#586E75",
    disabled:  "#073642",
  },

  surface: {
    base:      "#001E28",   // Tighter, less green-tinted
    raised:    "#042E38",
    overlay:   "#083E4C",
    highlight: "#0A5264",
  },

  divider: "#042E38",

  success: "#68A828",   // Less harsh yellow-green, more natural
  warning: "#C89830",   // Brighter, less muddy
  error:   "#DC322F",
  info:    "#2AA198",

  system:    { text: "#586E75" },
  user:      { symbol: "#2890C8" },
  assistant: { symbol: "#68A828" },
  thinking:  { symbol: "#2890C8", shimmer: "#58B0D8" },

  tool: {
    running:   "#2890C8",
    completed: "#68A828",
    failed:    "#DC322F",
    pending:   "#657B83",
    cancelled: "#586E75",
  },

  approval: {
    approve: "#68A828",
    deny:    "#DC322F",
    always:  "#C89830",
    header:  "#839496",
    border:  "#042E38",
  },

  input: {
    border:       "#042E38",
    borderActive: "#2890C8",
    prompt:       "#2890C8",
  },

  diff: {
    added:     "#68A828",
    removed:   "#DC322F",
    addedBg:   "#081E08",   // Deep tinted success
    removedBg: "#240808",   // Deep tinted error
  },

  syntax: {
    keyword:  "#2890C8",
    string:   "#68A828",
    number:   "#C89830",
    function: "#839496",
    type:     "#2AA198",
    comment:  "#586E75",
    operator: "#DC322F",
  },
} as const;

// ── 8. Neon ─────────────────────────────────────────────────────────
// Hyper-saturated warm electric for maximum visual punch.

export const neonTheme: StormColors = {
  brand: {
    primary: "#FFB800",
    light:   "#FFD000",
    glow:    "#CC9200",
  },

  surface: {
    base:      "#1A1510",
    raised:    "#241E16",
    overlay:   "#302820",
    highlight: "#3A3020",
  },

  text: {
    primary:   "#F0E0C8",
    secondary: "#C8B8A0",
    dim:       "#8A7A60",
    disabled:  "#504030",
  },

  success: "#A0D060",
  warning: "#FFB800",
  error:   "#FF4040",
  info:    "#60C0D0",

  user:      { symbol: "#FFB800" },
  assistant: { symbol: "#A0D060" },
  system:    { text: "#8A7A60" },
  thinking:  { symbol: "#FFB800", shimmer: "#FFD000" },

  tool: {
    pending:   "#C8B8A0",
    running:   "#FFB800",
    completed: "#A0D060",
    failed:    "#FF4040",
    cancelled: "#8A7A60",
  },

  approval: {
    border:  "#504030",
    header:  "#F0E0C8",
    approve: "#A0D060",
    deny:    "#FF4040",
    always:  "#FFB800",
  },

  input: {
    border:       "#504030",
    borderActive: "#FFB800",
    prompt:       "#FFB800",
  },

  divider: "#504030",

  diff: {
    added:     "#A0D060",
    addedBg:   "#1A2810",
    removed:   "#FF4040",
    removedBg: "#2A1010",
  },

  syntax: {
    keyword:  "#FFB800",
    string:   "#A0D060",
    number:   "#FFD000",
    comment:  "#8A7A60",
    type:     "#60C0D0",
    operator: "#FF4040",
    function: "#F0E0C8",
  },
} as const;

// ── Calm ────────────────────────────────────────────────────────────
// Desaturated warm tones for long coding sessions.

export const calmTheme: StormColors = {
  brand: {
    primary: "#C49848",
    light:   "#D4A858",
    glow:    "#A07830",
  },

  surface: {
    base:      "#1E1A15",
    raised:    "#262018",
    overlay:   "#302820",
    highlight: "#352D22",
  },

  text: {
    primary:   "#D0C0A8",
    secondary: "#A09080",
    dim:       "#6A5E50",
    disabled:  "#403828",
  },

  success: "#7A9A50",
  warning: "#C49848",
  error:   "#B85050",
  info:    "#6090A0",

  user:      { symbol: "#C49848" },
  assistant: { symbol: "#7A9A50" },
  system:    { text: "#6A5E50" },
  thinking:  { symbol: "#C49848", shimmer: "#D4A858" },

  tool: {
    pending:   "#A09080",
    running:   "#C49848",
    completed: "#7A9A50",
    failed:    "#B85050",
    cancelled: "#6A5E50",
  },

  approval: {
    border:  "#6A5E50",
    header:  "#D0C0A8",
    approve: "#7A9A50",
    deny:    "#B85050",
    always:  "#C49848",
  },

  input: {
    border:       "#403828",
    borderActive: "#C49848",
    prompt:       "#C49848",
  },

  divider: "#403828",

  diff: {
    added:     "#7A9A50",
    addedBg:   "#182010",
    removed:   "#B85050",
    removedBg: "#241414",
  },

  syntax: {
    keyword:  "#C49848",
    string:   "#7A9A50",
    number:   "#D4A858",
    comment:  "#6A5E50",
    type:     "#6090A0",
    operator: "#B85050",
    function: "#D0C0A8",
  },
} as const;

// ── High Contrast ───────────────────────────────────────────────────
// Maximum readability for accessibility.

export const highContrastTheme: StormColors = {
  brand: {
    primary: "#FFFFFF",
    light:   "#FFFFFF",
    glow:    "#FFFFFF",
  },

  surface: {
    base:      "#000000",
    raised:    "#0A0800",
    overlay:   "#141000",
    highlight: "#282000",
  },

  text: {
    primary:   "#FFFFFF",
    secondary: "#CCCCCC",
    dim:       "#999999",
    disabled:  "#666666",
  },

  success: "#88FF44",
  warning: "#FFCC00",
  error:   "#FF4444",
  info:    "#44DDEE",

  user:      { symbol: "#FFFFFF" },
  assistant: { symbol: "#88FF44" },
  system:    { text: "#999999" },
  thinking:  { symbol: "#FFCC00", shimmer: "#FFFFFF" },

  tool: {
    pending:   "#CCCCCC",
    running:   "#FFCC00",
    completed: "#88FF44",
    failed:    "#FF4444",
    cancelled: "#666666",
  },

  approval: {
    border:  "#FFFFFF",
    header:  "#FFFFFF",
    approve: "#88FF44",
    deny:    "#FF4444",
    always:  "#FFCC00",
  },

  input: {
    border:       "#999999",
    borderActive: "#FFFFFF",
    prompt:       "#FFFFFF",
  },

  divider: "#999999",

  diff: {
    added:     "#88FF44",
    addedBg:   "#0A2200",
    removed:   "#FF4444",
    removedBg: "#330000",
  },

  syntax: {
    keyword:  "#FFFFFF",
    string:   "#88FF44",
    number:   "#FFCC00",
    comment:  "#999999",
    type:     "#44DDEE",
    operator: "#FF4444",
    function: "#FFFFFF",
  },
} as const;

// ── Monochrome ──────────────────────────────────────────────────────
// Minimal all-grey theme with no color.

export const monochromeTheme: StormColors = {
  brand: {
    primary: "#E0E0E0",
    light:   "#F0F0F0",
    glow:    "#F8F8F8",
  },

  surface: {
    base:      "#0E0E0E",
    raised:    "#181818",
    overlay:   "#222222",
    highlight: "#2E2E2E",
  },

  text: {
    primary:   "#D4D4D4",
    secondary: "#A0A0A0",
    dim:       "#707070",
    disabled:  "#505050",
  },

  success: "#D4D4D4",
  warning: "#A0A0A0",
  error:   "#E0E0E0",
  info:    "#B0B0B0",

  user:      { symbol: "#E0E0E0" },
  assistant: { symbol: "#D4D4D4" },
  system:    { text: "#707070" },
  thinking:  { symbol: "#A0A0A0", shimmer: "#F0F0F0" },

  tool: {
    pending:   "#808080",
    running:   "#C0C0C0",
    completed: "#E0E0E0",
    failed:    "#A0A0A0",
    cancelled: "#606060",
  },

  approval: {
    border:  "#707070",
    header:  "#E0E0E0",
    approve: "#D4D4D4",
    deny:    "#A0A0A0",
    always:  "#C0C0C0",
  },

  input: {
    border:       "#505050",
    borderActive: "#E0E0E0",
    prompt:       "#D4D4D4",
  },

  divider: "#404040",

  diff: {
    added:     "#D4D4D4",
    addedBg:   "#1A1A1A",
    removed:   "#A0A0A0",
    removedBg: "#2A2A2A",
  },

  syntax: {
    keyword:  "#E0E0E0",
    string:   "#C0C0C0",
    number:   "#B0B0B0",
    comment:  "#707070",
    type:     "#D4D4D4",
    operator: "#A0A0A0",
    function: "#E0E0E0",
  },
} as const;
