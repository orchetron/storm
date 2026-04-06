import React, { useRef, useCallback } from "react";
import { useInput } from "../../hooks/useInput.js";
import { useColors } from "../../hooks/useColors.js";
import { useForceUpdate } from "../../hooks/useForceUpdate.js";
import { usePersonality } from "../../core/personality.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { useTui } from "../../context/TuiContext.js";
import { Gradient } from "../effects/Gradient.js";
import { pickStyleProps } from "../../styles/applyStyles.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import type { KeyEvent } from "../../input/types.js";

/** A selectable action shown in the recent items section. */
export interface WelcomeAction {
  /** Unique key for this action. */
  id: string;
  /** Display label (e.g. "my-project — 2 hours ago"). */
  label: string;
  /** Optional description shown dimmed after the label. */
  description?: string;
  /** Optional icon/symbol prefix (e.g. "📁", "⚡"). */
  icon?: string;
}

/** A keyboard shortcut entry shown in the shortcuts section. */
export interface WelcomeShortcut {
  /** Key combination display string (e.g. "Ctrl+N"). */
  key: string;
  /** Human-readable label (e.g. "New project"). */
  label: string;
}

export interface WelcomeProps extends StormLayoutStyleProps {
  /** App title displayed prominently at center. */
  title: string;
  /** Optional app version string (e.g. "v1.2.3"). */
  version?: string;
  /** Optional app description / tagline. */
  description?: string;
  /** Optional ASCII art or logo text rendered above the title. */
  logo?: string;
  /** Gradient color stops for the title. When provided, title renders with gradient. */
  titleGradient?: string[];
  /** Gradient color stops for the logo. When provided, logo renders with gradient. */
  logoGradient?: string[];
  /** Recent items / actions list. When provided, renders a selectable list. */
  actions?: WelcomeAction[];
  /** Keyboard shortcuts to display. */
  shortcuts?: WelcomeShortcut[];
  /** Section header for the actions list (default: "Recent"). */
  actionsTitle?: string;
  /** Section header for the shortcuts list (default: "Keyboard Shortcuts"). */
  shortcutsTitle?: string;
  /** Number of columns for keyboard shortcuts (default: 2). */
  shortcutColumns?: number;
  /** Dismiss prompt text (default: "Press any key to continue"). */
  prompt?: string;
  /** Called when the user presses any key or selects an action. */
  onDismiss?: (selectedAction?: WelcomeAction) => void;
  /** Optional background pattern prop (passed to root container). */
  background?: unknown;
  /** Whether the welcome screen is visible (default: true). */
  visible?: boolean;
  children?: React.ReactNode;
}

