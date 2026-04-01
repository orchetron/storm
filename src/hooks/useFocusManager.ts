/**
 * useFocusManager — control the focus system.
 *
 * Programmatic focus control — cycle, focus by ID, get focused element,
 * and manage focus traps for modals/dialogs.
 */

import { useTui } from "../context/TuiContext.js";
import type { FocusChangeCallback, FocusRingMode, FocusRingStyle } from "../core/focus.js";

export interface UseFocusManagerResult {
  enableFocus: () => void;
  disableFocus: () => void;
  focusNext: () => void;
  focusPrevious: () => void;
  focus: (id: string) => void;
  /** Alias for focus(). Focuses a specific element by its ID. */
  focusById: (id: string) => void;
  /** Returns the currently focused element ID, or null. */
  getFocusedId: () => string | null;
  /** Trap Tab cycling within a focus group. Stackable. */
  trapFocus: (groupId: string) => void;
  /** Release the current focus trap. Restores the previous trap if nested. */
  releaseFocus: () => void;
  /** Returns true if a focus trap is currently active. */
  isTrapped: () => boolean;
  /** Returns the currently active trap group ID, or null. */
  activeGroup: () => string | null;
  /**
   * Register a callback that fires on every focus change with (newId, previousId).
   * Returns an unsubscribe function.
   */
  onFocusChange: (fn: FocusChangeCallback) => () => void;
  /** Handle Tab/Shift+Tab key. Cycles focus to next/prev enabled input. */
  handleTabKey: (shift: boolean) => void;
  /** Get the focus ring style for a specific element. */
  getFocusRingStyle: (id: string) => FocusRingStyle | null;
  /** Set the focus ring visual mode ("border" | "prefix" | "none"). */
  setFocusRingStyle: (mode: FocusRingMode) => void;
}

export function useFocusManager(): UseFocusManagerResult {
  const ctx = useTui();
  const fm = ctx.focus;

  return {
    enableFocus: () => {
      fm.enableFocus();
    },
    disableFocus: () => {
      fm.disableFocus();
    },
    focusNext: () => {
      fm.cycleNext();
    },
    focusPrevious: () => {
      fm.cyclePrev();
    },
    focus: (id: string) => {
      fm.focus(id);
    },
    focusById: (id: string) => {
      fm.focus(id);
    },
    getFocusedId: () => {
      return fm.focused;
    },
    trapFocus: (groupId: string) => {
      fm.trapFocus(groupId);
    },
    releaseFocus: () => {
      fm.releaseFocus();
    },
    isTrapped: () => {
      return fm.isTrapped;
    },
    activeGroup: () => {
      return fm.activeGroup;
    },
    onFocusChange: (fn: FocusChangeCallback) => {
      return fm.onFocusChange(fn);
    },
    handleTabKey: (shift: boolean) => {
      fm.handleTabKey(shift);
    },
    getFocusRingStyle: (id: string) => {
      return fm.getFocusRingStyle(id);
    },
    setFocusRingStyle: (mode: FocusRingMode) => {
      fm.setFocusRingStyle(mode);
    },
  };
}
