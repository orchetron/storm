import React, { useRef, useCallback } from "react";
import { useInput } from "../../hooks/useInput.js";
import { useColors } from "../../hooks/useColors.js";
import type { KeyEvent } from "../../input/types.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { pickStyleProps } from "../../styles/applyStyles.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface PaginatorProps extends StormLayoutStyleProps {
  total: number;
  current: number;
  style?: "dots" | "numbers" | "fraction";
  onPageChange?: (page: number) => void;
  isFocused?: boolean;
  /** Custom render for each page indicator. */
  renderPage?: (page: number, state: { isActive: boolean }) => React.ReactNode;
  "aria-label"?: string;
}

const FILLED_DOT = "\u25CF"; // filled circle
const EMPTY_DOT = "\u25CB";  // empty circle

export const Paginator = React.memo(function Paginator(rawProps: PaginatorProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Paginator", rawProps);
  const {
    total,
    current: rawCurrent,
    color = colors.brand.primary,
    style = "dots",
    onPageChange,
    isFocused = false,
  } = props;

  const layoutProps = pickStyleProps(props);

  // Clamp current page to valid range (0-based: 0 to total-1)
  const current = total > 0 ? Math.max(0, Math.min(rawCurrent, total - 1)) : 0;

  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  const currentRef = useRef(current);
  currentRef.current = current;
  const totalRef = useRef(total);
  totalRef.current = total;

  const handleInput = useCallback((event: KeyEvent) => {
    const cb = onPageChangeRef.current;
    if (!cb) return;

    const cur = currentRef.current;
    const tot = totalRef.current;

    if (event.key === "left" && cur > 0) {
      cb(cur - 1);
    } else if (event.key === "right" && cur < tot - 1) {
      cb(cur + 1);
    }
  }, []);

  useInput(handleInput, { isActive: isFocused });

  const layoutBoxProps: Record<string, unknown> = { ...layoutProps };

  if (style === "fraction") {
    return React.createElement(
      "tui-box",
      { flexDirection: "row", role: "navigation", "aria-label": props["aria-label"], ...layoutBoxProps },
      React.createElement("tui-text", { color }, `${current + 1} / ${total}`),
    );
  }

  if (style === "numbers") {
    const children: React.ReactElement[] = [];

    // Left arrow
    children.push(
      React.createElement(
        "tui-text",
        { key: "left", color: current > 0 ? color : colors.text.dim },
        "< ",
      ),
    );

    let pagesToShow: (number | "ellipsis")[];
    if (total <= 7) {
      pagesToShow = Array.from({ length: total }, (_, i) => i);
    } else {
      // Always show first, last, and pages around current with "..." gaps
      const pages = new Set<number>();
      pages.add(0);
      pages.add(total - 1);
      for (let d = -1; d <= 1; d++) {
        const p = current + d;
        if (p >= 0 && p < total) pages.add(p);
      }
      const sorted = [...pages].sort((a, b) => a - b);
      pagesToShow = [];
      for (let j = 0; j < sorted.length; j++) {
        if (j > 0 && sorted[j]! - sorted[j - 1]! > 1) {
          pagesToShow.push("ellipsis");
        }
        pagesToShow.push(sorted[j]!);
      }
    }

    // Page numbers
    for (let idx = 0; idx < pagesToShow.length; idx++) {
      const entry = pagesToShow[idx]!;
      if (entry === "ellipsis") {
        children.push(
          React.createElement(
            "tui-text",
            { key: `ell-${idx}`, color: colors.text.dim },
            "\u2026",
          ),
        );
      } else {
        const isCurrent = entry === current;
        children.push(
          React.createElement(
            "tui-text",
            {
              key: `p-${entry}`,
              ...(isCurrent ? { bold: true, color } : { color: colors.text.secondary }),
            },
            isCurrent ? `[${entry + 1}]` : `${entry + 1}`,
          ),
        );
      }
      if (idx < pagesToShow.length - 1) {
        children.push(
          React.createElement("tui-text", { key: `s-${idx}` }, " "),
        );
      }
    }

    // Right arrow
    children.push(
      React.createElement(
        "tui-text",
        { key: "right", color: current < total - 1 ? color : colors.text.dim },
        " >",
      ),
    );

    return React.createElement(
      "tui-box",
      { flexDirection: "row", role: "navigation", "aria-label": props["aria-label"], ...layoutBoxProps },
      ...children,
    );
  }

  // Default: dots style
  const dots: React.ReactElement[] = [];
  for (let i = 0; i < total; i++) {
    const isCurrent = i === current;
    if (props.renderPage) {
      dots.push(
        React.createElement(React.Fragment, { key: `d-${i}` }, props.renderPage(i, { isActive: isCurrent })),
      );
    } else {
      dots.push(
        React.createElement(
          "tui-text",
          {
            key: `d-${i}`,
            color: isCurrent ? color : colors.text.dim,
          },
          isCurrent ? FILLED_DOT : EMPTY_DOT,
        ),
      );
    }
    if (i < total - 1) {
      dots.push(
        React.createElement("tui-text", { key: `sp-${i}` }, " "),
      );
    }
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "row", role: "navigation", "aria-label": props["aria-label"], ...layoutBoxProps },
    ...dots,
  );
});
