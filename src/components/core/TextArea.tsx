import React from "react";
import { useColors } from "../../hooks/useColors.js";
import { usePersonality } from "../../core/personality.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { useTextAreaBehavior } from "../../hooks/headless/useTextAreaBehavior.js";
import { ScrollView } from "./ScrollView.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";

/** A colored span returned by user-provided syntax highlighters. */
export interface HighlightSpan {
  text: string;
  color?: string | number;
  bold?: boolean;
  dim?: boolean;
  inverse?: boolean;
}

export interface TextAreaProps extends StormLayoutStyleProps {
  /** Current text value (controlled). */
  value: string;
  /** Called on every text change with the full new value. */
  onChange: (value: string) => void;
  /** Called when the submit key is pressed (default: ctrl+enter). */
  onSubmit?: (value: string) => void;
  /** Key combo that triggers onSubmit. @default "ctrl+enter" */
  submitKey?: "ctrl+enter" | "meta+enter" | "ctrl+s";
  /** Placeholder shown when value is empty. */
  placeholder?: string;
  /** Whether the component is focused. @default true */
  isFocused?: boolean;
  /** Read-only mode — cursor moves but text cannot be edited. */
  readOnly?: boolean;
  /** When true, input is non-interactive (no cursor, no key handling). */
  disabled?: boolean;
  /** Show line numbers in a left gutter. @default false */
  lineNumbers?: boolean;
  /** Enable soft word wrapping at the editor width. @default false */
  wordWrap?: boolean;
  /** Number of spaces inserted for Tab key. @default 2 */
  tabSize?: number;
  /** Maximum visible lines before scrolling. When undefined, grows unbounded. */
  maxLines?: number;
  /** Maximum character count. */
  maxLength?: number;
  /** Text color. */
  color?: string | number;
  /** Placeholder text color. */
  placeholderColor?: string | number;
  /** Line number gutter color. */
  lineNumberColor?: string | number;
  /** Called when text selection changes. */
  onSelectionChange?: (startRow: number, startCol: number, endRow: number, endCol: number) => void;
  /** Optional syntax highlighter — receives a line of text and its 0-based index,
   *  returns an array of colored spans whose text concatenated equals the input line. */
  highlight?: (line: string, lineIndex: number) => HighlightSpan[];
  /** Flex sizing. */
  flex?: number;
  "aria-label"?: string;
}

/** Compare two 2D positions. Returns <0 if a before b, 0 if equal, >0 if a after b. */
function comparePos(aRow: number, aCol: number, bRow: number, bCol: number): number {
  if (aRow !== bRow) return aRow - bRow;
  return aCol - bCol;
}

