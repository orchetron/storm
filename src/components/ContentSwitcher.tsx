/**
 * ContentSwitcher — shows one child at a time.
 *
 * Given an activeIndex, renders only the child at that position.
 * All other children are hidden. Useful for wizard flows and view switching.
 */

import React, { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "../hooks/useCleanup.js";
import { createAnimation, tickAnimation, type AnimationRef } from "../utils/animate.js";
import { usePersonality } from "../core/personality.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface ContentSwitcherProps {
  activeIndex: number;
  children: React.ReactNode;
  /** Transition effect when switching content. */
  transition?: "none" | "fade" | "slide";
}

export const ContentSwitcher = React.memo(function ContentSwitcher(rawProps: ContentSwitcherProps): React.ReactElement {
  const props = usePluginProps("ContentSwitcher", rawProps as unknown as Record<string, unknown>) as unknown as ContentSwitcherProps;
  const personality = usePersonality();
  const { activeIndex, children, transition = "none" } = props;
  const childArray = React.Children.toArray(children);
  const active = childArray[activeIndex] ?? null;

  const { requestRender, renderContext } = useTui();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIndexRef = useRef(activeIndex);
  const fadingRef = useRef(false);

  // Slide transition state
  const slideAnimRef = useRef<AnimationRef | null>(null);
  const slideUnsubRef = useRef<(() => void) | null>(null);
  const slideProgressRef = useRef(1); // 1 = fully visible

  // Detect index change and trigger transition
  if (activeIndex !== prevIndexRef.current) {
    prevIndexRef.current = activeIndex;

    if (transition === "fade") {
      fadingRef.current = true;

      // Clear any existing timer
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        fadingRef.current = false;
        timerRef.current = null;
        requestRender();
      }, personality.animation.durationFast);
    } else if (transition === "slide") {
      // Start slide animation: dim briefly then reveal new content
      slideProgressRef.current = 0;
      slideAnimRef.current = createAnimation(0, 1, personality.animation.durationNormal);

      if (slideUnsubRef.current) {
        slideUnsubRef.current();
        slideUnsubRef.current = null;
      }

      slideUnsubRef.current = renderContext.animationScheduler.add(() => {
        const anim = slideAnimRef.current;
        if (!anim) return;

        slideProgressRef.current = tickAnimation(anim);

        if (anim.done) {
          slideAnimRef.current = null;
          if (slideUnsubRef.current) {
            slideUnsubRef.current();
            slideUnsubRef.current = null;
          }
        }
      });
    }
  }

  useCleanup(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    if (slideUnsubRef.current) {
      slideUnsubRef.current();
      slideUnsubRef.current = null;
    }
  });

  const dimmed = transition === "fade" && fadingRef.current;
  const sliding = transition === "slide" && slideAnimRef.current !== null && !slideAnimRef.current.done;

  // During slide: dim content during first half of animation
  if (sliding && slideProgressRef.current < 0.5) {
    return React.createElement(
      "tui-box",
      { role: "tablist" },
      React.createElement("tui-box", { dim: true }, active),
    );
  }

  return React.createElement(
    "tui-box",
    { role: "tablist", ...(dimmed ? { dimContent: true } : {}) },
    dimmed
      ? React.createElement("tui-box", { dim: true }, active)
      : active,
  );
});
