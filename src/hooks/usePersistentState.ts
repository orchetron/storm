/**
 * usePersistentState — save/restore state via a pluggable storage adapter.
 *
 * Uses useRef + forceUpdate() for imperative state management.
 * Ships with a default in-memory storage; users can provide file-backed
 * or other storage implementations.
 */

import { useRef, useCallback } from "react";
import { useForceUpdate } from "./useForceUpdate.js";

// ── Storage adapter interface ─────────────────────────────────────

export interface StateStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** Default in-memory storage backed by a Map. */
export function memoryStorage(): StateStorage {
  const store = new Map<string, string>();
  return {
    get: (key) => store.get(key) ?? null,
    set: (key, value) => store.set(key, value),
    remove: (key) => store.delete(key),
  };
}

// Singleton default storage so state persists across hook calls within a session
const defaultStorage = memoryStorage();

// ── Hook ──────────────────────────────────────────────────────────

export interface UsePersistentStateOptions<T> {
  key: string;
  initial: T;
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
  storage?: StateStorage;
}

export interface UsePersistentStateResult<T> {
  value: T;
  set: (newValue: T) => void;
  reset: () => void;
}

export function usePersistentState<T>(options: UsePersistentStateOptions<T>): UsePersistentStateResult<T> {
  const {
    key,
    initial,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    storage = defaultStorage,
  } = options;
  const forceUpdate = useForceUpdate();

  const valueRef = useRef<T>(initial);

  // Hydrate from storage on first render
  const hydratedRef = useRef(false);
  if (!hydratedRef.current) {
    hydratedRef.current = true;
    const stored = storage.get(key);
    if (stored !== null) {
      try {
        valueRef.current = deserialize(stored);
      } catch {
        // If deserialization fails, keep initial value
      }
    }
  }

  const set = useCallback((newValue: T) => {
    valueRef.current = newValue;
    storage.set(key, serialize(newValue));
    forceUpdate();
  }, [key, serialize, storage, forceUpdate]);

  const reset = useCallback(() => {
    valueRef.current = initial;
    storage.remove(key);
    forceUpdate();
  }, [key, initial, storage, forceUpdate]);

  return {
    value: valueRef.current,
    set,
    reset,
  };
}
