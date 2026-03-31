/**
 * useNotification — toast-like notification queue, behavioral only.
 *
 * Manages a queue of notifications with auto-removal after a configurable
 * duration. Returns current visible notifications for rendering.
 *
 * Uses useRef + forceUpdate() + useCleanup.
 */

import { useRef } from "react";
import { useCleanup } from "./useCleanup.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface Notification {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  durationMs?: number;
}

export interface UseNotificationOptions {
  maxVisible?: number; // default 3
  defaultDuration?: number; // default 4000ms
}

export interface UseNotificationResult {
  notifications: readonly Notification[];
  add: (message: string, type?: Notification["type"], durationMs?: number) => string; // returns id
  remove: (id: string) => void;
  clear: () => void;
}

let notifIdCounter = 0;

export function useNotification(
  options: UseNotificationOptions = {},
): UseNotificationResult {
  const { maxVisible = 3, defaultDuration = 4000 } = options;
  const forceUpdate = useForceUpdate();

  const notificationsRef = useRef<Notification[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = (id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    notificationsRef.current = notificationsRef.current.filter((n) => n.id !== id);
    forceUpdate();
  };

  const add = (
    message: string,
    type: Notification["type"] = "info",
    durationMs?: number,
  ): string => {
    const id = `notif-${notifIdCounter++}`;
    const duration = durationMs ?? defaultDuration;

    const notification: Notification = { id, message, type };
    if (durationMs !== undefined) {
      notification.durationMs = durationMs;
    }

    notificationsRef.current = [...notificationsRef.current, notification];

    // Trim to maxVisible (remove oldest)
    while (notificationsRef.current.length > maxVisible) {
      const oldest = notificationsRef.current[0]!;
      remove(oldest.id);
    }

    // Schedule auto-removal
    if (duration > 0) {
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        remove(id);
      }, duration);
      timersRef.current.set(id, timer);
    }

    forceUpdate();
    return id;
  };

  const clear = () => {
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
    notificationsRef.current = [];
    forceUpdate();
  };

  useCleanup(() => {
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
  });

  return {
    notifications: notificationsRef.current,
    add,
    remove,
    clear,
  };
}
