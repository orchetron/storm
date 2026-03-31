/**
 * useUndoRedo — generic undo/redo stack, reusable across any component.
 *
 * Push to undo stack on set(), clear redo stack. undo() pops undo and
 * pushes to redo. redo() pops redo and pushes to undo.
 *
 * Uses useRef + forceUpdate().
 */

import { useRef } from "react";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseUndoRedoOptions<T> {
  initial: T;
  maxHistory?: number;
}

export interface UseUndoRedoResult<T> {
  value: T;
  set: (newValue: T) => void;
  undo: () => T | null;
  redo: () => T | null;
  canUndo: boolean;
  canRedo: boolean;
  clear: () => void;
}

export function useUndoRedo<T>(options: UseUndoRedoOptions<T>): UseUndoRedoResult<T> {
  const { initial, maxHistory = 100 } = options;
  const forceUpdate = useForceUpdate();

  const currentRef = useRef<T>(initial);
  const undoStackRef = useRef<T[]>([]);
  const redoStackRef = useRef<T[]>([]);

  // Initialize only once — don't reset on re-render
  const initializedRef = useRef(false);
  if (!initializedRef.current) {
    initializedRef.current = true;
    currentRef.current = initial;
  }

  const set = (newValue: T) => {
    undoStackRef.current.push(currentRef.current);
    // Trim undo stack if it exceeds maxHistory
    if (undoStackRef.current.length > maxHistory) {
      undoStackRef.current.splice(0, undoStackRef.current.length - maxHistory);
    }
    currentRef.current = newValue;
    // Clear redo stack on new set
    redoStackRef.current.length = 0;
    forceUpdate();
  };

  const undo = (): T | null => {
    if (undoStackRef.current.length === 0) return null;
    const prev = undoStackRef.current.pop()!;
    redoStackRef.current.push(currentRef.current);
    currentRef.current = prev;
    forceUpdate();
    return prev;
  };

  const redo = (): T | null => {
    if (redoStackRef.current.length === 0) return null;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(currentRef.current);
    currentRef.current = next;
    forceUpdate();
    return next;
  };

  const clear = () => {
    undoStackRef.current.length = 0;
    redoStackRef.current.length = 0;
    currentRef.current = initial;
    forceUpdate();
  };

  return {
    value: currentRef.current,
    set,
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    clear,
  };
}
