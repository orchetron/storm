/**
 * useAsyncLoader — loading states with retry and error handling.
 *
 * Uses useRef + forceUpdate() for imperative state management.
 * Calls load() on mount (if autoLoad). On error, retries up to
 * retryCount times with configurable delay.
 */

import { useRef } from "react";
import { useCleanup } from "./useCleanup.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseAsyncLoaderOptions<T> {
  load: () => Promise<T>;
  autoLoad?: boolean;
  retryCount?: number;
  retryDelayMs?: number;
}

export interface UseAsyncLoaderResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
  retryCount: number;
}

export function useAsyncLoader<T>(options: UseAsyncLoaderOptions<T>): UseAsyncLoaderResult<T> {
  const {
    load,
    autoLoad = true,
    retryCount: maxRetries = 0,
    retryDelayMs = 1000,
  } = options;
  const forceUpdate = useForceUpdate();

  const dataRef = useRef<T | null>(null);
  const isLoadingRef = useRef(false);
  const errorRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortedRef = useRef(false);

  // Store latest load fn
  const loadRef = useRef(load);
  loadRef.current = load;

  const doLoad = () => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    errorRef.current = null;
    forceUpdate();

    loadRef.current().then(
      (result) => {
        if (abortedRef.current) return;
        dataRef.current = result;
        isLoadingRef.current = false;
        errorRef.current = null;
        retryCountRef.current = 0;
        forceUpdate();
      },
      (err: unknown) => {
        if (abortedRef.current) return;
        isLoadingRef.current = false;
        const message = err instanceof Error ? err.message : String(err);
        errorRef.current = message;

        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          forceUpdate();
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            doLoad();
          }, retryDelayMs);
        } else {
          forceUpdate();
        }
      },
    );
  };

  const reload = () => {
    retryCountRef.current = 0;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    isLoadingRef.current = false;
    doLoad();
  };

  // Auto-load on first render
  const startedRef = useRef(false);
  if (!startedRef.current && autoLoad) {
    startedRef.current = true;
    doLoad();
  }

  useCleanup(() => {
    abortedRef.current = true;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  });

  return {
    data: dataRef.current,
    isLoading: isLoadingRef.current,
    error: errorRef.current,
    reload,
    retryCount: retryCountRef.current,
  };
}
