/**
 * useClipboard — copy/read clipboard via OSC 52 escape sequences.
 *
 * Uses the eager registration pattern (useRef, no useState/useEffect).
 */

import { useRef } from "react";
import { useTui } from "../context/TuiContext.js";

export interface UseClipboardResult {
  /** Copy text to clipboard via OSC 52 */
  copy: (text: string) => void;
  /** Read clipboard (not universally supported) */
  read: () => void;
  /** Last clipboard content received */
  content: string | null;
}

export function useClipboard(): UseClipboardResult {
  const { screen } = useTui();
  const contentRef = useRef<string | null>(null);

  const copyRef = useRef((text: string) => {
    const encoded = Buffer.from(text).toString("base64");
    screen.write(`\x1b]52;c;${encoded}\x07`);
    contentRef.current = text;
  });

  const readRef = useRef(() => {
    // Request clipboard contents via OSC 52 with '?' query
    screen.write(`\x1b]52;c;?\x07`);
  });

  return {
    copy: copyRef.current,
    read: readRef.current,
    content: contentRef.current,
  };
}
