/**
 * useMeasure — read layout measurements for an element.
 *
 * Returns the computed layout result (x, y, width, height) for an
 * element identified by its `_measureId` prop. The renderer stores
 * layout results in the render context's measureMap after each paint pass.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const layout = useMeasure("my-box");
 *   return (
 *     <Box _measureId="my-box">
 *       {layout && <Text>Size: {layout.width}x{layout.height}</Text>}
 *     </Box>
 *   );
 * }
 * ```
 */

import { useTui } from "../context/TuiContext.js";
import type { MeasuredLayout } from "../reconciler/renderer.js";

/**
 * Read layout results for an element with the given `_measureId`.
 * Returns null if the element has not been painted yet.
 *
 * Note: measurements are populated AFTER each paint pass, so the
 * returned value reflects the PREVIOUS frame's layout. The value
 * will be picked up on the next render cycle via `requestRender` /
 * `forceReactFlush` which already trigger re-renders on scroll and
 * state changes.
 */
export function useMeasure(elementId: string): MeasuredLayout | null {
  const { renderContext } = useTui();
  return renderContext.measureMap.get(elementId) ?? null;
}