export const Welcome = React.memo(function Welcome(rawProps: WelcomeProps): React.ReactElement | null {
  const colors = useColors();
  const personality = usePersonality();
  const props = usePluginProps("Welcome", rawProps);
  const { screen } = useTui();
  const forceUpdate = useForceUpdate();

  const {
    title,
    version,
    description,
    logo,
    titleGradient,
    logoGradient,
    actions,
    shortcuts,
    actionsTitle = "Recent",
    shortcutsTitle = "Keyboard Shortcuts",
    shortcutColumns = 2,
    prompt = "Press any key to continue",
    onDismiss,
    background,
    visible = true,
    children,
  } = props;

  const layoutProps = pickStyleProps(props);

  // ── State via refs ─────────────────────────────────────────
  const selectedIndexRef = useRef(0);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // ── Input handling ─────────────────────────────────────────
  const handleInput = useCallback((event: KeyEvent) => {
    const currentActions = actionsRef.current;
    const hasActions = currentActions && currentActions.length > 0;

    // Navigation within actions list
    if (hasActions) {
      if (event.key === "up" || (event.key === "k" && !event.ctrl)) {
        event.consumed = true;
        selectedIndexRef.current = Math.max(0, selectedIndexRef.current - 1);
        forceUpdate();
        return;
      }
      if (event.key === "down" || (event.key === "j" && !event.ctrl)) {
        event.consumed = true;
        selectedIndexRef.current = Math.min(currentActions.length - 1, selectedIndexRef.current + 1);
        forceUpdate();
        return;
      }
      if (event.key === "return") {
        event.consumed = true;
        const selected = currentActions[selectedIndexRef.current];
        onDismissRef.current?.(selected);
        return;
      }
    }

    // Any other key dismisses
    event.consumed = true;
    onDismissRef.current?.();
  }, [forceUpdate]);

  useInput(handleInput, { isActive: visible, priority: 500 });

  if (!visible) return null;

  // ── Build children ─────────────────────────────────────────
  const sections: React.ReactElement[] = [];

  // Logo / ASCII art
  if (logo) {
    if (logoGradient && logoGradient.length >= 2) {
      sections.push(
        React.createElement(
          "tui-box",
          { key: "logo", justifyContent: "center", flexDirection: "row" },
          React.createElement(Gradient, { colors: logoGradient, direction: "vertical" as const, children: logo }),
        ),
      );
    } else {
      sections.push(
        React.createElement(
          "tui-box",
          { key: "logo", justifyContent: "center", flexDirection: "column" },
          ...logo.split("\n").map((line, i) =>
            React.createElement(
              "tui-text",
              { key: `logo-${i}`, color: colors.brand.primary, bold: true },
              line,
            ),
          ),
        ),
      );
    }

    // Spacer after logo
    sections.push(
      React.createElement("tui-box", { key: "logo-spacer", height: 1 }),
    );
  }

  // Title
  if (titleGradient && titleGradient.length >= 2) {
    sections.push(
      React.createElement(
        "tui-box",
        { key: "title", justifyContent: "center", flexDirection: "row" },
        React.createElement(Gradient, { colors: titleGradient, children: title }),
      ),
    );
  } else {
    sections.push(
      React.createElement(
        "tui-text",
        { key: "title", bold: true, color: colors.brand.primary },
        title,
      ),
    );
  }

  // Version badge
  if (version) {
    sections.push(
      React.createElement(
        "tui-text",
        { key: "version", color: colors.text.dim, dim: true },
        version,
      ),
    );
  }

  // Description
  if (description) {
    sections.push(
      React.createElement(
        "tui-text",
        { key: "desc", color: colors.text.secondary, marginTop: 1 },
        description,
      ),
    );
  }

  // Divider
  const dividerWidth = Math.min(60, Math.max(20, screen.width - 20));
  sections.push(
    React.createElement(
      "tui-text",
      { key: "divider", color: colors.divider, marginTop: 1 },
      "\u2500".repeat(dividerWidth),
    ),
  );

  // Recent actions section
  if (actions && actions.length > 0) {
    sections.push(
      React.createElement(
        "tui-text",
        { key: "actions-title", bold: true, color: colors.text.secondary, marginTop: 1 },
        actionsTitle,
      ),
    );

    const selectedIdx = selectedIndexRef.current;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]!;
      const isSelected = i === selectedIdx;

      const indicator = isSelected ? "\u25B6 " : "  ";
      const labelColor = isSelected ? colors.brand.light : colors.text.primary;
      const bgColor = isSelected ? colors.surface.highlight : undefined;

      const actionParts: React.ReactElement[] = [];

      // Selection indicator
      actionParts.push(
        React.createElement(
          "tui-text",
          { key: `ind-${i}`, color: isSelected ? colors.brand.primary : colors.text.dim },
          indicator,
        ),
      );

      // Icon
      if (action.icon) {
        actionParts.push(
          React.createElement(
            "tui-text",
            { key: `icon-${i}`, color: labelColor },
            `${action.icon} `,
          ),
        );
      }

      // Label
      actionParts.push(
        React.createElement(
          "tui-text",
          { key: `label-${i}`, color: labelColor, bold: isSelected },
          action.label,
        ),
      );

      // Description
      if (action.description) {
        actionParts.push(
          React.createElement(
            "tui-text",
            { key: `adesc-${i}`, color: colors.text.dim, dim: true },
            `  ${action.description}`,
          ),
        );
      }

      sections.push(
        React.createElement(
          "tui-box",
          {
            key: `action-${i}`,
            flexDirection: "row",
            ...(bgColor ? { backgroundColor: bgColor } : {}),
          },
          ...actionParts,
        ),
      );
    }
  }

  // Keyboard shortcuts section
  if (shortcuts && shortcuts.length > 0) {
    sections.push(
      React.createElement(
        "tui-text",
        { key: "shortcuts-title", bold: true, color: colors.text.secondary, marginTop: 1 },
        shortcutsTitle,
      ),
    );

    const perColumn = Math.ceil(shortcuts.length / shortcutColumns);

    for (let row = 0; row < perColumn; row++) {
      const rowParts: React.ReactElement[] = [];

      for (let col = 0; col < shortcutColumns; col++) {
        const idx = col * perColumn + row;
        if (idx >= shortcuts.length) continue;
        const shortcut = shortcuts[idx]!;

        if (col > 0) {
          rowParts.push(
            React.createElement(
              "tui-text",
              { key: `ssep-${idx}`, color: colors.text.dim },
              "   ",
            ),
          );
        }

        rowParts.push(
          React.createElement(
            "tui-text",
            { key: `skey-${idx}`, color: colors.brand.primary, bold: true },
            shortcut.key,
          ),
        );
        rowParts.push(
          React.createElement(
            "tui-text",
            { key: `slbl-${idx}`, color: colors.text.secondary },
            ` ${shortcut.label}`,
          ),
        );
      }

      sections.push(
        React.createElement(
          "tui-box",
          { key: `srow-${row}`, flexDirection: "row" },
          ...rowParts,
        ),
      );
    }
  }

  // Custom children
  if (children) {
    sections.push(
      React.createElement(
        "tui-box",
        { key: "custom", flexDirection: "column", marginTop: 1 },
        children,
      ),
    );
  }

  // Bottom divider
  sections.push(
    React.createElement(
      "tui-text",
      { key: "divider-bottom", color: colors.divider, marginTop: 1 },
      "\u2500".repeat(dividerWidth),
    ),
  );

  // Dismiss prompt (pulsing style via dim)
  sections.push(
    React.createElement(
      "tui-text",
      { key: "prompt", color: colors.text.dim, marginTop: 1 },
      prompt,
    ),
  );

  // ── Root layout: full-screen centered column ───────────────
  return React.createElement(
    "tui-box",
    {
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%",
      ...(background ? { background } : {}),
      ...layoutProps,
    },
    ...sections,
  );
});
