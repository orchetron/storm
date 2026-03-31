/**
 * useAdaptive — hook providing the adaptive rendering config.
 *
 * Detects terminal capabilities once (on first call) and caches
 * the result in a ref so every subsequent render is free.
 *
 * @example
 * ```tsx
 * const adaptive = useAdaptive();
 * // adaptive.imageProtocol  → "kitty" | "iterm2" | "sixel" | "block"
 * // adaptive.colorDepth     → "truecolor" | "256" | "16" | "basic"
 * // adaptive.unicode        → boolean
 * ```
 */

import { useRef } from "react";
import { createAdaptiveConfig, type AdaptiveConfig } from "../core/adaptive.js";

/**
 * Return the adaptive rendering configuration for the current terminal.
 *
 * The config is computed once and cached for the lifetime of the
 * component. It is safe to call from any component — every call site
 * within the same React tree shares the same detection cost (one
 * `detectTerminal()` call per `useRef` initialisation).
 */
export function useAdaptive(): AdaptiveConfig {
  const ref = useRef<AdaptiveConfig | null>(null);
  if (ref.current === null) {
    ref.current = createAdaptiveConfig();
  }
  return ref.current;
}
