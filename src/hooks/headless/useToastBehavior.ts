import { useRef, useCallback } from "react";
import { useCleanup } from "../useCleanup.js";
import { useForceUpdate } from "../useForceUpdate.js";

export interface ToastBehaviorItem {
  id: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  durationMs?: number;
}

export interface UseToastBehaviorOptions {
  /** Maximum number of visible toasts (default 3) */
  maxVisible?: number;
  /** Default duration for auto-dismiss in ms (default 0 = no auto-dismiss) */
  defaultDurationMs?: number;
}

export interface UseToastBehaviorResult {
  /** Current toast queue (newest last) */
  toasts: readonly ToastBehaviorItem[];
  /** Visible toasts (capped at maxVisible, newest last) */
  visibleToasts: readonly ToastBehaviorItem[];
  /** Add a new toast to the queue */
  addToast: (message: string, opts?: { type?: "info" | "success" | "warning" | "error"; durationMs?: number; id?: string }) => string;
  /** Remove a toast by its ID */
  removeToast: (id: string) => void;
  /** Clear all toasts */
  clearAll: () => void;
}

let toastIdCounter = 0;

export function useToastBehavior(options: UseToastBehaviorOptions = {}): UseToastBehaviorResult {
  const {
    maxVisible = 3,
    defaultDurationMs = 0,
  } = options;

  const forceUpdate = useForceUpdate();

  const toastsRef = useRef<ToastBehaviorItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    toastsRef.current = toastsRef.current.filter((t) => t.id !== id);
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    forceUpdate();
  }, [forceUpdate]);

  const addToast = useCallback((
    message: string,
    opts?: { type?: "info" | "success" | "warning" | "error"; durationMs?: number; id?: string },
  ): string => {
    const id = opts?.id ?? `toast-${++toastIdCounter}`;
    const durationMs = opts?.durationMs ?? defaultDurationMs;
    const type = opts?.type;

    const item: ToastBehaviorItem = {
      id,
      message,
      ...(type !== undefined ? { type } : {}),
      ...(durationMs > 0 ? { durationMs } : {}),
    };

    toastsRef.current = [...toastsRef.current, item];

    if (durationMs > 0) {
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        toastsRef.current = toastsRef.current.filter((t) => t.id !== id);
        forceUpdate();
      }, durationMs);
      timersRef.current.set(id, timer);
    }

    forceUpdate();
    return id;
  }, [defaultDurationMs, forceUpdate]);

  const clearAll = useCallback(() => {
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
    toastsRef.current = [];
    forceUpdate();
  }, [forceUpdate]);

  // Clean up timers on unmount
  useCleanup(() => {
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
  });

  const toasts = toastsRef.current;
  const visibleToasts = toasts.slice(-maxVisible);

  return {
    toasts,
    visibleToasts,
    addToast,
    removeToast,
    clearAll,
  };
}
