/**
 * useClipboardAction — copy/paste behavioral hook for any content.
 *
 * Uses useRef + forceUpdate() + useInput for imperative state management.
 * Listens for Ctrl+C (copy) and Ctrl+V (paste) when active. Maintains
 * an internal clipboard buffer and invokes user callbacks.
 */

import { useRef, useCallback } from "react";
import { useInput } from "./useInput.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseClipboardActionOptions {
  isActive?: boolean;
  onCopy?: (text: string) => void;
  onPaste?: (text: string) => void;
}

export interface UseClipboardActionResult {
  copy: (text: string) => void;
  lastCopied: string | null;
}

export function useClipboardAction(options: UseClipboardActionOptions = {}): UseClipboardActionResult {
  const { isActive = true, onCopy, onPaste } = options;
  const forceUpdate = useForceUpdate();

  const lastCopiedRef = useRef<string | null>(null);

  const onCopyRef = useRef(onCopy);
  onCopyRef.current = onCopy;
  const onPasteRef = useRef(onPaste);
  onPasteRef.current = onPaste;

  const copy = useCallback((text: string) => {
    lastCopiedRef.current = text;
    onCopyRef.current?.(text);
    forceUpdate();
  }, [forceUpdate]);

  useInput((event) => {
    if (!isActive) return;

    // Ctrl+C for copy — only fires if onCopy is defined (to avoid
    // conflicting with process signal handling when there's nothing to copy)
    if (event.key === "c" && event.ctrl && onCopyRef.current && lastCopiedRef.current !== null) {
      onCopyRef.current(lastCopiedRef.current);
    }

    // Ctrl+V for paste
    if (event.key === "v" && event.ctrl && onPasteRef.current && lastCopiedRef.current !== null) {
      onPasteRef.current(lastCopiedRef.current);
    }
  }, { isActive });

  return {
    copy,
    lastCopied: lastCopiedRef.current,
  };
}
