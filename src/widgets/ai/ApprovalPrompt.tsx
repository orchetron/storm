import React, { useCallback, useRef } from "react";
import { Box } from "../../components/core/Box.js";
import { Text } from "../../components/core/Text.js";
import { Divider } from "../../components/core/Divider.js";
import { useInput } from "../../hooks/useInput.js";
import { useTerminal } from "../../hooks/useTerminal.js";
import { useTui } from "../../context/TuiContext.js";
import { useCleanup } from "../../hooks/useCleanup.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { useColors } from "../../hooks/useColors.js";
import type { StormColors } from "../../theme/colors.js";

export interface ApprovalOption {
  key: string;
  label: string;
  color: string;
}

export interface ApprovalPromptProps {
  tool: string;
  risk?: string;
  params?: Record<string, unknown>;
  /** Default: y/n/a. */
  options?: ApprovalOption[];
  onSelect: (key: string) => void;
  /** Terminal width for dividers (unused — Divider auto-fills). */
  width?: number;
  /** Whether the prompt captures keyboard input (default true). */
  visible?: boolean;
  /** Timeout in ms. When set, auto-deny after timeout with countdown display. */
  timeout?: number;
  /** Custom render for each approval option. */
  renderOption?: (option: ApprovalOption, index: number) => React.ReactNode;
  /** Custom timeout message formatter (default: ``(s) => `Auto-deny in ${s}s` ``). */
  timeoutMessage?: (seconds: number) => string;
}

function getDefaultOptions(colors: StormColors): readonly ApprovalOption[] {
  return [
    { key: "y", label: "approve", color: colors.approval.approve },
    { key: "n", label: "deny", color: colors.approval.deny },
    { key: "a", label: "always approve", color: colors.approval.always },
  ];
}

function formatParams(params: Record<string, unknown>): string {
  return Object.entries(params)
    .map(([k, v]) => {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      return `${k}: ${s.length > 60 ? s.slice(0, 57) + "..." : s}`;
    })
    .join("\n");
}

function riskBorderColor(risk: string | undefined, colors: StormColors): string {
  if (!risk) return colors.divider;
  const lower = risk.toLowerCase();
  if (lower === "high") return colors.error;
  if (lower === "medium") return colors.warning;
  return colors.divider; // low or undefined
}

export const ApprovalPrompt = React.memo(function ApprovalPrompt(rawProps: ApprovalPromptProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("ApprovalPrompt", rawProps);
  const {
    tool,
    risk,
    params,
    options = getDefaultOptions(colors) as ApprovalOption[],
    onSelect,
    timeout,
    timeoutMessage,
  } = props;
  const formatTimeout = timeoutMessage ?? ((s: number) => `Auto-deny in ${s}s`);

  const { width: termWidth } = useTerminal();
  const { requestRender } = useTui();

  // ── Timeout countdown (imperative) ──────────────────────────────────
  const countdownRef = useRef<number>(timeout !== undefined ? Math.ceil(timeout / 1000) : 0);
  const timeoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  if (timeout !== undefined && !timeoutTimerRef.current && countdownRef.current > 0) {
    timeoutTimerRef.current = setInterval(() => {
      countdownRef.current--;
      requestRender();
      if (countdownRef.current <= 0) {
        if (timeoutTimerRef.current) {
          clearInterval(timeoutTimerRef.current);
          timeoutTimerRef.current = null;
        }
        onSelectRef.current("n"); // auto-deny
      }
    }, 1000);
  }

  useCleanup(() => {
    if (timeoutTimerRef.current) {
      clearInterval(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  });

  // Memoize optionKeys in a ref, only recomputing when options change by value
  const optionKeysRef = useRef<{ keys: string[]; set: Set<string> }>({ keys: [], set: new Set() });
  const currentKeys = options.map((o) => o.key);
  if (
    currentKeys.length !== optionKeysRef.current.keys.length ||
    currentKeys.some((k, i) => k !== optionKeysRef.current.keys[i])
  ) {
    optionKeysRef.current = { keys: currentKeys, set: new Set(currentKeys) };
  }

  useInput(
    useCallback(
      (e) => {
        if (optionKeysRef.current.set.has(e.key)) {
          // Stop countdown if user makes a selection
          if (timeoutTimerRef.current) {
            clearInterval(timeoutTimerRef.current);
            timeoutTimerRef.current = null;
          }
          onSelect(e.key);
        }
      },
      [onSelect],
    ),
    { isActive: props.visible !== false },
  );

  const dividerWidth = Math.max(20, termWidth - 4);
  const borderColor = riskBorderColor(risk, colors);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Divider style="solid" width={dividerWidth} color={borderColor} />
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <Box flexDirection="row">
          <Text bold color={colors.approval.header}>{tool}</Text>
          {risk !== undefined && (
            <Text color={riskBorderColor(risk, colors)} bold> ({risk})</Text>
          )}
        </Box>
        {params !== undefined && Object.keys(params).length > 0 && (
          <Box paddingLeft={2}>
            <Text color={colors.text.dim}>{formatParams(params)}</Text>
          </Box>
        )}
        <Box flexDirection="row" paddingTop={1}>
          {options.map((opt, i) => (
            props.renderOption
              ? <Box key={opt.key}>{props.renderOption(opt, i)}</Box>
              : <Text key={opt.key}>
                  {i > 0 && <Text color={colors.text.disabled}>{"  │  "}</Text>}
                  <Text color={opt.color} bold>{opt.key}</Text>
                  <Text color={colors.text.secondary}> {opt.label}</Text>
                </Text>
          ))}
        </Box>
        {timeout !== undefined && countdownRef.current > 0 && (
          <Box paddingTop={1}>
            <Text dim color={colors.warning}>
              {formatTimeout(countdownRef.current)}
            </Text>
          </Box>
        )}
      </Box>
      <Divider style="solid" width={dividerWidth} color={borderColor} />
    </Box>
  );
});
