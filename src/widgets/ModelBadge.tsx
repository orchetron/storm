/**
 * ModelBadge — displays model name with capability indicators.
 *
 * Renders: diamond + model name (bold) + capability badges (dim) + context size.
 * Provider can influence the diamond color.
 *
 * @module
 */

import React from "react";
import { useColors } from "../hooks/useColors.js";
import type { StormColors } from "../theme/colors.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

// ── Types ────────────────────────────────────────────────────────────

export interface ModelBadgeProps {
  /** Model name (e.g. "my-model-v2"). */
  model: string;
  /** Provider name: "cloud", "local", "custom", etc. */
  provider?: string;
  /** Capability tags like ["vision", "tools", "code"]. */
  capabilities?: string[];
  /** Max context window tokens. */
  maxTokens?: number;
  /** Override color for the badge. */
  color?: string | number;
  /** Custom render for the model display. */
  renderModel?: (model: string, provider?: string) => React.ReactNode;
  /** Override or extend the provider color map. Merged with built-in PROVIDER_COLORS. */
  providerColors?: Record<string, string>;
}

// ── Helpers ──────────────────────────────────────────────────────────

function getProviderColors(colors: StormColors): Record<string, string> {
  return {
    cloud: colors.brand.primary,
    enterprise: colors.success,
    research: colors.info,
    community: "#D18EE2",
    custom: "#FF7000",
    local: "#888888",
    default: "#AAAAAA",
  };
}

function fmtContext(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ── Component ────────────────────────────────────────────────────────

export const ModelBadge = React.memo(function ModelBadge(rawProps: ModelBadgeProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("ModelBadge", rawProps as unknown as Record<string, unknown>) as unknown as ModelBadgeProps;
  const { model, provider, capabilities, maxTokens, color, providerColors } = props;
  const baseProviderColors = getProviderColors(colors);
  const effectiveProviderColors: Record<string, string> = providerColors
    ? { ...baseProviderColors, ...providerColors }
    : baseProviderColors;

  if (props.renderModel) {
    return React.createElement(
      "tui-box",
      { flexDirection: "row" },
      props.renderModel(model, provider),
    );
  }

  const badgeColor = color ?? (provider ? effectiveProviderColors[provider] ?? colors.text.primary : colors.text.primary);

  const parts: React.ReactElement[] = [];

  // Diamond + model name
  parts.push(
    React.createElement(
      "tui-text",
      { key: "diamond", color: badgeColor, bold: true },
      "\u25C6 ",
    ),
  );

  parts.push(
    React.createElement(
      "tui-text",
      { key: "model", bold: true },
      model,
    ),
  );

  // Capability badges
  if (capabilities && capabilities.length > 0) {
    parts.push(
      React.createElement(
        "tui-text",
        { key: "cap-space" },
        " ",
      ),
    );
    for (let i = 0; i < capabilities.length; i++) {
      if (i > 0) {
        parts.push(
          React.createElement("tui-text", { key: `cap-sep-${i}` }, " "),
        );
      }
      parts.push(
        React.createElement(
          "tui-text",
          { key: `cap-${i}`, dim: true },
          `[${capabilities[i]}]`,
        ),
      );
    }
  }

  // Context size
  if (maxTokens !== undefined) {
    parts.push(
      React.createElement(
        "tui-text",
        { key: "ctx", dim: true },
        ` ${fmtContext(maxTokens)}`,
      ),
    );
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    ...parts,
  );
});
