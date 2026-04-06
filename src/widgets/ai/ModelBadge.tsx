import React from "react";
import { useColors } from "../../hooks/useColors.js";
import type { StormColors } from "../../theme/colors.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface ModelBadgeProps {
  model: string;
  provider?: string;
  capabilities?: string[];
  maxTokens?: number;
  color?: string | number;
  renderModel?: (model: string, provider?: string) => React.ReactNode;
  /** Merged with built-in PROVIDER_COLORS. */
  providerColors?: Record<string, string>;
}

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

export const ModelBadge = React.memo(function ModelBadge(rawProps: ModelBadgeProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("ModelBadge", rawProps);
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
