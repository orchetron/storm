import { colors as defaultColors } from "../theme/colors.js";
import { createPersonality, type StormPersonality } from "./personality.js";

// Current Storm style — amber accent, round borders, easeOut
// animations, "❯" prompt, "bar" focus indicator.

export const defaultPreset: StormPersonality = createPersonality({});

// Thin single borders, no animations, ">" prompt, "arrow" focus,
// reduced spacing. For distraction-free work.

export const minimalPreset: StormPersonality = createPersonality({
  borders: {
    default: "single",
    focused: "single",
    accent: "single",
    panel: "single",
  },

  animation: {
    durationFast: 0,
    durationNormal: 0,
    durationSlow: 0,
    easing: "linear",
    reducedMotion: true,
    spinnerType: "line",
  },

  typography: {
    headingBold: true,
    headingColor: defaultColors.text.primary,
    codeBg: defaultColors.surface.raised,
    linkColor: defaultColors.text.secondary,
    linkUnderline: false,
  },

  interaction: {
    focusIndicator: "arrow",
    selectionChar: ">",
    promptChar: ">",
    cursorStyle: "underline",
    collapseHint: "enter to expand",
  },

  components: {
    Card: { paddingLeft: 1, paddingRight: 1, paddingTop: 0, paddingBottom: 0 },
    Modal: { padding: 0 },
  },
});

// ASCII borders, green accent (#00FF00), "$" prompt, fast
// animations, braille spinner. Terminal purist.

export const hackerPreset: StormPersonality = createPersonality({
  colors: {
    brand: {
      primary: "#00FF00",
      light: "#33FF33",
      glow: "#00CC00",
    },
    text: {
      primary: "#00FF00",
      secondary: "#00AA00",
      dim: "#006600",
      disabled: "#003300",
    },
    surface: {
      base: "#000000",
      raised: "#0A0A0A",
      overlay: "#111111",
      highlight: "#1A1A1A",
    },
    divider: "#003300",
    success: "#00FF00",
    warning: "#FFFF00",
    error: "#FF0000",
    info: "#00FFFF",
    input: {
      border: "#003300",
      borderActive: "#00FF00",
      prompt: "#00FF00",
    },
  },

  borders: {
    default: "ascii",
    focused: "ascii",
    accent: "ascii",
    panel: "ascii",
  },

  animation: {
    durationFast: 50,
    durationNormal: 100,
    durationSlow: 200,
    easing: "linear",
    reducedMotion: false,
    spinnerType: "braille",
  },

  typography: {
    headingBold: true,
    headingColor: "#00FF00",
    codeBg: "#0A0A0A",
    linkColor: "#00FFFF",
    linkUnderline: true,
  },

  interaction: {
    focusIndicator: "highlight",
    selectionChar: ">",
    promptChar: "$",
    cursorStyle: "block",
    collapseHint: "enter to expand",
  },
});

// Round borders, bouncy animations, "→" prompt, colorful, slow
// easing. Fun and expressive.

export const playfulPreset: StormPersonality = createPersonality({
  colors: {
    brand: {
      primary: "#FF6B9D",
      light: "#FFA0C4",
      glow: "#E05080",
    },
    info: "#7B68EE",
  },

  borders: {
    default: "round",
    focused: "double",
    accent: "heavy",
    panel: "round",
  },

  animation: {
    durationFast: 150,
    durationNormal: 300,
    durationSlow: 600,
    easing: "easeInOut",
    reducedMotion: false,
    spinnerType: "bounce",
  },

  typography: {
    headingBold: true,
    headingColor: "#FF6B9D",
    codeBg: "#1A1028",
    linkColor: "#7B68EE",
    linkUnderline: true,
  },

  interaction: {
    focusIndicator: "border",
    selectionChar: "\u2192",   // →
    promptChar: "\u2192",       // →
    cursorStyle: "bar",
    collapseHint: "press enter to expand",
  },
});
