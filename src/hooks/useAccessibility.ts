import { useRef } from "react";
import { type AccessibilityOptions, detectAccessibility } from "../core/accessibility.js";

/**
 * Returns the current accessibility options.
 *
 * The options are detected once from environment variables and cached
 * in a ref so repeated calls within the same component are free.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const a11y = useAccessibility();
 *   if (a11y.reducedMotion) {
 *     return <Text>Loading...</Text>;
 *   }
 *   return <Spinner />;
 * }
 * ```
 */
export function useAccessibility(): AccessibilityOptions {
  const ref = useRef<AccessibilityOptions | null>(null);
  if (ref.current === null) {
    ref.current = detectAccessibility();
  }
  return ref.current;
}
