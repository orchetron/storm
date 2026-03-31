/**
 * Safety Guards — hard limits and validation helpers that prevent
 * runaway recursion, oversized buffers, and invalid layout props
 * from crashing the renderer.
 *
 * @module
 */

/** Maximum layout tree depth to prevent stack overflow. */
export const MAX_LAYOUT_DEPTH = 100;

/** Maximum children per node. */
export const MAX_CHILDREN = 10_000;

/** Maximum buffer width in columns. */
export const MAX_BUFFER_WIDTH = 1000;

/** Maximum buffer height in rows. */
export const MAX_BUFFER_HEIGHT = 500;

/**
 * Clamp a numeric value to `[0, max]`.
 * Returns 0 for negative/NaN values and `max` for values exceeding the cap.
 */
export function clampDimension(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, max);
}

/**
 * Validate a set of layout props and throw a descriptive error
 * when any value is outside safe bounds.
 *
 * Checks performed:
 * - `width` / `height` must be non-negative finite numbers (if present).
 * - `flex` must be non-negative (if present).
 * - `gap` must be non-negative (if present).
 * - `padding*` / `margin*` must be non-negative (if present).
 */
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

/**
 * Returns `true` when the terminal stdout stream is still connected
 * and writable. Useful for detecting detached TTYs or closed pipes.
 */
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
