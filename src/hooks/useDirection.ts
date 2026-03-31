/**
 * useDirection — hook returning the text direction of the current locale.
 *
 * Convenience wrapper over useLocale() for components that only
 * need to know LTR vs RTL (e.g. for padding/alignment decisions).
 */

import { useLocale } from "./useLocale.js";

/**
 * Returns `"ltr"` or `"rtl"` based on the current locale.
 *
 * @example
 * ```tsx
 * function MyRow() {
 *   const dir = useDirection();
 *   return <Box flexDirection={dir === "rtl" ? "row-reverse" : "row"}>...</Box>;
 * }
 * ```
 */
export function useDirection(): "ltr" | "rtl" {
  const locale = useLocale();
  return locale.direction;
}
