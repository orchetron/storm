/**
 * useColors — returns the current theme's color palette from React context.
 *
 * Replaces static `import { colors } from "../theme/colors.js"` in components
 * so that runtime theme switching via ThemeProvider actually takes effect.
 */
import type { StormColors } from "../theme/colors.js";
import { useTheme } from "../theme/provider.js";

export function useColors(): StormColors {
  return useTheme().colors;
}
