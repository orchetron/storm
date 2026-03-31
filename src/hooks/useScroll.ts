/**
 * useScroll — imperative scroll state management hook.
 *
 * Uses requestRender() instead of React state for instant response.
 */

import { useRef, useCallback } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "./useCleanup.js";

export interface UseScrollOptions {
  /** Lines per scroll tick (default: 3) */
  speed?: number;
  /** Content height in lines */
  contentHeight: number;
  /** Viewport height in lines */
  viewportHeight: number;
}

export interface UseScrollResult {
  scrollTop: number;
  maxScroll: number;
  isAtBottom: boolean;
  scrollTo: (offset: number) => void;
  scrollBy: (delta: number) => void;
  scrollToBottom: () => void;
}

export function useScroll(options: UseScrollOptions): UseScrollResult {
  const { speed = 3, contentHeight, viewportHeight } = options;
  const { input, requestRender } = useTui();

  const maxScroll = Math.max(0, contentHeight - viewportHeight);
  const scrollTopRef = useRef(0);

  const scrollTo = useCallback((offset: number) => {
    scrollTopRef.current = Math.max(0, Math.min(maxScroll, offset));
    requestRender();
  }, [maxScroll, requestRender]);

  const scrollBy = useCallback((delta: number) => {
    scrollTopRef.current = Math.max(0, Math.min(maxScroll, scrollTopRef.current + delta));
    requestRender();
  }, [maxScroll, requestRender]);

  const scrollToBottom = useCallback(() => {
    scrollTopRef.current = maxScroll;
    requestRender();
  }, [maxScroll, requestRender]);

  // Store callback refs so the eagerly-registered handlers always use current values
  const scrollByRef = useRef(scrollBy);
  scrollByRef.current = scrollBy;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const viewportHeightRef = useRef(viewportHeight);
  viewportHeightRef.current = viewportHeight;

  // Register mouse and key handlers eagerly — not in useEffect
  const registeredRef = useRef(false);
  const unsubMouseRef = useRef<(() => void) | null>(null);
  const unsubKeyRef = useRef<(() => void) | null>(null);
  if (!registeredRef.current) {
    registeredRef.current = true;
    unsubMouseRef.current = input.onMouse((event) => {
      if (event.button === "scroll-up") scrollByRef.current(-speedRef.current);
      else if (event.button === "scroll-down") scrollByRef.current(speedRef.current);
    });
    unsubKeyRef.current = input.onKey((event) => {
      if (event.key === "pageup") scrollByRef.current(-viewportHeightRef.current);
      else if (event.key === "pagedown") scrollByRef.current(viewportHeightRef.current);
      else if (event.key === "up" && event.shift) scrollByRef.current(-speedRef.current);
      else if (event.key === "down" && event.shift) scrollByRef.current(speedRef.current);
    });
  }

  useCleanup(() => {
    unsubMouseRef.current?.();
    unsubKeyRef.current?.();
  });

  return {
    scrollTop: scrollTopRef.current,
    maxScroll,
    isAtBottom: scrollTopRef.current >= maxScroll - 1,
    scrollTo,
    scrollBy,
    scrollToBottom,
  };
}
