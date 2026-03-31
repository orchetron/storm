/**
 * Storm color palette.
 *
 * Near-monochrome base. One accent: Electric Arc Blue (#82AAFF).
 * Used sparingly — borders, prompts, active states.
 * Everything else is neutral gray.
 */

export type StormColors = {
  brand: { primary: string; light: string; glow: string };
  text: { primary: string; secondary: string; dim: string; disabled: string };
  surface: { base: string; raised: string; overlay: string; highlight: string };
  divider: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  system: { text: string };
  user: { symbol: string };
  assistant: { symbol: string };
  thinking: { symbol: string; shimmer: string };
  tool: { running: string; completed: string; failed: string; pending: string; cancelled: string };
  approval: { approve: string; deny: string; always: string; header: string; border: string };
  input: { border: string; borderActive: string; prompt: string };
  diff: { added: string; removed: string; addedBg: string; removedBg: string };
  syntax: { keyword: string; string: string; number: string; function: string; type: string; comment: string; operator: string };
};

export const colors: StormColors = {
  brand: {
    primary: "#82AAFF",   // Electric Arc Blue — the one accent
    light:   "#A8C8FF",   // Lighter Arc — active states
    glow:    "#5A8AE0",   // Deeper Arc — subtle emphasis
  },

  text: {
    primary:   "#D4D4D4", // Clean light gray
    secondary: "#808080", // Mid gray
    dim:       "#505050", // Quiet
    disabled:  "#333333", // Near-invisible
  },

  surface: {
    base:      "#0A0A0A", // Near-black
    raised:    "#141414", // Panels
    overlay:   "#1C1C1C", // Modals
    highlight: "#242424", // Selection
  },

  divider: "#1E1E1E",

  success: "#34D399",     // Emerald
  warning: "#FBBF24",     // Amber
  error:   "#F87171",     // Soft red
  info:    "#7AA2F7",     // Complementary blue — informational, harmonizes with arc blue

  system: { text: "#505050" },
  user:   { symbol: "#D4D4D4" },
  assistant: { symbol: "#82AAFF" },
  thinking: { symbol: "#82AAFF", shimmer: "#A8C8FF" },

  tool: {
    running:   "#82AAFF",
    completed: "#34D399",
    failed:    "#F87171",
    pending:   "#505050",
    cancelled: "#333333",
  },

  approval: {
    approve: "#34D399",
    deny:    "#F87171",
    always:  "#FBBF24",
    header:  "#D4D4D4",
    border:  "#1E1E1E",
  },

  input: {
    border:       "#1E1E1E",
    borderActive: "#82AAFF",
    prompt:       "#82AAFF",
  },

  diff: {
    added:     "#34D399",
    removed:   "#F87171",
    addedBg:   "#0d2818",
    removedBg: "#2d0f0f",
  },

  syntax: {
    keyword:  "#C792EA",   // Soft purple — keywords distinct from brand
    string:   "#C3E88D",   // Lime green — strings pop
    number:   "#F78C6C",   // Warm orange — numbers
    function: "#82AAFF",   // Soft blue — functions
    type:     "#FFCB6B",   // Warm yellow — types
    comment:  "#505050",   // Quiet — comments recede
    operator: "#89DDFF",   // Light cyan — operators
  },
} as const;
