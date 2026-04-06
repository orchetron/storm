import React from "react";
import { useColors } from "../../hooks/useColors.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";

export interface DefinitionListItem {
  term: string;
  definition: React.ReactNode;
}

export interface DefinitionListProps {
  items: DefinitionListItem[];
  termColor?: string | number;
  layout?: "stacked" | "inline";
  /** Separator between items: "line" for a dim horizontal line, or undefined for none. */
  separator?: "line";
  /** Custom render for each term. */
  renderTerm?: (term: string) => React.ReactNode;
}

export const DefinitionList = React.memo(function DefinitionList(rawProps: DefinitionListProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("DefinitionList", rawProps);
  const {
    items,
    termColor = colors.brand.primary,
    layout = "stacked",
    separator,
  } = props;

  if (items.length === 0) {
    return React.createElement(
      "tui-text",
      { color: colors.text.dim, dim: true },
      "(No items)",
    );
  }

  if (layout === "inline") {
    // Auto-align: find the widest term
    const maxTermWidth = items.reduce((max, item) => Math.max(max, item.term.length), 0);

    const elements: React.ReactElement[] = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index]!;
      const paddedTerm = item.term + " ".repeat(maxTermWidth - item.term.length);

      const termElement = props.renderTerm
        ? React.createElement(React.Fragment, {}, props.renderTerm(item.term))
        : React.createElement(
            "tui-text",
            { bold: true, color: termColor },
            paddedTerm,
          );

      elements.push(
        React.createElement(
          "tui-box",
          { key: `item-${index}`, flexDirection: "row" },
          termElement,
          React.createElement(
            "tui-text",
            { color: colors.text.secondary },
            " \u2014 ",
          ),
          typeof item.definition === "string"
            ? React.createElement(
                "tui-text",
                { color: colors.text.primary },
                item.definition,
              )
            : item.definition,
        ),
      );

      // Add separator between items (not after the last)
      if (separator === "line" && index < items.length - 1) {
        const lineWidth = maxTermWidth + 6; // term + " — " + some definition space
        elements.push(
          React.createElement(
            "tui-text",
            { key: `sep-${index}`, color: colors.divider, dim: true },
            "\u2500".repeat(lineWidth),
          ),
        );
      }
    }

    return React.createElement(
      "tui-box",
      { flexDirection: "column" },
      ...elements,
    );
  }

  // Stacked layout
  const elements: React.ReactElement[] = [];

  for (let index = 0; index < items.length; index++) {
    const item = items[index]!;

    const stackedTermElement = props.renderTerm
      ? React.createElement(React.Fragment, {}, props.renderTerm(item.term))
      : React.createElement(
          "tui-text",
          { bold: true, color: termColor },
          item.term,
        );

    elements.push(
      React.createElement(
        "tui-box",
        { key: `item-${index}`, flexDirection: "column" },
        // Term line
        stackedTermElement,
        // Definition indented below
        React.createElement(
          "tui-box",
          { paddingLeft: 2 },
          typeof item.definition === "string"
            ? React.createElement(
                "tui-text",
                { color: colors.text.primary },
                item.definition,
              )
            : item.definition,
        ),
      ),
    );

    // Add separator between items (not after the last)
    if (separator === "line" && index < items.length - 1) {
      elements.push(
        React.createElement(
          "tui-text",
          { key: `sep-${index}`, color: colors.divider, dim: true },
          "\u2500".repeat(30),
        ),
      );
    }
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    ...elements,
  );
});
