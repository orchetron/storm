/**
 * Tree view — serializes the TuiElement tree into a readable string.
 *
 * Useful for debugging component hierarchies and layout values.
 */

import type { TuiRoot, TuiElement, TuiTextNode } from "../reconciler/types.js";
import { isTuiElement, isTuiTextNode } from "../reconciler/types.js";

/**
 * Serialize the element tree rooted at `root` into a human-readable string.
 *
 * Output format:
 * ```
 * tui-box (column, 80x24)
 *   tui-text "Hello" (fg=#82AAFF, bold)
 *   tui-box (row, 80x3)
 *     tui-text "World"
 *     tui-text "!" (dim)
 * ```
 *
 * @param root - The TuiRoot container to serialize.
 * @param maxDepth - Maximum tree depth to display (default: Infinity).
 */
export function serializeTree(root: TuiRoot, maxDepth?: number): string {
  const limit = maxDepth ?? Infinity;
  const lines: string[] = [];

  for (const child of root.children) {
    serializeNode(child, 0, limit, lines);
  }

  return lines.join("\n");
}

function serializeNode(
  node: TuiElement | TuiTextNode,
  depth: number,
  maxDepth: number,
  lines: string[],
): void {
  if (depth > maxDepth) return;

  const indent = "  ".repeat(depth);

  if (isTuiTextNode(node)) {
    const escaped = node.text.length > 40
      ? JSON.stringify(node.text.slice(0, 37) + "...")
      : JSON.stringify(node.text);
    lines.push(`${indent}#text ${escaped}`);
    return;
  }

  if (isTuiElement(node)) {
    const parts: string[] = [node.type];
    const annotations = describeElement(node);
    if (annotations) parts.push(`(${annotations})`);
    lines.push(`${indent}${parts.join(" ")}`);

    for (const child of node.children) {
      serializeNode(child, depth + 1, maxDepth, lines);
    }
  }
}

function describeElement(el: TuiElement): string {
  const attrs: string[] = [];
  const layout = el.layoutNode.layout;

  // Direction (for boxes)
  const dir = el.props["flexDirection"] as string | undefined;
  if (dir) attrs.push(dir);

  // Dimensions from layout
  if (layout.width > 0 || layout.height > 0) {
    attrs.push(`${layout.width}x${layout.height}`);
  }

  // Text content — collect direct text node children
  if (el.type === "tui-text") {
    const textContent = collectText(el);
    if (textContent) {
      const display = textContent.length > 30
        ? JSON.stringify(textContent.slice(0, 27) + "...")
        : JSON.stringify(textContent);
      attrs.unshift(display);
    }
  }

  // Style attributes
  const fg = el.props["color"] as string | number | undefined;
  if (fg !== undefined) {
    attrs.push(`fg=${typeof fg === "number" ? `#${fg.toString(16).padStart(6, "0").toUpperCase()}` : fg}`);
  }
  if (el.props["bold"]) attrs.push("bold");
  if (el.props["dim"] || el.props["dimColor"]) attrs.push("dim");
  if (el.props["italic"]) attrs.push("italic");
  if (el.props["underline"]) attrs.push("underline");
  if (el.props["strikethrough"]) attrs.push("strikethrough");
  if (el.props["inverse"]) attrs.push("inverse");

  // Border
  const border = el.props["borderStyle"] as string | undefined;
  if (border && border !== "none") attrs.push(`border=${border}`);

  return attrs.join(", ");
}

function collectText(el: TuiElement): string {
  let result = "";
  for (const child of el.children) {
    if (isTuiTextNode(child)) {
      result += child.text;
    } else if (isTuiElement(child) && child.type === "tui-text") {
      result += collectText(child);
    }
  }
  return result;
}
