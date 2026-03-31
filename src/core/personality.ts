/**
 * StormPersonality -- full interaction identity beyond color themes.
 *
 * A personality encapsulates colors, borders, animation timing,
 * typography, interaction style, and component defaults into a
 * single coherent identity. Components read personality via
 * usePersonality() and use it as fallback defaults that explicit
 * props override.
 */

import React, { createContext, useContext, useMemo, useRef } from "react";
import type { StormColors } from "../theme/colors.js";
import { colors as defaultColors } from "../theme/colors.js";
import { useTheme } from "../theme/provider.js";
import type { BorderStyle } from "./types.js";

// ── Types ──────────────────────────────────────────────────────────

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

// ── Deep merge ─────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMergeObj<T extends Record<string, unknown>>(
  base: T,
  overrides: Record<string, unknown>,
): T {
  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(overrides)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const baseVal = result[key];
    const overVal = overrides[key];
    if (isPlainObject(baseVal) && isPlainObject(overVal)) {
      result[key] = deepMergeObj(baseVal as Record<string, unknown>, overVal);
    } else {
      result[key] = overVal;
    }
  }
  return result as T;
}

// ── Default personality ────────────────────────────────────────────

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
    selectionChar: "\u25C6",      // ◆ (diamond — the assistant symbol)
    promptChar: "\u203A",          // ›
    cursorStyle: "block",
    collapseHint: "ctrl+o to expand",
  },

  components: {},
};

// ── Factory functions ──────────────────────────────────────────────

/**
 * Create a full personality by merging partial overrides onto the
 * default personality. Only the properties you specify are replaced.
 */
export function createPersonality(
  overrides: DeepPartialPersonality<StormPersonality>,
): StormPersonality {
  return deepMergeObj(
    defaultPersonality as unknown as Record<string, unknown>,
    overrides as unknown as Record<string, unknown>,
  ) as unknown as StormPersonality;
}

/**
 * Merge overrides onto an existing personality.
 * Returns a new object; the base is not mutated.
 */
export function mergePersonality(
  base: StormPersonality,
  overrides: DeepPartialPersonality<StormPersonality>,
): StormPersonality {
  return deepMergeObj(
    base as unknown as Record<string, unknown>,
    overrides as unknown as Record<string, unknown>,
  ) as unknown as StormPersonality;
}

// ── React context ──────────────────────────────────────────────────

const PersonalityContext = createContext<StormPersonality>(defaultPersonality);

/**
 * Provide a StormPersonality to all descendant components.
 * Components use usePersonality() to read the active personality.
 */
export function PersonalityProvider(props: {
  personality: StormPersonality;
  children: React.ReactNode;
}): React.ReactElement {
  const cacheRef = useRef<{
    personality: StormPersonality;
    value: StormPersonality;
  } | null>(null);

  // Only rebuild if personality reference changes
  if (!cacheRef.current || cacheRef.current.personality !== props.personality) {
    cacheRef.current = {
      personality: props.personality,
      value: props.personality,
    };
  }

  return React.createElement(
    PersonalityContext.Provider,
    { value: cacheRef.current.value },
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
    // Merge the active theme colors into the personality, but only
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
