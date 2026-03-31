/**
 * useHotkey — declarative hotkey registration with display labels.
 *
 * Registers all hotkeys via useInput. Returns the binding list for
 * rendering a help bar.
 *
 * Uses useRef + useInput.
 */

import { useRef } from "react";
import { useInput } from "./useInput.js";

export interface HotkeyDef {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  label: string;
  action: () => void;
}

export interface UseHotkeyOptions {
  hotkeys: HotkeyDef[];
  isActive?: boolean;
}

export interface UseHotkeyResult {
  /** All registered hotkeys with their labels — for rendering a help bar */
  bindings: Array<{ label: string; description: string }>;
}

function matchesHotkey(
  event: { key: string; char: string; ctrl: boolean; shift: boolean; meta: boolean },
  def: HotkeyDef,
): boolean {
  // Match by key name or char
  const keyMatch = event.key === def.key || event.char === def.key;
  if (!keyMatch) return false;
  if ((def.ctrl ?? false) !== event.ctrl) return false;
  if ((def.shift ?? false) !== event.shift) return false;
  if ((def.meta ?? false) !== event.meta) return false;
  return true;
}

export function useHotkey(options: UseHotkeyOptions): UseHotkeyResult {
  const { hotkeys, isActive = true } = options;

  const hotkeysRef = useRef(hotkeys);
  hotkeysRef.current = hotkeys;

  useInput(
    (event) => {
      for (const def of hotkeysRef.current) {
        if (matchesHotkey(event, def)) {
          def.action();
          return;
        }
      }
    },
    { isActive },
  );

  const bindings = hotkeys.map((def) => ({
    label: def.label,
    description: def.key,
  }));

  return { bindings };
}
