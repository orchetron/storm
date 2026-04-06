
import React, { useRef, useCallback } from "react";
import { useInput } from "../../hooks/useInput.js";
import { useTui } from "../../context/TuiContext.js";
import { useCleanup } from "../../hooks/useCleanup.js";
import type { KeyEvent } from "../../input/types.js";
import type { StormContainerStyleProps } from "../../styles/styleProps.js";
import { mergeBoxStyles, pickStyleProps } from "../../styles/applyStyles.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

let nextGroupId = 0;

export interface FocusGroupProps extends StormContainerStyleProps {
  children?: React.ReactNode;
  /** Unique ID for this focus group. Auto-generated if not provided. */
  id?: string;
  /**
   * When true, Tab cycling is trapped within this group.
   * Focus cannot escape to elements outside the group via Tab/Shift+Tab.
   * Calls `focusManager.trapFocus(groupId)` on mount and
   * `focusManager.releaseFocus()` on unmount.
   */
  trap?: boolean;
  /** Navigation direction: "vertical" uses Up/Down, "horizontal" uses Left/Right. */
  direction?: "vertical" | "horizontal";
  /** Called when the focused index changes (arrow nav mode). */
  onFocusChange?: (index: number) => void;
  /** Whether the group is interactive (default true). */
  isActive?: boolean;
}

export const FocusGroup = React.memo(function FocusGroup(rawProps: FocusGroupProps): React.ReactElement {
  const props = usePluginProps("FocusGroup", rawProps);
  const {
    children,
    id,
    trap = false,
    direction = "vertical",
    onFocusChange,
    isActive = true,
  } = props;

  const userStyles = pickStyleProps(props);
  const { focus: fm, requestRender } = useTui();

  // Stable group ID across renders
  const groupIdRef = useRef(id ?? `focus-group-${nextGroupId++}`);
  const groupId = groupIdRef.current;

  // ── Focus trap mode ────────────────────────────────────────────
  const trapActivatedRef = useRef(false);
  if (trap && !trapActivatedRef.current) {
    trapActivatedRef.current = true;
    fm.trapFocus(groupId);
  }

  useCleanup(() => {
    if (trapActivatedRef.current) {
      fm.releaseFocus();
      trapActivatedRef.current = false;
    }
  });

  // ── Arrow navigation mode ─────────────────────────────────────
  const childArray = React.Children.toArray(children);
  const count = childArray.length;

  const focusedRef = useRef(0);
  const onFocusChangeRef = useRef(onFocusChange);
  onFocusChangeRef.current = onFocusChange;

  const requestRenderRef = useRef(requestRender);
  requestRenderRef.current = requestRender;

  const prevKey = direction === "vertical" ? "up" : "left";
  const nextKey = direction === "vertical" ? "down" : "right";

  const handleInput = useCallback(
    (event: KeyEvent) => {
      if (count === 0) return;

      let changed = false;
      if (event.key === prevKey) {
        focusedRef.current =
          focusedRef.current > 0 ? focusedRef.current - 1 : count - 1;
        changed = true;
      } else if (event.key === nextKey) {
        focusedRef.current =
          focusedRef.current < count - 1 ? focusedRef.current + 1 : 0;
        changed = true;
      }

      if (changed) {
        onFocusChangeRef.current?.(focusedRef.current);
        requestRenderRef.current();
      }
    },
    [prevKey, nextKey, count],
  );

  // Only enable arrow-key handling when not in pure trap mode
  // (trap mode relies on Tab cycling managed by FocusManager)
  useInput(handleInput, { isActive: isActive && !trap });

  // Clamp focused index
  focusedRef.current = Math.min(focusedRef.current, Math.max(0, count - 1));

  const boxProps = mergeBoxStyles(
    { flexDirection: direction === "vertical" ? "column" : "row" },
    userStyles,
  );

  return React.createElement("tui-box", boxProps, ...childArray);
});
