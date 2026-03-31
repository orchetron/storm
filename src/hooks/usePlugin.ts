/**
 * usePluginManager — access the PluginManager from components.
 *
 * Reads from TuiContext's renderContext and returns a shared PluginManager
 * instance. If none exists yet, creates a default one and caches it.
 */

import { useRef } from "react";
import { PluginManager } from "../core/plugin.js";

// Module-level default instance — shared across all components in a render tree
// when no explicit PluginManager is provided.
let defaultManager: PluginManager | null = null;

function getDefaultManager(): PluginManager {
  if (!defaultManager) {
    defaultManager = new PluginManager();
  }
  return defaultManager;
}

/**
 * Access the PluginManager from within a component.
 *
 * Returns a stable PluginManager instance that persists across renders.
 * Components can use this to register plugins, query custom elements,
 * or access plugin-provided shortcuts.
 */
export function usePluginManager(): PluginManager {
  const ref = useRef<PluginManager | null>(null);
  if (!ref.current) {
    ref.current = getDefaultManager();
  }
  return ref.current;
}

/**
 * Reset the default plugin manager. Useful for testing.
 * @internal
 */
export function _resetDefaultPluginManager(): void {
  defaultManager = null;
}