export const TextArea = React.memo(function TextArea(rawProps: TextAreaProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("TextArea", rawProps);
  const personality = usePersonality();

  const {
    value,
    onChange,
    onSubmit,
    submitKey = "ctrl+enter",
    placeholder,
    isFocused: isFocusedProp = true,
    readOnly = false,
    disabled = false,
    lineNumbers = false,
    wordWrap = false,
    tabSize = 2,
    maxLines,
    maxLength,
    color: colorProp,
    placeholderColor,
    lineNumberColor,
    highlight,
    "aria-label": ariaLabel,
    ...layoutProps
  } = props;

  const color = colorProp ?? colors.text.primary;

  // ── Delegate ALL state + input handling to the headless hook ───

  const behavior = useTextAreaBehavior({
    value,
    onChange,
    onSubmit,
    submitKey,
    isFocused: isFocusedProp,
    readOnly,
    disabled,
    tabSize,
    maxLines,
    maxLength,
    onSelectionChange: props.onSelectionChange,
  });

  const {
    lines,
    cursorRow,
    cursorCol,
    hasSelection: hasSel,
    selectionRange,
    scrollOffset,
  } = behavior;

  // ── Rendering (pure — no state, no refs, no input handlers) ───

  const showPlaceholder = value.length === 0;

  // Visible line range
  const totalLines = lines.length;
  const visibleLines = maxLines ?? totalLines;
  const viewStart = scrollOffset;
  const viewEnd = Math.min(totalLines, viewStart + visibleLines);
  const actualHeight = maxLines ? Math.min(maxLines, totalLines) : totalLines;

  // Line number gutter width
  const gutterWidth = lineNumbers ? Math.max(3, String(totalLines).length + 1) : 0;

  // Selection range (normalized)
  const selStart = selectionRange;
  const selEnd = selectionRange;

  /** Check if a (row, col) position falls within the current selection. */
  const isSelected = (row: number, col: number): boolean => {
    if (!hasSel || !selectionRange) return false;
    const { startRow, startCol, endRow, endCol } = selectionRange;
    return comparePos(row, col, startRow, startCol) >= 0 &&
           comparePos(row, col, endRow, endCol) < 0;
  };

  // ── Build row elements ─────────────────────────────────────

  const rowElements: React.ReactElement[] = [];

  if (showPlaceholder) {
    const placeholderElements: React.ReactElement[] = [];
    if (lineNumbers) {
      placeholderElements.push(
        React.createElement("tui-text", {
          key: "gutter-ph",
          color: lineNumberColor ?? colors.text.disabled,
          dim: true,
        }, "1".padStart(gutterWidth - 1) + " "),
      );
    }
    placeholderElements.push(
      React.createElement("tui-text", {
        key: "ph-text",
        color: placeholderColor ?? colors.text.disabled,
        dim: true,
      }, placeholder ?? ""),
    );
    // Show cursor at start if focused
    if (isFocusedProp && !disabled) {
      placeholderElements.push(
        React.createElement("tui-text", {
          key: "ph-cursor",
          color,
          inverse: true,
        }, " "),
      );
    }
    rowElements.push(
      React.createElement("tui-box", {
        key: "row-ph",
        flexDirection: "row",
        height: 1,
      }, ...placeholderElements),
    );
  } else {
    for (let i = viewStart; i < viewEnd; i++) {
      const lineText = lines[i]!;
      const lineElements: React.ReactElement[] = [];

      // ── Line number gutter ─────────────────────────────
      if (lineNumbers) {
        const num = String(i + 1).padStart(gutterWidth - 1) + " ";
        lineElements.push(
          React.createElement("tui-text", {
            key: `gutter-${i}`,
            color: lineNumberColor ?? colors.text.disabled,
            dim: true,
          }, num),
        );
      }

      // ── Line content with cursor/selection highlighting ─
      if (isFocusedProp && !disabled) {
        const spans: HighlightSpan[] = highlight
          ? highlight(lineText, i)
          : [{ text: lineText }];

        // Flatten spans into character-level info for cursor/selection overlay
        const segments: React.ReactElement[] = [];
        let charIdx = 0;
        let segIdx = 0;

        for (const span of spans) {
          const spanChars = Array.from(span.text);
          let buf = "";
          let bufInverse = false;
          let bufColor = span.color ?? color;
          let bufBold = span.bold;
          let bufDim = span.dim;

          const flushBuf = () => {
            if (buf.length > 0) {
              segments.push(
                React.createElement("tui-text", {
                  key: `s${segIdx}`,
                  color: bufColor,
                  ...(bufBold ? { bold: true } : {}),
                  ...(bufDim ? { dim: true } : {}),
                  ...(bufInverse ? { inverse: true } : {}),
                }, buf),
              );
              segIdx++;
              buf = "";
            }
          };

          for (const ch of spanChars) {
            const isCur = i === cursorRow && charIdx === cursorCol;
            const isSel = isSelected(i, charIdx);
            const shouldInverse = isCur || isSel;

            if (shouldInverse !== bufInverse) {
              flushBuf();
              bufInverse = shouldInverse;
            }
            buf += ch;
            charIdx++;
          }

          flushBuf();
        }

        // Cursor at end of line
        if (i === cursorRow && cursorCol >= lineText.length) {
          segments.push(
            React.createElement("tui-text", {
              key: "cursor-eol",
              color,
              inverse: true,
            }, " "),
          );
        }

        // Handle empty lines — still show cursor if on this line
        if (lineText.length === 0 && i !== cursorRow) {
          segments.push(
            React.createElement("tui-text", { key: "empty", color }, " "),
          );
        }

        lineElements.push(...segments);
      } else {
        // Not focused or disabled — plain text
        if (highlight) {
          const spans = highlight(lineText, i);
          let si = 0;
          for (const span of spans) {
            lineElements.push(
              React.createElement("tui-text", {
                key: `hl-${si}`,
                color: span.color ?? color,
                ...(span.bold ? { bold: true } : {}),
                ...(span.dim ? { dim: true } : {}),
                ...(disabled ? { dim: true } : {}),
              }, span.text),
            );
            si++;
          }
        } else {
          lineElements.push(
            React.createElement("tui-text", {
              key: `line-${i}`,
              color,
              ...(disabled ? { dim: true } : {}),
            }, lineText || " "),
          );
        }
      }

      rowElements.push(
        React.createElement("tui-box", {
          key: `row-${i}`,
          flexDirection: "row",
          height: 1,
        }, ...lineElements),
      );
    }
  }

  // ── Wrap in ScrollView if content exceeds maxLines ─────────

  if (maxLines !== undefined && totalLines > maxLines) {
    return React.createElement(ScrollView, {
      height: maxLines,
      scrollSpeed: 1,
      stickToBottom: false,
      ...(layoutProps.flex !== undefined ? { flex: layoutProps.flex } : {}),
      ...(layoutProps.width !== undefined ? { width: layoutProps.width } : {}),
    },
      React.createElement("tui-box", {
        flexDirection: "column",
        role: "textbox",
        "aria-label": ariaLabel,
        "aria-multiline": true,
        "aria-readonly": readOnly,
      }, ...rowElements),
    );
  }

  return React.createElement("tui-box", {
    flexDirection: "column",
    height: actualHeight || 1,
    role: "textbox",
    "aria-label": ariaLabel,
    "aria-multiline": true,
    "aria-readonly": readOnly,
    ...layoutProps,
  }, ...rowElements);
});
