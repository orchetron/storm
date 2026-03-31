/**
 * RevealTransition — animates children appearing.
 *
 * Two modes:
 * - "fade": Shows children dim first, then normal after durationMs.
 * - "charge": Shows border immediately, content dim for durationMs/2,
 *   then full brightness for the remaining durationMs/2.
 *
 * Uses useRef for timer state, requestRender, and useCleanup (no setState).
 */

import React, { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "../hooks/useCleanup.js";
import { useColors } from "../hooks/useColors.js";
import { usePersonality } from "../core/personality.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface RevealTransitionProps {
  children: React.ReactNode;
  visible: boolean;
  type?: "fade" | "charge";
  durationMs?: number;
}

type Phase = "hidden" | "dim" | "border-only" | "border-dim" | "full";

export const RevealTransition = React.memo(function RevealTransition(rawProps: RevealTransitionProps): React.ReactElement | null {
  const colors = useColors();
  const props = usePluginProps("RevealTransition", rawProps as unknown as Record<string, unknown>) as unknown as RevealTransitionProps;
  const personality = usePersonality();
  const {
    children,
    visible,
    type = "fade",
    durationMs = personality.animation.durationNormal,
  } = props;

  const { requestRender } = useTui();
  const requestRenderRef = useRef(requestRender);
  requestRenderRef.current = requestRender;

  const phaseRef = useRef<Phase>("hidden");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const innerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevVisibleRef = useRef(false);

  // Detect visibility transitions
  if (visible && !prevVisibleRef.current) {
    // Becoming visible — start animation
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (innerTimerRef.current) {
      clearTimeout(innerTimerRef.current);
      innerTimerRef.current = null;
    }

    if (type === "fade") {
      phaseRef.current = "dim";
      timerRef.current = setTimeout(() => {
        phaseRef.current = "full";
        timerRef.current = null;
        requestRenderRef.current();
      }, durationMs);
    } else {
      // charge: border immediately, dim content after half, full after full
      phaseRef.current = "border-only";
      timerRef.current = setTimeout(() => {
        phaseRef.current = "border-dim";
        timerRef.current = null;
        requestRenderRef.current();
        innerTimerRef.current = setTimeout(() => {
          phaseRef.current = "full";
          innerTimerRef.current = null;
          requestRenderRef.current();
        }, durationMs / 2);
      }, durationMs / 2);
    }
  } else if (!visible && prevVisibleRef.current) {
    // Becoming hidden
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (innerTimerRef.current) {
      clearTimeout(innerTimerRef.current);
      innerTimerRef.current = null;
    }
    phaseRef.current = "hidden";
  }
  prevVisibleRef.current = visible;

  useCleanup(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (innerTimerRef.current) {
      clearTimeout(innerTimerRef.current);
      innerTimerRef.current = null;
    }
  });

  if (!visible && phaseRef.current === "hidden") {
    return null;
  }

  const phase = phaseRef.current;

  if (type === "fade") {
    const dim = phase === "dim";
    return React.createElement(
      "tui-box",
      { ...(dim ? { dim: true } : {}) },
      children,
    );
  }

  // charge mode
  if (phase === "border-only") {
    // Show border, hide content
    return React.createElement(
      "tui-box",
      { borderStyle: "single", borderColor: colors.brand.primary },
      React.createElement("tui-text", { dim: true, color: colors.text.disabled }, " "),
    );
  }

  if (phase === "border-dim") {
    // Show border + dim content
    return React.createElement(
      "tui-box",
      { borderStyle: "single", borderColor: colors.brand.primary, dim: true },
      children,
    );
  }

  // full
  return React.createElement(
    "tui-box",
    phase === "full" && type === "charge"
      ? { borderStyle: "single", borderColor: colors.brand.primary }
      : {},
    children,
  );
});
