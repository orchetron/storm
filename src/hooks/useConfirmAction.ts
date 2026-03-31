/**
 * useConfirmAction — wrap any action in a confirmation step.
 *
 * Behavior only. Call requestConfirm() to begin a confirmation flow,
 * then confirm() or cancel() to resolve it. Supports auto-cancel
 * after a configurable timeout.
 *
 * Uses useRef + forceUpdate() + useCleanup.
 */

import { useRef } from "react";
import { useCleanup } from "./useCleanup.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseConfirmActionOptions {
  isActive?: boolean;
  timeoutMs?: number; // auto-cancel after timeout
}

export interface UseConfirmActionResult {
  isPending: boolean;
  confirm: () => void;
  cancel: () => void;
  /** Call this to start confirmation flow. Returns a promise that resolves true (confirmed) or false (cancelled). */
  requestConfirm: () => Promise<boolean>;
  countdown: number | null;
}

export function useConfirmAction(
  options: UseConfirmActionOptions = {},
): UseConfirmActionResult {
  const { isActive = true, timeoutMs } = options;
  const forceUpdate = useForceUpdate();

  const pendingRef = useRef(false);
  const countdownRef = useRef<number | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;
  };

  const settle = (result: boolean) => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    countdownRef.current = null;
    clearTimer();
    const resolve = resolveRef.current;
    resolveRef.current = null;
    forceUpdate();
    resolve?.(result);
  };

  const confirm = () => {
    if (!isActive) return;
    settle(true);
  };

  const cancel = () => {
    settle(false);
  };

  const requestConfirm = (): Promise<boolean> => {
    if (!isActive) return Promise.resolve(false);

    // If already pending, cancel the previous one
    if (pendingRef.current) {
      settle(false);
    }

    return new Promise<boolean>((resolve) => {
      pendingRef.current = true;
      resolveRef.current = resolve;
      forceUpdate();

      if (timeoutMs !== undefined && timeoutMs > 0) {
        startTimeRef.current = Date.now();
        countdownRef.current = Math.ceil(timeoutMs / 1000);

        timerRef.current = setInterval(() => {
          if (!pendingRef.current || startTimeRef.current === null) {
            clearTimer();
            return;
          }

          const elapsed = Date.now() - startTimeRef.current;
          const remaining = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000));
          countdownRef.current = remaining;

          if (elapsed >= timeoutMs) {
            settle(false);
            return;
          }

          forceUpdate();
        }, 1000);
      }
    });
  };

  useCleanup(() => {
    clearTimer();
    // Reject any pending confirmation
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
  });

  return {
    isPending: pendingRef.current,
    confirm,
    cancel,
    requestConfirm,
    countdown: countdownRef.current,
  };
}
