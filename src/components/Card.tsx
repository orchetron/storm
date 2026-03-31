/**
 * Card — clean content container with rounded borders.
 *
 * Title + content inside a rounded border box.
 * Variant controls border color. Focused state brightens border.
 *
 * Features:
 *   - footer: string or ReactNode rendered at the bottom with a dim divider
 *   - headerRight: right-aligned content in the title area
 *   - loading: shimmer placeholder instead of children
 */

import React, { useRef, createContext, useContext } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "../hooks/useCleanup.js";
import { useColors } from "../hooks/useColors.js";
import type { StormColors } from "../theme/colors.js";
import type { StormContainerStyleProps } from "../styles/styleProps.js";
import { mergeBoxStyles, pickStyleProps } from "../styles/applyStyles.js";
import { DEFAULTS } from "../styles/defaults.js";
import { useStyles } from "../core/style-provider.js";
import { usePersonality } from "../core/personality.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface CardProps extends StormContainerStyleProps {
  children: React.ReactNode;
  title?: string;
  icon?: string;
  variant?: "default" | "storm" | "success" | "error" | "warning";
  focused?: boolean;
  "aria-label"?: string;
  /** Footer content rendered at the bottom with a dim divider line above it. */
  footer?: string | React.ReactNode;
  /** Right-aligned content in the title row. */
  headerRight?: string | React.ReactNode;
  /** When true, show shimmer placeholder instead of children. */
  loading?: boolean;
  /** Custom render for the card title area. */
  renderTitle?: (title: string, icon?: string) => React.ReactNode;
}

// ── Compound Component API ──────────────────────────────────────

export interface CardContextValue {
  variant: "default" | "storm" | "success" | "error" | "warning";
  focused: boolean;
}

export const CardContext = createContext<CardContextValue | null>(null);

export function useCardContext(): CardContextValue {
  const ctx = useContext(CardContext);
  if (!ctx) throw new Error("Card sub-components must be used inside Card.Root");
  return ctx;
}

export interface CardRootProps {
  variant?: "default" | "storm" | "success" | "error" | "warning";
  focused?: boolean;
  children: React.ReactNode;
  "aria-label"?: string;
}

function CardRoot({ variant = "default", focused = false, children, ...rest }: CardRootProps): React.ReactElement {
  const colors = useColors();
  const personality = usePersonality();
  const variantColors = getVariantColors(colors);
  const borderColor = focused
    ? (variantColors[variant] ?? colors.text.secondary)
    : (variant === "default" ? colors.text.disabled : variantColors[variant] ?? colors.text.disabled);

  const ctx: CardContextValue = { variant, focused };

  return React.createElement(
    CardContext.Provider,
    { value: ctx },
    React.createElement(
      "tui-box",
      {
        flexDirection: "column",
        ...DEFAULTS.card,
        borderStyle: personality.borders.default,
        borderColor,
        borderDimColor: !focused,
        ...(rest["aria-label"] !== undefined ? { "aria-label": rest["aria-label"] } : {}),
      },
      children,
    ),
  );
}

export interface CardCompoundHeaderProps {
  children: React.ReactNode;
}

function CardCompoundHeader({ children }: CardCompoundHeaderProps): React.ReactElement {
  const colors = useColors();
  return React.createElement(
    "tui-box",
    { flexDirection: "row", marginBottom: 1 },
    children,
  );
}

export interface CardCompoundBodyProps {
  children: React.ReactNode;
}

function CardCompoundBody({ children }: CardCompoundBodyProps): React.ReactElement {
  const colors = useColors();
  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    children,
  );
}

export interface CardCompoundFooterProps {
  children: React.ReactNode;
}

function CardCompoundFooter({ children }: CardCompoundFooterProps): React.ReactElement {
  const colors = useColors();
  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    React.createElement(
      "tui-text",
      { color: colors.text.disabled, dim: true, marginTop: 1 },
      "\u2500".repeat(20),
    ),
    React.createElement(
      "tui-box",
      { flexDirection: "row" },
      children,
    ),
  );
}

// ── Recipe API (original) ───────────────────────────────────────

function getVariantColors(colors: StormColors): Record<string, string> {
  return {
    default: colors.text.dim,
    storm: colors.brand.primary,
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
  };
}

// Shimmer characters cycle for loading state
const SHIMMER_CHARS = ["\u2591", "\u2592", "\u2593", "\u2592"]; // ░▒▓▒
const SHIMMER_INTERVAL = 200;

