import { useTui } from "../context/TuiContext.js";
import type { FocusChangeCallback, FocusRingMode, FocusRingStyle } from "../core/focus.js";

export interface UseFocusManagerResult {
  enableFocus: () => void;
  disableFocus: () => void;
  focusNext: () => void;
  focusPrevious: () => void;
  focus: (id: string) => void;
  focusById: (id: string) => void;
  getFocusedId: () => string | null;
  trapFocus: (groupId: string) => void;
  releaseFocus: () => void;
  isTrapped: () => boolean;
  activeGroup: () => string | null;
  /**
   * Register a callback that fires on every focus change with (newId, previousId).
   * Returns an unsubscribe function.
   */
  onFocusChange: (fn: FocusChangeCallback) => () => void;
  handleTabKey: (shift: boolean) => void;
  getFocusRingStyle: (id: string) => FocusRingStyle | null;
  setFocusRingStyle: (mode: FocusRingMode) => void;
}

export function useFocusManager(): UseFocusManagerResult {
  const fm = useTui().focus;

  return {
    enableFocus: () => fm.enableFocus(),
    disableFocus: () => fm.disableFocus(),
    focus: (id: string) => fm.focus(id),
    focusNext: () => fm.cycleNext(),
    focusPrevious: () => fm.cyclePrev(),
    focusById: (id: string) => fm.focus(id),
    getFocusedId: () => fm.focused,
    trapFocus: (groupId: string) => fm.trapFocus(groupId),
    releaseFocus: () => fm.releaseFocus(),
    isTrapped: () => fm.isTrapped,
    activeGroup: () => fm.activeGroup,
    onFocusChange: (fn: FocusChangeCallback) => fm.onFocusChange(fn),
    handleTabKey: (shift: boolean) => fm.handleTabKey(shift),
    getFocusRingStyle: (id: string) => fm.getFocusRingStyle(id),
    setFocusRingStyle: (mode: FocusRingMode) => fm.setFocusRingStyle(mode),
  };
}
