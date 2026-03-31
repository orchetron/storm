/**
 * Style extraction and merge utilities for Storm components.
 */

// Keys for each tier
const CONTAINER_KEYS = new Set([
  "color","bold","dim",
  "width","height","minWidth","maxWidth",
  "margin","marginX","marginY","marginTop","marginBottom","marginLeft","marginRight",
  "padding","paddingX","paddingY","paddingTop","paddingBottom","paddingLeft","paddingRight",
  "borderStyle","borderColor","backgroundColor",
]);

/**
 * Merge component defaults with user style overrides.
 * Performs a shallow spread-merge: user overrides win per-prop (no shorthand expansion).
 */
export function mergeBoxStyles(
  defaults: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...defaults };

  // Apply individual props — user overrides win
  for (const key of Object.keys(overrides)) {
    if (overrides[key] !== undefined) {
      result[key] = overrides[key];
    }
  }

  return result;
}

/**
 * Pick style props from a combined props object.
 * Returns only the style-related props, skipping undefined values.
 */
export function pickStyleProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of CONTAINER_KEYS) {
    if (key in props && props[key] !== undefined) {
      result[key] = props[key];
    }
  }
  return result;
}