const CardBase = React.memo(function Card(rawProps: CardProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Card", rawProps as unknown as Record<string, unknown>) as unknown as CardProps;
  const personality = usePersonality();
  const {
    children,
    title,
    icon,
    variant = "default",
    focused = false,
    footer,
    headerRight,
    loading = false,
  } = props;

  const { className, id } = props;

  // Resolve stylesheet styles
  const ssStates = new Set<string>();
  if (focused) ssStates.add("focused");
  const ssStyles = useStyles("Card", className, id, ssStates);

  const { requestRender } = useTui();
  const shimmerIndexRef = useRef(0);
  const shimmerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start/stop shimmer timer based on loading state
  if (loading && !shimmerTimerRef.current) {
    shimmerTimerRef.current = setInterval(() => {
      shimmerIndexRef.current = (shimmerIndexRef.current + 1) % SHIMMER_CHARS.length;
      requestRender();
    }, SHIMMER_INTERVAL);
  } else if (!loading && shimmerTimerRef.current) {
    clearInterval(shimmerTimerRef.current);
    shimmerTimerRef.current = null;
  }

  useCleanup(() => {
    if (shimmerTimerRef.current) {
      clearInterval(shimmerTimerRef.current);
      shimmerTimerRef.current = null;
    }
  });

  const userStyles = pickStyleProps(props as unknown as Record<string, unknown>);

  const variantColors = getVariantColors(colors);
  const borderColor = focused
    ? (variantColors[variant] ?? colors.text.secondary)
    : (variant === "default" ? colors.text.disabled : variantColors[variant] ?? colors.text.disabled);

  // Focused glow: bright border when focused, dim when not
  const borderDimColor = !focused;

  // Merge: defaults -> stylesheet -> explicit props (explicit wins)
  const boxProps = mergeBoxStyles(
    mergeBoxStyles(
      {
        flexDirection: "column",
        role: "article",
        ...DEFAULTS.card,
        borderStyle: personality.borders.default,
        borderColor,
        borderDimColor,
        ...(props["aria-label"] !== undefined ? { "aria-label": props["aria-label"] } : {}),
      },
      ssStyles as Record<string, unknown>,
    ),
    userStyles,
  );

  const elements: React.ReactElement[] = [];

  if (title !== undefined) {
    if (props.renderTitle) {
      elements.push(
        React.createElement("tui-box", { key: "hdr", flexDirection: "row", marginBottom: 1 }, props.renderTitle(title, icon)),
      );
    } else {
    const titleParts: React.ReactElement[] = [];
    if (icon) {
      titleParts.push(
        React.createElement("tui-text", { key: "i", color: borderColor }, `${icon} `),
      );
    }
    titleParts.push(
      React.createElement("tui-text", { key: "t", bold: true, color: colors.text.primary }, title),
    );

    if (headerRight !== undefined) {
      titleParts.push(
        React.createElement("tui-box", { key: "spacer", flex: 1 }),
      );
      titleParts.push(
        typeof headerRight === "string"
          ? React.createElement("tui-text", { key: "hr", color: colors.text.secondary }, headerRight)
          : React.createElement("tui-box", { key: "hr" }, headerRight),
      );
    }

    elements.push(
      React.createElement("tui-box", { key: "hdr", flexDirection: "row", marginBottom: 1 }, ...titleParts),
    );
    } // end else (no renderTitle)
  }

  // Body: either shimmer loading placeholder or actual children
  if (loading) {
    const shimmerChar = SHIMMER_CHARS[shimmerIndexRef.current] ?? SHIMMER_CHARS[0]!;
    const shimmerLine = shimmerChar.repeat(16);
    elements.push(
      React.createElement(
        "tui-box",
        { key: "body", flexDirection: "column" },
        React.createElement("tui-text", { color: colors.text.disabled, dim: true }, shimmerLine),
        React.createElement("tui-text", { color: colors.text.disabled, dim: true }, shimmerLine.slice(0, 12)),
        React.createElement("tui-text", { color: colors.text.disabled, dim: true }, shimmerLine.slice(0, 8)),
      ),
    );
  } else {
    elements.push(
      React.createElement("tui-box", { key: "body", flexDirection: "column" }, children),
    );
  }

  // Footer with dim divider
  if (footer !== undefined) {
    elements.push(
      React.createElement(
        "tui-text",
        { key: "footer-divider", color: colors.text.disabled, dim: true, marginTop: 1 },
        "\u2500".repeat(20),
      ),
    );
    elements.push(
      typeof footer === "string"
        ? React.createElement("tui-text", { key: "footer", color: colors.text.secondary, dim: true }, footer)
        : React.createElement("tui-box", { key: "footer" }, footer),
    );
  }

  return React.createElement("tui-box", boxProps, ...elements);
});

// ── Static compound assignments ─────────────────────────────────
export const Card = Object.assign(CardBase, {
  Root: CardRoot,
  Header: CardCompoundHeader,
  Body: CardCompoundBody,
  Footer: CardCompoundFooter,
});
