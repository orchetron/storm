/**
 * MessageBubble — styled message container with role indicator.
 *
 * Renders a symbol on the left (e.g. ">" for user, "*" for assistant),
 * indented content, and an optional dim italic metadata line below.
 *
 * @module
 */

import React, { useCallback, useRef } from "react";
import { Box } from "../components/Box.js";
import { Text } from "../components/Text.js";
import { useInput } from "../hooks/useInput.js";
import { MarkdownText } from "./MarkdownText.js";
import type { KeyEvent } from "../input/types.js";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { useColors } from "../hooks/useColors.js";

// ── Types ────────────────────────────────────────────────────────────

/** Built-in role mappings for auto-setting symbol and symbolColor. */
type MessageRole = "user" | "assistant" | "system" | "tool";

/** An action hint rendered below the message. */
export interface MessageAction {
  /** Display label for the action. */
  label: string;
  /** Key the user presses to trigger the action. */
  key: string;
  /** Callback invoked when the action key is pressed. */
  onAction: () => void;
}

export interface MessageBubbleProps {
  /** Role symbol displayed on the left. Overrides role default. */
  symbol?: string;
  /** Color for the symbol. Overrides role default. */
  symbolColor?: string;
  /** Message role — auto-sets symbol and symbolColor if not explicitly provided. */
  role?: MessageRole;
  /** Message content. */
  children: React.ReactNode;
  /** Optional metadata line (timing, token counts, etc). */
  meta?: string;
  /** Optional timestamp rendered dim on the right side. */
  timestamp?: string;
  /** When true and children is a string, render through MarkdownText. */
  markdown?: boolean;
  /** Action hints displayed below the message. */
  actions?: MessageAction[];
  /** Whether the bubble captures keyboard input for actions (default true). */
  isFocused?: boolean;
  /** Custom renderer for the role symbol. */
  renderSymbol?: (symbol: string, color: string) => React.ReactNode;
}

// ── Component ────────────────────────────────────────────────────────

export const MessageBubble = React.memo(function MessageBubble(rawProps: MessageBubbleProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("MessageBubble", rawProps as unknown as Record<string, unknown>) as unknown as MessageBubbleProps;
  const { role, children, meta, timestamp, markdown, actions, isFocused = true } = props;

  // Resolve symbol and color: explicit props override role defaults
  const ROLE_DEFAULTS: Record<MessageRole, { symbol: string; symbolColor: string }> = {
    user:      { symbol: ">",  symbolColor: colors.brand.primary },
    assistant: { symbol: "\u2726", symbolColor: colors.brand.primary }, // ✦
    system:    { symbol: "\u25CF", symbolColor: colors.warning },       // ●
    tool:      { symbol: "\u2699", symbolColor: colors.info },          // ⚙
  };
  const roleDefaults = role ? ROLE_DEFAULTS[role] : undefined;
  const symbol = props.symbol ?? roleDefaults?.symbol ?? ">";
  const symbolColor = props.symbolColor ?? roleDefaults?.symbolColor ?? colors.text.primary;

  // Wire action keys to their callbacks
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const handleInput = useCallback((event: KeyEvent) => {
    const currentActions = actionsRef.current;
    if (!currentActions || currentActions.length === 0) return;
    for (const action of currentActions) {
      if (event.char === action.key || event.key === action.key) {
        action.onAction();
        return;
      }
    }
  }, []);

  useInput(handleInput, { isActive: isFocused && !!actions && actions.length > 0 });

  // Render content: use MarkdownText when markdown=true and children is a string
  // Wrap plain strings in <Text> since Box doesn't render text children directly
  const content = markdown && typeof children === "string"
    ? <MarkdownText>{children}</MarkdownText>
    : typeof children === "string"
      ? <Text color={colors.text.primary}>{children}</Text>
      : children;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box flexDirection="row">
        {props.renderSymbol
          ? props.renderSymbol(symbol, symbolColor)
          : <Text bold color={symbolColor}>{symbol}{" "}</Text>}
        <Box flexDirection="column" flex={1}>
          {content}
        </Box>
        {timestamp !== undefined && (
          <Text dim>{` ${timestamp}`}</Text>
        )}
      </Box>
      {meta !== undefined && (
        <Box paddingLeft={2}>
          <Text dim italic>{meta}</Text>
        </Box>
      )}
      {actions !== undefined && actions.length > 0 && (
        <Box paddingLeft={2} flexDirection="row">
          {actions.map((action, i) => (
            <Text key={action.key} dim>
              {i > 0 ? "  " : ""}[{action.key}] {action.label}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
});
