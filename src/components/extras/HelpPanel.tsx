
import React, { useRef, useCallback } from "react";
import { useInput } from "../../hooks/useInput.js";
import { useColors } from "../../hooks/useColors.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { usePersonality } from "../../core/personality.js";
import { useForceUpdate } from "../../hooks/useForceUpdate.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { pickStyleProps } from "../../styles/applyStyles.js";
import type { KeyEvent } from "../../input/types.js";

export interface HelpBinding {
  /** Key combo label, e.g. "Ctrl+S", "↑↓" */
  keys: string;
  /** Human-readable description of what the binding does */
  description: string;
  /** Category for grouping (e.g. "Navigation", "Editing") */
  category?: string;
}

export interface HelpPanelProps extends StormLayoutStyleProps {
  /** Array of keyboard shortcut bindings to display. */
  bindings: HelpBinding[];
  /** Display mode: "inline" renders in document flow, "modal" renders as an overlay. */
  mode?: "inline" | "modal";
  /** Title displayed at the top of the panel. */
  title?: string;
  /** Description text displayed below the title. */
  description?: string;
  /** Number of columns for the binding list. Defaults to 2. */
  columns?: number;
  /** Whether the panel is currently visible. Managed externally or via triggerKey. */
  visible?: boolean;
  /** Called when the panel requests to close (Escape or triggerKey toggle). */
  onClose?: () => void;
  /** Key that toggles the panel open/closed. Defaults to "?". */
  triggerKey?: string;
  /** When true, the panel listens for the trigger key to toggle visibility. */
  selfManaged?: boolean;
  /** Maximum height before scrolling (number of rows). 0 = no limit. */
  maxHeight?: number;
  /** Custom render for each binding row. */
  renderBinding?: (binding: HelpBinding) => React.ReactNode;
}

