export const MAX_LAYOUT_DEPTH = 100;
export const MAX_CHILDREN = 10_000;
export const MAX_BUFFER_WIDTH = 1000;
export const MAX_BUFFER_HEIGHT = 500;

/** Returns 0 for negative/NaN values and `max` for values exceeding the cap. */
export function clampDimension(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, max);
}

/** Throws if any layout prop value is outside safe bounds. */
export function validateLayoutProps(props: Record<string, unknown>): void {
  const nonNegativeKeys = [
    "width",
    "height",
    "minWidth",
    "minHeight",
    "maxWidth",
    "maxHeight",
    "flex",
    "flexGrow",
    "flexShrink",
    "gap",
    "rowGap",
    "columnGap",
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
  ];

  for (const key of nonNegativeKeys) {
    const val = props[key];
    if (val === undefined || val === null) continue;
    if (typeof val === "string") continue; // percentage strings like "50%"
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw new Error(`Invalid layout prop "${key}": expected a finite number, got ${String(val)}`);
    }
    if (val < 0) {
      throw new Error(`Invalid layout prop "${key}": must be non-negative, got ${val}`);
    }
  }
}

/** Detects detached TTYs or closed pipes. */
export function isTerminalAlive(stdout: NodeJS.WriteStream): boolean {
  try {
    return (
      !stdout.destroyed &&
      stdout.writable
    );
  } catch {
    return false;
  }
}
