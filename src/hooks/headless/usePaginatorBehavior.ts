import { useRef, useCallback } from "react";
import { useInput } from "../useInput.js";
import type { KeyEvent } from "../../input/types.js";

export interface UsePaginatorBehaviorOptions {
  total: number;
  current: number;
  onPageChange?: (page: number) => void;
  isActive?: boolean;
}

export interface UsePaginatorBehaviorResult {
  /** Current page index (0-based, clamped) */
  page: number;
  /** Total number of pages */
  totalPages: number;
  /** Go to previous page */
  prev: () => void;
  /** Go to next page */
  next: () => void;
  /** Go to a specific page (0-based) */
  goTo: (page: number) => void;
  /** Whether there is a previous page */
  hasPrev: boolean;
  /** Whether there is a next page */
  hasNext: boolean;
}

export function usePaginatorBehavior(options: UsePaginatorBehaviorOptions): UsePaginatorBehaviorResult {
  const {
    total,
    current: rawCurrent,
    onPageChange,
    isActive = false,
  } = options;

  // Clamp current page to valid range (0-based: 0 to total-1)
  const current = total > 0 ? Math.max(0, Math.min(rawCurrent, total - 1)) : 0;

  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  const currentRef = useRef(current);
  currentRef.current = current;
  const totalRef = useRef(total);
  totalRef.current = total;

  const prev = useCallback(() => {
    const cb = onPageChangeRef.current;
    if (!cb) return;
    const cur = currentRef.current;
    if (cur > 0) {
      cb(cur - 1);
    }
  }, []);

  const next = useCallback(() => {
    const cb = onPageChangeRef.current;
    if (!cb) return;
    const cur = currentRef.current;
    const tot = totalRef.current;
    if (cur < tot - 1) {
      cb(cur + 1);
    }
  }, []);

  const goTo = useCallback((page: number) => {
    const cb = onPageChangeRef.current;
    if (!cb) return;
    const tot = totalRef.current;
    const clamped = Math.max(0, Math.min(page, tot - 1));
    cb(clamped);
  }, []);

  const handleInput = useCallback((event: KeyEvent) => {
    const cb = onPageChangeRef.current;
    if (!cb) return;

    const cur = currentRef.current;
    const tot = totalRef.current;

    if (event.key === "left" && cur > 0) {
      cb(cur - 1);
    } else if (event.key === "right" && cur < tot - 1) {
      cb(cur + 1);
    }
  }, []);

  useInput(handleInput, { isActive });

  return {
    page: current,
    totalPages: total,
    prev,
    next,
    goTo,
    hasPrev: current > 0,
    hasNext: current < total - 1,
  };
}
