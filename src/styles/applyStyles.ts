// Keys for each tier
const LAYOUT_KEYS = new Set([
  "width","height","minWidth","minHeight","maxWidth","maxHeight",
  "flex","flexGrow","flexShrink","flexBasis","flexDirection","flexWrap",
  "gap","columnGap","rowGap",
  "alignItems","alignSelf","justifyContent",
  "overflow","overflowX","overflowY",
  "display","position","top","left","right","bottom",
  "margin","marginX","marginY","marginTop","marginBottom","marginLeft","marginRight",
]);

const CONTAINER_KEYS = new Set([
  "color","bold","dim",
  ...LAYOUT_KEYS,
  "padding","paddingX","paddingY","paddingTop","paddingBottom","paddingLeft","paddingRight",
  "borderStyle","borderColor",
  "borderTop","borderBottom","borderLeft","borderRight",
  "borderDimColor","borderTopDimColor","borderBottomDimColor","borderLeftDimColor","borderRightDimColor",
  "backgroundColor","opaque",
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

  for (const key of Object.keys(overrides)) {
    if (overrides[key] !== undefined) {
      result[key] = overrides[key];
    }
  }

  return result;
}

/** Extract only layout props (flex, size, margin, position) from a mixed props bag. For Box/ScrollView. */
export function pickLayoutProps<T>(props: T): Record<string, unknown> {
  const p = props as unknown as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of LAYOUT_KEYS) {
    if (key in p && p[key] !== undefined) {
      result[key] = p[key];
    }
  }
  return result;
}

/** Extract layout + visual props (border, padding, bg, color). Superset of pickLayoutProps. */
export function pickStyleProps<T>(props: T): Record<string, unknown> {
  const p = props as unknown as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of CONTAINER_KEYS) {
    if (key in p && p[key] !== undefined) {
      result[key] = p[key];
    }
  }
  return result;
}
