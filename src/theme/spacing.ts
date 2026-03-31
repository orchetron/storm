/**
 * Spacing scale — consistent spacing tokens for Storm TUI.
 *
 * Used for padding, margin, gap throughout all components.
 * Base unit: 1 terminal cell.
 */
export const spacing = {
  none: 0,
  xs: 1,    // Tight: icon-to-label, inline elements
  sm: 1,    // Standard: within components
  md: 2,    // Comfortable: between components
  lg: 3,    // Spacious: between sections
  xl: 4,    // Major: page-level separation
} as const;

export type SpacingToken = keyof typeof spacing;
