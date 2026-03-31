/**
 * usePluginProps — apply plugin-level prop transformations to a component's props.
 *
 * Called at the top of component render functions to let plugins inject
 * default props and intercept/modify props before rendering.
 *
 * IMPORTANT: No try/catch around hook calls — that would violate React's
 * rules of hooks by causing different hook counts between renders.
 */

import { usePluginManager } from "./usePlugin.js";

/**
 * Apply plugin-level prop transformations to a component's props.
 *
 * @param componentName - The component's display name (e.g., "Select", "Button")
 * @param props - The component's raw props
 * @returns Modified props with plugin defaults applied
 */
export function usePluginProps<T extends Record<string, unknown>>(
  componentName: string,
  props: T,
): T {
  // Always call the hook — never conditionally skip it
  const manager = usePluginManager();

  // If no plugins registered, return props as-is (fast path)
  if (!manager || manager.getAll().length === 0) {
    return props;
  }

  return manager.applyComponentProps(componentName, props) as T;
}
