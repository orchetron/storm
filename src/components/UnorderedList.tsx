/**
 * UnorderedList — bulleted list component with custom icons and status.
 *
 * Renders a vertical list of items with a bullet marker prefix.
 * Items can be strings, React elements, or nested lists.
 * Different markers at each nesting level: bullet, circle, square.
 * Supports per-item icons and status indicators.
 */

import React from "react";
import { useColors } from "../hooks/useColors.js";
import type { StormColors } from "../theme/colors.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

const MAX_DEPTH = 20;

export type ItemStatus = "success" | "error" | "pending" | "running";

export type ListItem =
  | React.ReactNode
  | {
      content: React.ReactNode;
      children?: ListItem[];
      /** Per-item icon (overrides global icon and default marker). */
      icon?: string;
      /** Status indicator: success=green check, error=red x, pending=dim circle, running=spinner. */
      status?: ItemStatus;
    };

const LEVEL_MARKERS = ["\u2022", "\u25E6", "\u25AA"]; // bullet, circle, square

/** Status indicator mappings. */
const STATUS_ICONS: Record<ItemStatus, string> = {
  success: "\u2713", // ✓
  error: "\u2717",   // ✗
  pending: "\u25CB", // ○
  running: "\u25D4", // ◔ (spinner-like)
};

function getStatusColors(colors: StormColors): Record<ItemStatus, string | number> {
  return {
    success: colors.success,
    error: colors.error,
    pending: colors.text.dim,
    running: colors.brand.primary,
  };
}

export interface UnorderedListProps {
  items: ListItem[];
  marker?: string;
  color?: string | number;
  markerColor?: string | number;
  /** Global icon for all items (overridden by per-item icon). */
  icon?: string;
  /** Custom renderer for each list item. */
  renderItem?: (item: string | React.ReactNode, index: number, marker: string) => React.ReactNode;
}

function renderUnorderedItems(
  items: ListItem[],
  marker: string | undefined,
  color: string | number,
  markerColor: string | number,
  level: number,
  globalIcon: string | undefined,
  statusColors: Record<ItemStatus, string | number>,
  renderItemFn?: (item: string | React.ReactNode, index: number, marker: string) => React.ReactNode,
): React.ReactElement[] {
  if (level >= MAX_DEPTH) return [];
  const rows: React.ReactElement[] = [];
  const indent = "  ".repeat(level);
  const defaultMarker = marker !== undefined
    ? marker
    : LEVEL_MARKERS[level % LEVEL_MARKERS.length] ?? LEVEL_MARKERS[0]!;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Determine content, children, icon, and status
    let content: React.ReactNode;
    let children: ListItem[] | undefined;
    let itemIcon: string | undefined;
    let itemStatus: ItemStatus | undefined;

    if (item !== null && typeof item === "object" && !React.isValidElement(item) && "content" in (item as Record<string, unknown>)) {
      const nested = item as { content: React.ReactNode; children?: ListItem[]; icon?: string; status?: ItemStatus };
      content = nested.content;
      children = nested.children;
      itemIcon = nested.icon;
      itemStatus = nested.status;
    } else {
      content = item as React.ReactNode;
    }

    // Determine what marker/icon to show
    let displayMarker: string;
    let displayMarkerColor: string | number = markerColor;
    let displayMarkerDim = false;

    if (itemStatus) {
      // Status takes priority for the marker
      displayMarker = STATUS_ICONS[itemStatus];
      displayMarkerColor = statusColors[itemStatus];
      if (itemStatus === "pending") displayMarkerDim = true;
    } else if (itemIcon !== undefined) {
      displayMarker = itemIcon;
    } else if (globalIcon !== undefined) {
      displayMarker = globalIcon;
    } else {
      displayMarker = defaultMarker;
    }

    const markerProps: Record<string, unknown> = { color: displayMarkerColor };
    if (displayMarkerDim) markerProps["dim"] = true;

    const markerStr = `${indent}${displayMarker} `;

    if (renderItemFn) {
      rows.push(
        React.createElement(
          "tui-box",
          { key: `item-${level}-${i}`, flexDirection: "row" },
          renderItemFn(content as string | React.ReactNode, i, markerStr),
        ),
      );
    } else {
      rows.push(
        React.createElement(
          "tui-box",
          { key: `item-${level}-${i}`, flexDirection: "row" },
          React.createElement(
            "tui-text",
            markerProps,
            markerStr,
          ),
          typeof content === "string"
            ? React.createElement("tui-text", { color }, content)
            : content,
        ),
      );
    }

    if (children && children.length > 0) {
      const childRows = renderUnorderedItems(children, marker, color, markerColor, level + 1, globalIcon, statusColors, renderItemFn);
      rows.push(...childRows);
    }
  }

  return rows;
}

export const UnorderedList = React.memo(function UnorderedList(rawProps: UnorderedListProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("UnorderedList", rawProps as unknown as Record<string, unknown>) as unknown as UnorderedListProps;
  const {
    items,
    marker,
    color: colorProp,
    markerColor: markerColorProp,
    icon,
  } = props;

  const color = colorProp ?? colors.text.primary;
  const markerColor = markerColorProp ?? colors.text.secondary;
  const statusColors = getStatusColors(colors);

  if (items.length === 0) {
    return React.createElement(
      "tui-text",
      { color: colors.text.dim, dim: true },
      "(No items)",
    );
  }

  const rows = renderUnorderedItems(items, marker, color, markerColor, 0, icon, statusColors, props.renderItem);

  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    ...rows,
  );
});
