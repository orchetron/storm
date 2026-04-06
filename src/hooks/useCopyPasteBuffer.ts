import { useRef, useCallback } from "react";
import { useInput } from "./useInput.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseCopyPasteBufferOptions {
  isActive?: boolean;
  onCopy?: (text: string) => void;
  onPaste?: (text: string) => void;
}

export interface UseCopyPasteBufferResult {
  copy: (text: string) => void;
  lastCopied: string | null;
}

export function useCopyPasteBuffer(options: UseCopyPasteBufferOptions = {}): UseCopyPasteBufferResult {
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
