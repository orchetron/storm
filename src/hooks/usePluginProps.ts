import { usePluginManager } from "./usePlugin.js";

/**
 * Apply plugin-level prop transformations to a component's props.
 *
 * @param componentName - The component's display name (e.g., "Select", "Button")
 * @param props - The component's raw props
 * @returns Modified props with plugin defaults applied
 */
export function usePluginProps<T>(
  componentName: string,
  props: T,
): T {
  const manager = usePluginManager();

  if (!manager || manager.getAll().length === 0) {
    return props;
  }

  return manager.applyComponentProps(
    componentName,
    props as T & Record<string, unknown>,
  );
}
