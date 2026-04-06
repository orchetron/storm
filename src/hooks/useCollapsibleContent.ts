import { useRef } from "react";
import { useInput } from "./useInput.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseCollapsibleContentOptions {
  content: string;
  maxLines?: number;
  toggleKey?: { key: string; ctrl?: boolean; shift?: boolean };
  defaultExpanded?: boolean;
  isActive?: boolean;
}

export interface UseCollapsibleContentResult {
  displayText: string;
  expanded: boolean;
  hiddenLines: number;
  toggle: () => void;
  hint: string;
}

export function useCollapsibleContent(
  options: UseCollapsibleContentOptions,
): UseCollapsibleContentResult {
  const {
    content,
    maxLines = 3,
    toggleKey = { key: "o", ctrl: true },
    defaultExpanded = false,
    isActive = true,
  } = options;
  const forceUpdate = useForceUpdate();

  const expandedRef = useRef(defaultExpanded);

  const lines = content.split("\n");
  const totalLines = lines.length;
  const needsTruncation = totalLines > maxLines;

  const toggle = () => {
    expandedRef.current = !expandedRef.current;
    forceUpdate();
  };

  useInput(
    (event) => {
      const matchKey = event.key === toggleKey.key;
      const matchCtrl = toggleKey.ctrl ? event.ctrl : !event.ctrl;
      const matchShift = toggleKey.shift ? event.shift : !event.shift;

      if (matchKey && matchCtrl && matchShift && needsTruncation) {
        toggle();
      }
    },
    { isActive },
  );

  const expanded = expandedRef.current;
  const hiddenLines = needsTruncation && !expanded ? totalLines - maxLines : 0;

  let displayText: string;
  if (!needsTruncation || expanded) {
    displayText = content;
  } else {
    displayText = lines.slice(0, maxLines).join("\n");
  }

  let hint = "";
  if (needsTruncation) {
    const keyParts: string[] = [];
    if (toggleKey.ctrl) keyParts.push("ctrl");
    if (toggleKey.shift) keyParts.push("shift");
    keyParts.push(toggleKey.key);
    const keyStr = keyParts.join("+");

    if (expanded) {
      hint = `(${keyStr} to collapse)`;
    } else {
      hint = `\u2026 +${hiddenLines} lines (${keyStr} to expand)`;
    }
  }

  return {
    displayText,
    expanded,
    hiddenLines,
    toggle,
    hint,
  };
}
