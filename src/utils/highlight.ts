import React from "react";

/**
 * Render text with search highlights. Splits text by query matches
 * (case-insensitive) and returns an array of tui-text elements with
 * highlighted (inverse) spans for matches.
 *
 * @param text         The full text to render.
 * @param query        The search query to highlight.
 * @param baseProps    Base tui-text props (color, dim, bold, etc.) for non-highlighted segments.
 * @param keyPrefix    Prefix for React keys to avoid collisions.
 * @param highlightProps  Additional props for highlighted spans (e.g. `{ color: matchColor }`).
 */
export function renderHighlightedText(
  text: string,
  query: string,
  baseProps: Record<string, unknown>,
  keyPrefix: string | number,
  highlightProps?: Record<string, unknown>,
): React.ReactElement[] {
  if (!query) {
    return [React.createElement("tui-text", { ...baseProps, key: `${keyPrefix}-txt` }, text)];
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: React.ReactElement[] = [];
  let lastIndex = 0;
  let partKey = 0;

  let searchFrom = 0;
  while (searchFrom < lowerText.length) {
    const idx = lowerText.indexOf(lowerQuery, searchFrom);
    if (idx === -1) break;

    // Text before match
    if (idx > lastIndex) {
      parts.push(
        React.createElement(
          "tui-text",
          { ...baseProps, key: `${keyPrefix}-p${partKey++}` },
          text.slice(lastIndex, idx),
        ),
      );
    }

    // Highlighted match
    parts.push(
      React.createElement(
        "tui-text",
        {
          key: `${keyPrefix}-h${partKey++}`,
          bold: true,
          inverse: true,
          ...(highlightProps ?? {}),
        },
        text.slice(idx, idx + query.length),
      ),
    );

    lastIndex = idx + query.length;
    searchFrom = lastIndex;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(
      React.createElement(
        "tui-text",
        { ...baseProps, key: `${keyPrefix}-p${partKey++}` },
        text.slice(lastIndex),
      ),
    );
  }

  return parts.length > 0 ? parts : [React.createElement("tui-text", { ...baseProps, key: `${keyPrefix}-txt` }, text)];
}
