/**
 * useKeyChord — two-key sequences (like Ctrl+K then S in VS Code).
 *
 * Behavior only. Listens for a first key match, then waits for
 * the second key within a timeout. If matched, fires the action.
 * If timeout or non-matching key, cancels the chord.
 *
 * Uses useRef + useInput + forceUpdate() + useCleanup.
 */

import { useRef } from "react";
import { useInput } from "./useInput.js";
import { useCleanup } from "./useCleanup.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface KeyChordDef {
  first: { key: string; ctrl?: boolean; shift?: boolean; meta?: boolean };
  second: { key: string; ctrl?: boolean; shift?: boolean; meta?: boolean };
  label: string; // "Ctrl+K, S"
  action: () => void;
}

export interface UseKeyChordOptions {
  chords: KeyChordDef[];
  isActive?: boolean;
  timeoutMs?: number; // default 1000 — cancel chord if second key not pressed
}

export interface UseKeyChordResult {
  /** Currently waiting for second key (first key was pressed) */
  pendingChord: string | null; // label of the pending chord's first key
  bindings: Array<{ label: string }>;
}

function matchesSpec(
  event: { key: string; ctrl: boolean; shift: boolean; meta: boolean },
  spec: { key: string; ctrl?: boolean; shift?: boolean; meta?: boolean },
): boolean {
  if (event.key !== spec.key) return false;
  if ((spec.ctrl ?? false) !== event.ctrl) return false;
  if ((spec.shift ?? false) !== event.shift) return false;
  if ((spec.meta ?? false) !== event.meta) return false;
  return true;
}

function formatSpec(spec: { key: string; ctrl?: boolean; shift?: boolean; meta?: boolean }): string {
  const parts: string[] = [];
  if (spec.ctrl) parts.push("Ctrl");
  if (spec.shift) parts.push("Shift");
  if (spec.meta) parts.push("Meta");
  parts.push(spec.key.length === 1 ? spec.key.toUpperCase() : spec.key);
  return parts.join("+");
}

export function useKeyChord(options: UseKeyChordOptions): UseKeyChordResult {
  const { chords, isActive = true, timeoutMs = 1000 } = options;
  const forceUpdate = useForceUpdate();

  const pendingRef = useRef<string | null>(null);
  const matchingChordsRef = useRef<KeyChordDef[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chordsRef = useRef(chords);
  chordsRef.current = chords;

  const clearPending = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current !== null) {
      pendingRef.current = null;
      matchingChordsRef.current = [];
      forceUpdate();
    }
  };

  useInput(
    (event) => {
      if (pendingRef.current !== null) {
        // We're waiting for the second key
        let matched = false;
        for (const chord of matchingChordsRef.current) {
          if (matchesSpec(event, chord.second)) {
            clearPending();
            chord.action();
            matched = true;
            break;
          }
        }
        if (!matched) {
          // Non-matching key — cancel
          clearPending();
        }
        return;
      }

      // Check for first key match
      const matching: KeyChordDef[] = [];
      for (const chord of chordsRef.current) {
        if (matchesSpec(event, chord.first)) {
          matching.push(chord);
        }
      }

      if (matching.length > 0) {
        matchingChordsRef.current = matching;
        pendingRef.current = formatSpec(matching[0]!.first);
        forceUpdate();

        // Start timeout
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          clearPending();
        }, timeoutMs);
      }
    },
    { isActive },
  );

  useCleanup(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  });

  return {
    pendingChord: pendingRef.current,
    bindings: chordsRef.current.map((c) => ({ label: c.label })),
  };
}
