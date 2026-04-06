import type { StormColors } from "../theme/colors.js";
import { useTheme } from "../theme/provider.js";

export function useColors(): StormColors {
  return useTheme().colors;
}
