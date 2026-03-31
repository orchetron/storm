/**
 * useAnnounce — hook for live region announcements to screen readers.
 *
 * Provides two methods: `announce` for polite announcements (waits for idle)
 * and `announceUrgent` for assertive announcements (interrupts current speech).
 *
 * Uses the OSC 99 escape sequence from core/accessibility.ts internally,
 * writing directly to the screen's stdout for immediate delivery.
 */

import { useRef } from "react";
import { announce as makeAnnouncement } from "../core/accessibility.js";
import { useTui } from "../context/TuiContext.js";

export interface UseAnnounceResult {
  /** Announce a message (polite — waits for idle) */
  announce: (message: string) => void;
  /** Announce urgently (assertive — interrupts) */
  announceUrgent: (message: string) => void;
}

/**
 * Hook to announce dynamic content changes to screen readers.
 *
 * @example
 * ```tsx
 * function StatusUpdate() {
 *   const { announce } = useAnnounce();
 *
 *   function onSave() {
 *     // ... save logic
 *     announce("File saved successfully");
 *   }
 *
 *   return <Button onPress={onSave}>Save</Button>;
 * }
 * ```
 */
export function useAnnounce(): UseAnnounceResult {
  const { screen } = useTui();
  const ref = useRef<UseAnnounceResult | null>(null);

  if (ref.current === null) {
    ref.current = {
      announce: (message: string) => {
        screen.write(makeAnnouncement(message, "polite"));
      },
      announceUrgent: (message: string) => {
        screen.write(makeAnnouncement(message, "assertive"));
      },
    };
  }

  return ref.current;
}
