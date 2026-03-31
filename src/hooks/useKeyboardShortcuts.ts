/**
 * useKeyboardShortcuts — declarative keyboard shortcut system.
 *
 * Maps key events against a list of shortcut definitions and
 * invokes the matching handler. Uses refs for latest shortcuts
 * and active state.
 */

import { useRef } from "react";
import { useInput } from "./useInput.js";

export interface Shortcut {
  /** The key name, e.g. "f", "return", "escape" */
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: () => void;
  /** Description for help display */
  description?: string;
}

export function useKeyboardShortcuts(
  shortcuts: Shortcut[],
  options: { isActive?: boolean } = {},
): void {
  const isActive = options.isActive ?? true;

  // Store in refs for latest values
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;
  const activeRef = useRef(isActive);
  activeRef.current = isActive;

  useInput((event) => {
    if (!activeRef.current) return;

    for (const shortcut of shortcutsRef.current) {
      const ctrlMatch = (shortcut.ctrl ?? false) === event.ctrl;
      const metaMatch = (shortcut.meta ?? false) === event.meta;
      const shiftMatch = (shortcut.shift ?? false) === event.shift;
      const keyMatch = event.key === shortcut.key;

      if (keyMatch && ctrlMatch && metaMatch && shiftMatch) {
        shortcut.handler();
        return;
      }
    }
  });
}
