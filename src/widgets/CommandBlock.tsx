/**
 * CommandBlock — collapsible command output block.
 *
 * Renders a bordered block with the command on top (bold, with a
 * collapsible toggle indicator), output below (collapsible), exit code
 * as a colored badge, and duration shown dim.
 *
 * @module
 */

import React from "react";
import { useInput } from "../hooks/useInput.js";
import { useColors } from "../hooks/useColors.js";
import { fmtDuration } from "../utils/format.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

// ── Types ────────────────────────────────────────────────────────────

export interface CommandBlockProps {
  /** The command that was run. */
  command: string;
  /** Command output content. */
  output?: React.ReactNode;
  /** Exit code (0 = success, non-zero = error). */
  exitCode?: number;
  /** Duration in milliseconds. */
  duration?: number;
  /** Whether the output is collapsed. */
  collapsed?: boolean;
  /** Toggle callback for collapse/expand. */
  onToggle?: () => void;
  /** Whether this block is focused and can receive keyboard input. */
  isFocused?: boolean;
  /** Callback fired when the user presses "c" while focused. Receives the output text. */
  onCopy?: (text: string) => void;
  /** When true, pass output through without stripping ANSI codes. */
  ansiOutput?: boolean;
  /** Custom render for the command header row. */
  renderHeader?: (command: string, exitCode?: number) => React.ReactNode;
  /** Override collapse/expand toggle indicators (defaults: "▸" / "▾"). */
  toggleIndicators?: { collapsed?: string; expanded?: string };
  /** Override exit code symbols (defaults: "✓" / "✗"). */
  exitCodeSymbols?: { success?: string; failure?: string };
}

// ── Component ────────────────────────────────────────────────────────

export const CommandBlock = React.memo(function CommandBlock(rawProps: CommandBlockProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("CommandBlock", rawProps as unknown as Record<string, unknown>) as unknown as CommandBlockProps;
  const { command, output, exitCode, duration, collapsed, isFocused, ansiOutput, toggleIndicators, exitCodeSymbols } = props;

  // Wire up keyboard toggle: Enter or Space when focused; "c" for copy
  useInput(
    (e) => {
      if (e.key === "return" || e.key === " ") {
        props.onToggle?.();
      } else if (e.key === "c" && props.onCopy) {
        // Extract text content for the copy callback
        const outputText = typeof output === "string" ? output : command;
        props.onCopy(outputText);
      }
    },
    { isActive: isFocused === true },
  );

  const isCollapsed = collapsed ?? false;
  const toggle = isCollapsed
    ? (toggleIndicators?.collapsed ?? "\u25B8")
    : (toggleIndicators?.expanded ?? "\u25BE");

  const headerParts: React.ReactElement[] = [];

  // Toggle + command
  headerParts.push(
    React.createElement(
      "tui-text",
      { key: "toggle", dim: true },
      `${toggle} `,
    ),
  );

  headerParts.push(
    React.createElement(
      "tui-text",
      { key: "cmd", bold: true },
      command,
    ),
  );

  // Exit code badge
  if (exitCode !== undefined) {
    const isSuccess = exitCode === 0;
    const successSym = exitCodeSymbols?.success ?? "\u2713";
    const failureSym = exitCodeSymbols?.failure ?? "\u2717";
    const badge = isSuccess ? ` ${successSym}` : ` ${failureSym} ${exitCode}`;
    const badgeColor = isSuccess ? colors.success : colors.error;

    headerParts.push(
      React.createElement(
        "tui-text",
        { key: "exit", color: badgeColor, bold: true },
        badge,
      ),
    );
  }

  // Duration
  if (duration !== undefined) {
    headerParts.push(
      React.createElement(
        "tui-text",
        { key: "dur", dim: true },
        ` ${fmtDuration(duration)}`,
      ),
    );
  }

  // Hints when focused
  if (isFocused) {
    const hints: string[] = [];
    if (props.onToggle) hints.push("[Enter] toggle");
    if (props.onCopy) hints.push("[c] copy");
    if (hints.length > 0) {
      headerParts.push(
        React.createElement(
          "tui-text",
          { key: "hint", dim: true, color: colors.text.secondary },
          `  ${hints.join("  ")}`,
        ),
      );
    }
  }

  const headerRow = props.renderHeader
    ? React.createElement("tui-box", { key: "header", flexDirection: "row" }, props.renderHeader(command, exitCode))
    : React.createElement(
        "tui-box",
        { key: "header", flexDirection: "row" },
        ...headerParts,
      );

  // Build the block contents
  const blockChildren: React.ReactElement[] = [headerRow];

  // Output (only when not collapsed)
  if (!isCollapsed && output !== undefined) {
    const renderedOutput = ansiOutput
      ? React.createElement("tui-text", { key: "ansi-out", ansi: true }, output)
      : output;
    blockChildren.push(
      React.createElement(
        "tui-box",
        { key: "output", paddingLeft: 2, paddingTop: 0 },
        renderedOutput,
      ),
    );
  }

  // Outer bordered box
  return React.createElement(
    "tui-box",
    {
      flexDirection: "column",
      borderStyle: "single" as const,
      borderColor: colors.divider,
      paddingX: 1,
    },
    ...blockChildren,
  );
});
