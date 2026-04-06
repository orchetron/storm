import React, { createContext, useContext, useMemo } from "react";
import type { StormColors } from "../theme/colors.js";
import { colors as defaultColors } from "../theme/colors.js";
import { useTheme } from "../theme/provider.js";
import type { BorderStyle } from "./types.js";
import { deepMerge } from "../theme/utils.js";

/** Controls colors, borders, animation timing, typography, focus indicators, and per-component defaults. */
export interface StormPersonality {
  /** Color theme (existing StormColors). */
  colors: StormColors;

  /** Border personality — style per usage context. */
  borders: {
    default: BorderStyle;
    focused: BorderStyle;
    accent: BorderStyle;
    panel: BorderStyle;
  };

  /** Animation personality — timing and motion preferences. */
  animation: {
    durationFast: number;
    durationNormal: number;
    durationSlow: number;
    easing: "linear" | "easeIn" | "easeOut" | "easeInOut";
    reducedMotion: boolean;
    spinnerType: string;
  };

  /** Typography defaults. */
  typography: {
    headingBold: boolean;
    headingColor: string;
    codeBg: string;
    linkColor: string;
    linkUnderline: boolean;
  };

  /** Interaction style — how the UI communicates intent. */
  interaction: {
    focusIndicator: "border" | "highlight" | "arrow" | "bar";
    selectionChar: string;
    promptChar: string;
    cursorStyle: "block" | "underline" | "bar";
    collapseHint: string;
  };

  /** Component defaults — override any prop for any component by name. */
  components: Record<string, Record<string, unknown>>;
}

/** Recursively makes all properties optional. */
export type DeepPartialPersonality<T> = {
  [P in keyof T]?: T[P] extends Record<string, unknown> ? DeepPartialPersonality<T[P]> : T[P];
};

export const defaultPersonality: StormPersonality = {
  colors: defaultColors,

  borders: {
    default: "round",
    focused: "round",
    accent: "double",
    panel: "round",
  },

  animation: {
    durationFast: 100,
    durationNormal: 200,
    durationSlow: 400,
    easing: "easeOut",
    reducedMotion: false,
    spinnerType: "diamond",
  },

  typography: {
    headingBold: true,
    headingColor: defaultColors.text.primary,
    codeBg: defaultColors.surface.raised,
    linkColor: defaultColors.info,
    linkUnderline: true,
  },

  interaction: {
    focusIndicator: "bar",
    selectionChar: "\u25C6",      // ◆ (diamond — selection indicator)
    promptChar: "\u203A",          // ›
    cursorStyle: "block",
    collapseHint: "ctrl+o to expand",
  },

  components: {},
};

/**
 * Create a full personality by merging partial overrides onto the
 * default personality. Only the properties you specify are replaced.
 */
export function createPersonality(
  overrides: DeepPartialPersonality<StormPersonality>,
): StormPersonality {
  return deepMerge(defaultPersonality, overrides as Partial<StormPersonality>);
}

/**
 * Merge overrides onto an existing personality.
 * Returns a new object; the base is not mutated.
 */
export function mergePersonality(
  base: StormPersonality,
  overrides: DeepPartialPersonality<StormPersonality>,
): StormPersonality {
  return deepMerge(base, overrides as Partial<StormPersonality>);
}

const PersonalityContext = createContext<StormPersonality>(defaultPersonality);

/**
 * Provide a StormPersonality to all descendant components.
 * Components use usePersonality() to read the active personality.
 */
export function PersonalityProvider(props: {
  personality: StormPersonality;
  children: React.ReactNode;
}): React.ReactElement {
  return React.createElement(
    PersonalityContext.Provider,
    { value: props.personality },
    props.children,
  );
}

/**
 * Read the active StormPersonality from context, with colors
 * always reflecting the active theme (not the static dark-theme
 * defaults captured at module load time).
 *
 * If a PersonalityProvider supplies an explicit `colors` override
 * that differs from the default dark palette, that override is
 * preserved. Otherwise the colors (and color-derived typography
 * fields) are replaced with the live theme from ThemeProvider.
 */
export function usePersonality(): StormPersonality {
  const base = useContext(PersonalityContext);
  const themeColors = useTheme().colors;

  return useMemo(() => {
    // when the personality uses the default color palette. Custom
    // personality colors (e.g. hackerPreset, playfulPreset) are preserved.
    const colors = base.colors === defaultPersonality.colors ? themeColors : base.colors;
    const typography = { ...base.typography } as StormPersonality["typography"];

    // Only patch typography values that still match the original
    // dark-theme defaults — if the personality explicitly set them
    // to something custom, leave them alone.
    if (base.typography.headingColor === defaultColors.text.primary) {
      typography.headingColor = colors.text.primary;
    }
    if (base.typography.codeBg === defaultColors.surface.raised) {
      typography.codeBg = colors.surface.raised;
    }
    if (base.typography.linkColor === defaultColors.info) {
      typography.linkColor = colors.info;
    }

    return {
      ...base,
      colors,
      typography,
    };
  }, [base, themeColors]);
}

export { PersonalityContext };