export const HelpPanel = React.memo(function HelpPanel(rawProps: HelpPanelProps): React.ReactElement | null {
  const colors = useColors();
  const personality = usePersonality();
  const forceUpdate = useForceUpdate();
  const props = usePluginProps("HelpPanel", rawProps);

  const {
    bindings,
    mode = "inline",
    title,
    description,
    columns = 2,
    visible: visibleProp,
    onClose,
    triggerKey = "?",
    selfManaged = false,
    maxHeight = 0,
  } = props;

  const layoutProps = pickStyleProps(props);

  // Internal visibility state via ref (for selfManaged mode)
  const visibleRef = useRef(false);
  const filterRef = useRef("");
  const scrollOffsetRef = useRef(0);

  const isVisible = selfManaged ? visibleRef.current : (visibleProp ?? false);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleInput = useCallback((event: KeyEvent) => {
    if (event.key === triggerKey || (triggerKey === "?" && event.raw === "?")) {
      event.consumed = true;
      if (selfManaged) {
        visibleRef.current = !visibleRef.current;
        filterRef.current = "";
        scrollOffsetRef.current = 0;
        forceUpdate();
      } else if (isVisible) {
        onCloseRef.current?.();
      }
      return;
    }

    if (!isVisible) return;

    if (event.key === "escape") {
      event.consumed = true;
      if (selfManaged) {
        visibleRef.current = false;
        filterRef.current = "";
        scrollOffsetRef.current = 0;
        forceUpdate();
      }
      onCloseRef.current?.();
      return;
    }

    // Search filter: printable characters
    if (event.raw && event.raw.length === 1 && !event.ctrl && !event.meta) {
      event.consumed = true;
      filterRef.current += event.raw;
      scrollOffsetRef.current = 0;
      forceUpdate();
      return;
    }

    // Backspace clears last filter char
    if (event.key === "backspace") {
      event.consumed = true;
      filterRef.current = filterRef.current.slice(0, -1);
      scrollOffsetRef.current = 0;
      forceUpdate();
      return;
    }

    // Scroll with arrow keys
    if (event.key === "up") {
      event.consumed = true;
      scrollOffsetRef.current = Math.max(0, scrollOffsetRef.current - 1);
      forceUpdate();
      return;
    }
    if (event.key === "down") {
      event.consumed = true;
      scrollOffsetRef.current += 1;
      forceUpdate();
      return;
    }
  }, [triggerKey, selfManaged, isVisible, forceUpdate]);

  useInput(handleInput, { isActive: true, priority: mode === "modal" ? 900 : 0 });

  if (!isVisible) return null;

  // ── Filter bindings ──────────────────────────────────────────
  const filter = filterRef.current.toLowerCase();
  const filtered = filter
    ? bindings.filter(
        (b) =>
          b.keys.toLowerCase().includes(filter) ||
          b.description.toLowerCase().includes(filter) ||
          (b.category ?? "").toLowerCase().includes(filter),
      )
    : bindings;

  // ── Group by category ────────────────────────────────────────
  const grouped = new Map<string, HelpBinding[]>();
  for (const binding of filtered) {
    const cat = binding.category ?? "";
    let list = grouped.get(cat);
    if (!list) {
      list = [];
      grouped.set(cat, list);
    }
    list.push(binding);
  }

  // ── Build content children ───────────────────────────────────
  const contentChildren: React.ReactElement[] = [];

  // Title
  if (title) {
    contentChildren.push(
      React.createElement(
        "tui-text",
        { key: "title", bold: true, color: colors.text.primary },
        title,
      ),
    );
  }

  // Description
  if (description) {
    contentChildren.push(
      React.createElement(
        "tui-text",
        { key: "desc", color: colors.text.secondary },
        description,
      ),
    );
  }

  // Divider after title/description
  if (title || description) {
    contentChildren.push(
      React.createElement(
        "tui-text",
        { key: "divider", color: colors.divider },
        "\u2500".repeat(40),
      ),
    );
  }

  // Search filter indicator
  if (filter) {
    contentChildren.push(
      React.createElement(
        "tui-box",
        { key: "filter", flexDirection: "row", marginTop: 0 },
        React.createElement(
          "tui-text",
          { color: colors.text.dim, dim: true },
          "Filter: ",
        ),
        React.createElement(
          "tui-text",
          { color: colors.brand.primary, bold: true },
          filter,
        ),
      ),
    );
  }

  let groupIdx = 0;
  const groupEntries = Array.from(grouped.entries());
  for (const [category, categoryBindings] of groupEntries) {
    // Category header
    if (category) {
      contentChildren.push(
        React.createElement(
          "tui-text",
          {
            key: `cat-${groupIdx}`,
            bold: true,
            color: colors.brand.primary,
            marginTop: groupIdx > 0 || title || description ? 1 : 0,
          },
          category,
        ),
      );
    }

    // Multi-column layout for bindings within the category
    const colCount = Math.max(1, columns);
    const perColumn = Math.ceil(categoryBindings.length / colCount);

    for (let row = 0; row < perColumn; row++) {
      const rowChildren: React.ReactElement[] = [];

      for (let col = 0; col < colCount; col++) {
        const idx = col * perColumn + row;
        if (idx >= categoryBindings.length) continue;
        const binding = categoryBindings[idx]!;
        const bindingKey = `g${groupIdx}-r${row}-c${col}`;

        if (props.renderBinding) {
          rowChildren.push(
            React.createElement(
              "tui-box",
              { key: bindingKey, flexDirection: "row", marginRight: 2 },
              React.createElement(React.Fragment, null, props.renderBinding(binding)),
            ),
          );
        } else {
          // Kbd-style key rendering: [key] description
          rowChildren.push(
            React.createElement(
              "tui-box",
              { key: bindingKey, flexDirection: "row", marginRight: 2 },
              React.createElement(
                "tui-text",
                { color: colors.text.secondary, dim: true },
                "[",
              ),
              React.createElement(
                "tui-text",
                { color: colors.text.secondary, bold: true },
                binding.keys,
              ),
              React.createElement(
                "tui-text",
                { color: colors.text.secondary, dim: true },
                "]",
              ),
              React.createElement(
                "tui-text",
                { color: colors.text.primary },
                ` ${binding.description}`,
              ),
            ),
          );
        }
      }

      contentChildren.push(
        React.createElement(
          "tui-box",
          { key: `row-${groupIdx}-${row}`, flexDirection: "row" },
          ...rowChildren,
        ),
      );
    }

    groupIdx++;
  }

  // Footer hint
  contentChildren.push(
    React.createElement(
      "tui-text",
      { key: "hint", dim: true, color: colors.text.dim, marginTop: 1 },
      filter
        ? "[Esc] close  [Backspace] clear filter  [Type] to filter"
        : "[Esc] close  [Type] to filter",
    ),
  );

  // ── Apply scroll offset for maxHeight ────────────────────────
  // Scrolling is handled by slicing contentChildren when maxHeight > 0
  let displayChildren = contentChildren;
  if (maxHeight > 0 && contentChildren.length > maxHeight) {
    const offset = Math.min(scrollOffsetRef.current, Math.max(0, contentChildren.length - maxHeight));
    scrollOffsetRef.current = offset;
    displayChildren = contentChildren.slice(offset, offset + maxHeight);
  }

  // ── Render mode ──────────────────────────────────────────────
  if (mode === "modal") {
    return React.createElement(
      "tui-overlay",
      {
        visible: true,
        position: "center" as const,
        borderStyle: personality.borders.panel,
        borderColor: personality.colors.brand.primary,
        padding: 1,
        paddingX: 2,
        role: "dialog",
        ...layoutProps,
      },
      React.createElement(
        "tui-box",
        { flexDirection: "column" },
        ...displayChildren,
      ),
    );
  }

  // Inline mode
  return React.createElement(
    "tui-box",
    {
      flexDirection: "column",
      borderStyle: personality.borders.panel,
      borderColor: colors.divider,
      padding: 1,
      paddingX: 2,
      ...layoutProps,
    },
    ...displayChildren,
  );
});
