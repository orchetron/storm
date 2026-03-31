/**
 * useReducedMotion — convenience hook for checking reduced-motion preference.
 *
 * Returns true if the user prefers reduced motion (e.g. no spinners, no shimmer).
 * Uses useAccessibility internally.
 */

import { useAccessibility } from "./useAccessibility.js";

/**
 * Returns true if reduced motion is preferred.
 *
 * Components should check this before starting animations:
 *
 * @example
 * ```tsx
 * function MySpinner() {
 *   const reducedMotion = useReducedMotion();
 *   if (reducedMotion) return <Text>*</Text>;
 *   return <Spinner />;
 * }
 * ```
 */
export function useReducedMotion(): boolean {
  return useAccessibility().reducedMotion;
}
