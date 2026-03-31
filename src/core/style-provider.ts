/**
 * StyleProvider — injects a StyleSheet into the component tree.
 * Components use useStyles() to resolve their computed styles.
 *
 * @example
 * ```tsx
 * import { createStyleSheet, StyleProvider, useStyles } from "@orchetron/storm-tui";
 *
 * const sheet = createStyleSheet({
 *   "Text":         { color: "white" },
 *   "Text.title":   { bold: true, color: "cyan" },
 *   "Button:focus": { inverse: true },
 *   "#submit":      { color: "#FFFFFF", backgroundColor: "#FFB800" },
 * });
 *
 * function MyText({ className }: { className?: string }) {
 *   const styles = useStyles("Text", className);
 *   return <Text {...styles}>Hello</Text>;
 * }
 *
 * function App() {
 *   return (
 *     <StyleProvider sheet={sheet}>
 *       <MyText className="title" />
 *     </StyleProvider>
 *   );
 * }
 * ```
 */

import { createContext, useContext, createElement, type ReactNode, type ReactElement } from "react";
import { StyleSheet, type StyleRule } from "./stylesheet.js";

// ── Context ──────────────────────────────────────────────────────────

/** React context that carries the active StyleSheet down the component tree. */
export const StyleContext = createContext<StyleSheet | null>(null);

// ── Provider ─────────────────────────────────────────────────────────

export interface StyleProviderProps {
  sheet: StyleSheet;
  children: ReactNode;
}

/**
 * Provides a StyleSheet to all descendant components.
 *
 * Nest multiple providers to override styles in sub-trees — the nearest
 * ancestor provider wins (standard React context behavior).
 */
export function StyleProvider({ sheet, children }: StyleProviderProps): ReactElement {
  return createElement(StyleContext.Provider, { value: sheet }, children);
}

// ── Hook ─────────────────────────────────────────────────────────────

/**
 * Resolve computed styles for the current component from the nearest StyleSheet.
 *
 * Returns an empty object if no StyleProvider is present in the tree,
 * so components always get a valid StyleRule without null checks.
 *
 * @param type      - Component type name (e.g. "Box", "Text", "Button")
 * @param className - Optional class name(s), space-separated
 * @param id        - Optional element ID for `#id` selector matching
 * @param states    - Active pseudo-class states (e.g. `new Set(["focus"])`)
 * @returns Resolved style rule from all matching stylesheet selectors
 */
export function useStyles(
  type: string,
  className?: string,
  id?: string,
  states?: Set<string>,
): StyleRule {
  const sheet = useContext(StyleContext);
  if (!sheet) return {};
  return sheet.resolve(type, className, states, undefined, id);
}
