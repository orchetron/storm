/**
 * WelcomeBanner — Storm's branded welcome banner.
 *
 * Renders a branded welcome screen with gradient title, subtitle, and
 * version. Uses Storm's signature heavy-dash separator and diamond icon.
 */

import React, { useRef } from "react";
import { interpolateColor } from "../components/Gradient.js";
import { useInput } from "../hooks/useInput.js";
import { useColors } from "../hooks/useColors.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

export interface WelcomeBannerProps {
  /** Banner title (default "STORM") */
  title?: string;
  /** Subtitle text (default "Terminal UI at the speed of lightning.") */
  subtitle?: string;
  /** Version string */
  version?: string;
  /** Apply gradient to title (default true) */
  showGradient?: boolean;
  /** Single-line compact mode */
  compact?: boolean;
  /** Tips to display. A random tip is shown each render. */
  tips?: string[];
  /** Callback fired when the user presses any key to dismiss the banner. */
  onDismiss?: () => void;
  /** Custom render for the banner title. */
  renderTitle?: (title: string) => React.ReactNode;
  /** Separator character (default "━") */
  separatorChar?: string;
  /** Diamond icon character (default "◆") */
  diamondIcon?: string;
}

const DEFAULT_SEPARATOR_CHAR = "\u2501"; // ━
const DEFAULT_DIAMOND_ICON = "\u25C6"; // ◆

export const WelcomeBanner = React.memo(function WelcomeBanner(rawProps: WelcomeBannerProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("WelcomeBanner", rawProps as unknown as Record<string, unknown>) as unknown as WelcomeBannerProps;
  const {
    title = "STORM",
    subtitle = "Terminal UI at the speed of lightning.",
    version,
    showGradient = false,
    compact = true,
    tips,
    onDismiss,
    separatorChar = DEFAULT_SEPARATOR_CHAR,
    diamondIcon = DEFAULT_DIAMOND_ICON,
  } = props;

  // Pick a stable random tip index (persists across re-renders)
  const tipIndexRef = useRef<number>(
    tips && tips.length > 0 ? Math.floor(Math.random() * tips.length) : 0,
  );
  const selectedTip = tips && tips.length > 0 ? tips[tipIndexRef.current % tips.length] : undefined;

  // Any key dismisses the banner
  useInput(
    () => {
      onDismiss?.();
    },
    { isActive: onDismiss !== undefined },
  );

  if (compact) {
    // Single-line mode: ◆ storm · Terminal UI at the speed of lightning.
    const elements: React.ReactElement[] = [];

    elements.push(
      React.createElement(
        "tui-text",
        { key: "diamond", color: colors.brand.primary },
        `${diamondIcon} `,
      ),
    );

    if (showGradient) {
      const chars = [...title.toLowerCase()];
      chars.forEach((ch, i) => {
        const t = chars.length <= 1 ? 0 : i / (chars.length - 1);
        const c = interpolateColor(colors.brand.primary, colors.brand.light, t);
        elements.push(
          React.createElement("tui-text", { key: `t${i}`, color: c, bold: true }, ch),
        );
      });
    } else {
      elements.push(
        React.createElement("tui-text", { key: "title", color: colors.brand.primary, bold: true }, title.toLowerCase()),
      );
    }

    if (subtitle) {
      elements.push(
        React.createElement("tui-text", { key: "dot", color: colors.text.dim }, " \u00B7 "),
      );
      elements.push(
        React.createElement("tui-text", { key: "sub", color: colors.text.dim, dim: true }, subtitle),
      );
    }
    if (version) {
      elements.push(
        React.createElement("tui-text", { key: "ver", color: colors.text.dim, dim: true }, `  v${version}`),
      );
    }

    return React.createElement(
      "tui-box",
      { flexDirection: "row" },
      ...elements,
    );
  }

  // Full banner mode
  const rows: React.ReactElement[] = [];

  // ── Top separator row with title: ━━━ ⚡ STORM ━━━━━━━━━━━━━━━━━━━━
  const topElements: React.ReactElement[] = [];

  topElements.push(
    React.createElement(
      "tui-text",
      { key: "pre", color: colors.brand.primary },
      `  ${separatorChar}${separatorChar}${separatorChar} `,
    ),
  );
  topElements.push(
    React.createElement(
      "tui-text",
      { key: "diamond", color: colors.brand.primary },
      `${diamondIcon} `,
    ),
  );

  if (props.renderTitle) {
    topElements.push(
      React.createElement(React.Fragment, { key: "title" }, props.renderTitle(title)),
    );
  } else if (showGradient) {
    const chars = [...title];
    chars.forEach((ch, i) => {
      const t = chars.length <= 1 ? 0 : i / (chars.length - 1);
      const c = interpolateColor(colors.brand.primary, colors.brand.light, t);
      topElements.push(
        React.createElement("tui-text", { key: `t${i}`, color: c, bold: true }, ch),
      );
    });
  } else {
    topElements.push(
      React.createElement("tui-text", { key: "title", color: colors.brand.primary, bold: true }, title),
    );
  }

  topElements.push(
    React.createElement(
      "tui-text",
      { key: "trail", color: colors.brand.light },
      ` ${separatorChar.repeat(30)}`,
    ),
  );

  rows.push(
    React.createElement(
      "tui-box",
      { key: "top", flexDirection: "row" },
      ...topElements,
    ),
  );

  // ── Subtitle + version row
  const subParts: React.ReactElement[] = [];
  if (subtitle) {
    subParts.push(
      React.createElement(
        "tui-text",
        { key: "sub", color: colors.text.dim, dim: true },
        `  ${subtitle}`,
      ),
    );
  }
  if (version) {
    subParts.push(
      React.createElement(
        "tui-text",
        { key: "ver", color: colors.text.dim, dim: true },
        `  v${version}`,
      ),
    );
  }
  if (subParts.length > 0) {
    rows.push(
      React.createElement(
        "tui-box",
        { key: "sub", flexDirection: "row" },
        ...subParts,
      ),
    );
  }

  // ── Tip of the day ─────────────────────────────────────────────────
  if (selectedTip) {
    rows.push(
      React.createElement(
        "tui-box",
        { key: "tip", flexDirection: "row", paddingLeft: 2 },
        React.createElement(
          "tui-text",
          { dim: true },
          `\u{1F4A1} Tip: ${selectedTip}`,
        ),
      ),
    );
  }

  // ── Dismiss hint ──────────────────────────────────────────────────
  if (onDismiss) {
    rows.push(
      React.createElement(
        "tui-box",
        { key: "dismiss", flexDirection: "row", paddingLeft: 2, paddingTop: 1 },
        React.createElement(
          "tui-text",
          { dim: true, color: colors.text.secondary },
          "Press any key to continue",
        ),
      ),
    );
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    ...rows,
  );
});
