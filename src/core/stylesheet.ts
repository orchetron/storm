/**
 * StyleSheet — CSS-like styling for terminal components.
 *
 * Supports type selectors, class selectors, ID selectors, state pseudo-classes,
 * and descendant combinators. Styles cascade with specificity.
 *
 * @example
 * ```ts
 * const sheet = createStyleSheet({
 *   "Box":            { padding: 1 },
 *   "Text":           { color: "white" },
 *   "Text.title":     { bold: true, color: "cyan" },
 *   "Button:focus":   { inverse: true },
 *   "Box.sidebar Text": { dim: true },
 *   "#submit":        { color: "#FFFFFF", backgroundColor: "#FFB800" },
 * });
 *
 * // Resolve styles for a focused Button with className "primary"
 * const styles = sheet.resolve("Button", "primary", new Set(["focus"]));
 *
 * // Resolve styles by ID
 * const idStyles = sheet.resolve("Button", undefined, undefined, undefined, "submit");
 * ```
 */

// ── StyleRule ────────────────────────────────────────────────────────

/** Declarative style properties for terminal components. */
export interface StyleRule {
  // Visual
  color?: string | number;
  backgroundColor?: string | number;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  inverse?: boolean;
  // Border
  borderStyle?: string;
  borderColor?: string | number;
  // Layout — spacing
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  margin?: number;
  marginX?: number;
  marginY?: number;
  gap?: number;
  // Flex
  flex?: number;
  flexDirection?: string;
  alignItems?: string;
  justifyContent?: string;
}

// ── Selector parsing ─────────────────────────────────────────────────

/**
 * A parsed segment of a compound selector.
 *
 * Examples:
 *   "Button"        -> { type: "Button" }
 *   ".title"        -> { classes: ["title"] }
 *   "Text.title"    -> { type: "Text", classes: ["title"] }
 *   "Button:focus"  -> { type: "Button", pseudos: ["focus"] }
 *   "#submit"       -> { id: "submit" }
 *   "Button#submit" -> { type: "Button", id: "submit" }
 */
interface SelectorSegment {
  type?: string;
  id?: string;
  classes: string[];
  pseudos: string[];
}

/** A full parsed selector is a list of segments (descendant combinator). */
interface ParsedSelector {
  segments: SelectorSegment[];
  specificity: number;
}

/**
 * Parse a single selector segment like "Text.title:focus" or "#submit".
 * Supports type, class, ID, and pseudo-class parts.
 * Returns undefined if the segment is malformed.
 */
function parseSegment(raw: string): SelectorSegment | undefined {
  // Split pseudo-classes first (they use ":")
  const pseudoParts = raw.split(":");
  const mainPart = pseudoParts[0]!;
  const pseudos = pseudoParts.slice(1).filter(Boolean);

  // Extract ID selector (e.g., "#submit" or "Button#submit")
  let id: string | undefined;
  let remaining = mainPart;
  const hashIdx = remaining.indexOf("#");
  if (hashIdx !== -1) {
    // Everything after # until the next . or end is the ID
    const afterHash = remaining.slice(hashIdx + 1);
    const dotInId = afterHash.indexOf(".");
    if (dotInId !== -1) {
      id = afterHash.slice(0, dotInId);
      remaining = remaining.slice(0, hashIdx) + afterHash.slice(dotInId);
    } else {
      id = afterHash;
      remaining = remaining.slice(0, hashIdx);
    }
  }

  // Split classes (they use ".")
  const classParts = remaining.split(".");
  const typePart = classParts[0]; // may be empty if selector starts with "."
  const classes = classParts.slice(1).filter(Boolean);

  return {
    ...(typePart ? { type: typePart } : {}),
    ...(id ? { id } : {}),
    classes,
    pseudos,
  };
}

/**
 * Compute CSS-like specificity for a parsed selector.
 *
 * Scoring (per segment):
 *   - ID selector:      +100
 *   - Each pseudo-class: +10  (treated like class-level specificity)
 *   - Each class:        +10
 *   - Type selector:     +1
 *
 * Multi-segment selectors (descendant combinators) accumulate from all segments.
 */
function computeSpecificity(segments: SelectorSegment[]): number {
  let score = 0;
  for (const seg of segments) {
    if (seg.id) score += 100;
    if (seg.type) score += 1;
    score += seg.classes.length * 10;
    score += seg.pseudos.length * 10;
  }
  return score;
}

/**
 * Parse a full selector string, which may include descendant combinators
 * (space-separated segments).
 *
 * Examples:
 *   "Box Text"               -> two segments
 *   "Box.sidebar Text.title" -> two segments with classes
 *   "#submit"                -> single segment with ID
 */
function parseSelector(selector: string): ParsedSelector | undefined {
  const parts = selector.trim().split(/\s+/);
  const segments: SelectorSegment[] = [];

  for (const part of parts) {
    const seg = parseSegment(part);
    if (!seg) return undefined;
    segments.push(seg);
  }

  if (segments.length === 0) return undefined;

  return {
    segments,
    specificity: computeSpecificity(segments),
  };
}

// ── Matching ─────────────────────────────────────────────────────────

/**
 * Check if a single segment matches a component's properties.
 */
function segmentMatches(
  seg: SelectorSegment,
  type: string,
  classNames: Set<string>,
  states: Set<string>,
  id?: string,
): boolean {
  // Type must match if specified
  if (seg.type && seg.type !== type) return false;

  // ID must match if specified
  if (seg.id && seg.id !== id) return false;

  // All classes in the selector must be present on the component
  for (const cls of seg.classes) {
    if (!classNames.has(cls)) return false;
  }

  // All pseudo-classes must be active
  for (const pseudo of seg.pseudos) {
    if (!states.has(pseudo)) return false;
  }

  return true;
}

/**
 * Check if a full parsed selector matches the current component context.
 *
 * The last segment must match the target component. Earlier segments must
 * match ancestors in order (not necessarily adjacent -- descendant combinator).
 */
function selectorMatches(
  parsed: ParsedSelector,
  type: string,
  classNames: Set<string>,
  states: Set<string>,
  ancestors: AncestorInfo[],
  id?: string,
): boolean {
  const { segments } = parsed;
  if (segments.length === 0) return false;

  // Last segment must match the target component
  const targetSeg = segments[segments.length - 1]!;
  if (!segmentMatches(targetSeg, type, classNames, states, id)) return false;

  // No ancestor segments -- we're done
  if (segments.length === 1) return true;

  // Match ancestor segments from right to left (skipping the last which is the target)
  const ancestorSegs = segments.slice(0, -1);
  let segIdx = ancestorSegs.length - 1;

  // Walk up the ancestor chain looking for matches
  for (let i = ancestors.length - 1; i >= 0 && segIdx >= 0; i--) {
    const anc = ancestors[i]!;
    const seg = ancestorSegs[segIdx]!;
    // Ancestors are matched with empty states -- pseudo-classes only apply to the target
    if (segmentMatches(seg, anc.type, anc.classNames, EMPTY_SET, anc.id)) {
      segIdx--;
    }
  }

  // All ancestor segments must have been matched
  return segIdx < 0;
}

// ── Ancestor info ────────────────────────────────────────────────────

interface AncestorInfo {
  type: string;
  classNames: Set<string>;
  id?: string;
}

const EMPTY_SET: Set<string> = new Set();

/**
 * Build ancestor info from a raw string array.
 *
 * Each ancestor string can be:
 *   - "Box"           -> type only
 *   - "Box.sidebar"   -> type with class
 *   - "Box#main"      -> type with ID
 */
function parseAncestors(raw: string[]): AncestorInfo[] {
  return raw.map((s) => {
    // Extract ID if present
    let id: string | undefined;
    let remaining = s;
    const hashIdx = remaining.indexOf("#");
    if (hashIdx !== -1) {
      const afterHash = remaining.slice(hashIdx + 1);
      const dotInId = afterHash.indexOf(".");
      if (dotInId !== -1) {
        id = afterHash.slice(0, dotInId);
        remaining = remaining.slice(0, hashIdx) + afterHash.slice(dotInId);
      } else {
        id = afterHash;
        remaining = remaining.slice(0, hashIdx);
      }
    }

    const dotIdx = remaining.indexOf(".");
    if (dotIdx === -1) {
      return { type: remaining, classNames: EMPTY_SET, ...(id ? { id } : {}) };
    }
    const type = remaining.slice(0, dotIdx);
    const classes = remaining.slice(dotIdx + 1).split(".").filter(Boolean);
    return { type, classNames: new Set(classes), ...(id ? { id } : {}) };
  });
}

// ── Merge ────────────────────────────────────────────────────────────

/** Merge two style rules. Later values override earlier ones. */
function mergeRules(base: StyleRule, override: StyleRule): StyleRule {
  const result: StyleRule = { ...base };
  for (const key of Object.keys(override) as (keyof StyleRule)[]) {
    const val = override[key];
    if (val !== undefined) {
      (result as Record<string, unknown>)[key] = val;
    }
  }
  return result;
}

// ── StyleSheet ───────────────────────────────────────────────────────

interface CompiledRule {
  parsed: ParsedSelector;
  style: StyleRule;
}

/**
 * A compiled stylesheet that resolves styles for components based on
 * type, className, ID, states, and ancestor context.
 *
 * Rules are pre-parsed and sorted by specificity on creation.
 * The `resolve` method returns merged styles from all matching rules.
 *
 * @example
 * ```ts
 * const styles = StyleSheet.create({
 *   "Button": { color: "#00FF00", bold: true },
 *   "Button.danger": { color: "#FF0000" },
 *   "Card:focused": { borderColor: "#FFB800" },
 *   "#submit": { color: "#FFFFFF", backgroundColor: "#FFB800" },
 * });
 *
 * <StyleProvider stylesheet={styles}>
 *   <Button className="danger" label="Delete" />
 * </StyleProvider>
 * ```
 */
export class StyleSheet {
  /** @internal */
  private readonly rules: CompiledRule[];

  /** @internal */
  constructor(rules: CompiledRule[]) {
    this.rules = rules;
  }

  /**
   * Add a single rule to the stylesheet. Returns a new StyleSheet
   * (stylesheets are treated as immutable after creation).
   *
   * @param selector - CSS-like selector string
   * @param styles   - Style properties to apply
   * @returns A new StyleSheet with the added rule
   */
  add(selector: string, styles: StyleRule): StyleSheet {
    const parsed = parseSelector(selector);
    if (!parsed) return this;
    const newRules = [...this.rules, { parsed, style: styles }];
    newRules.sort((a, b) => a.parsed.specificity - b.parsed.specificity);
    return new StyleSheet(newRules);
  }

  /**
   * Add multiple rules at once. Returns a new StyleSheet.
   *
   * @param rules - Record of selector strings to style rules
   * @returns A new StyleSheet with the added rules
   */
  addAll(rules: Record<string, StyleRule>): StyleSheet {
    const newRules = [...this.rules];
    for (const [selector, style] of Object.entries(rules)) {
      const parsed = parseSelector(selector);
      if (parsed) {
        newRules.push({ parsed, style });
      }
    }
    newRules.sort((a, b) => a.parsed.specificity - b.parsed.specificity);
    return new StyleSheet(newRules);
  }

  /**
   * Resolve the computed style for a component.
   *
   * @param type      - Component type name (e.g. "Box", "Text", "Button")
   * @param className - Optional class name(s), space-separated (e.g. "title sidebar")
   * @param states    - Active pseudo-class states (e.g. new Set(["focus", "hover"]))
   * @param ancestors - Ancestor components from root to parent (e.g. ["Box.sidebar", "Text"])
   * @param id        - Optional element ID (e.g. "submit-btn")
   * @returns Merged style from all matching rules, ordered by specificity
   */
  resolve(
    type: string,
    className?: string,
    states?: Set<string>,
    ancestors?: string[],
    id?: string,
  ): StyleRule {
    const classNames = className
      ? new Set(className.trim().split(/\s+/).filter(Boolean))
      : EMPTY_SET;
    const activeStates = states ?? EMPTY_SET;
    const ancestorInfo = ancestors ? parseAncestors(ancestors) : [];

    let result: StyleRule = {};

    // Rules are already sorted by specificity (ascending).
    // Matching rules are merged in order so higher specificity wins.
    for (const rule of this.rules) {
      if (selectorMatches(rule.parsed, type, classNames, activeStates, ancestorInfo, id)) {
        result = mergeRules(result, rule.style);
      }
    }

    return result;
  }

  /**
   * Create a StyleSheet from a record of CSS-like selectors to style rules.
   * Equivalent to `createStyleSheet()` but as a static method.
   *
   * @example
   * ```ts
   * const sheet = StyleSheet.create({
   *   "Button": { color: "#00FF00", bold: true },
   *   "Button.danger": { color: "#FF0000" },
   *   "Card:focused": { borderColor: "#FFB800" },
   *   "#submit": { color: "#FFFFFF", backgroundColor: "#FFB800" },
   * });
   * ```
   */
  static create(rules: Record<string, StyleRule>): StyleSheet {
    return createStyleSheet(rules);
  }
}

// ── Factory ──────────────────────────────────────────────────────────

/**
 * Create a StyleSheet from a record of CSS-like selectors to style rules.
 *
 * @example
 * ```ts
 * const sheet = createStyleSheet({
 *   "Text":           { color: "white" },
 *   "Text.heading":   { bold: true, color: "cyan" },
 *   "Button":         { backgroundColor: "blue" },
 *   "Button:focus":   { inverse: true },
 *   "Button:disabled": { dim: true },
 *   "Box.sidebar Text": { color: "gray" },
 *   "#submit":        { color: "#FFFFFF", backgroundColor: "#FFB800" },
 *   "Button#submit":  { bold: true },
 * });
 * ```
 *
 * Selector syntax:
 *   - Type:       `"Box"`, `"Text"`, `"Button"`
 *   - Class:      `".title"`, `"Text.title"`
 *   - ID:         `"#submit"`, `"Button#submit"`
 *   - Pseudo:     `":focus"`, `"Button:focus"`, `":disabled"`
 *   - Combined:   `"Button.primary:focus"`, `"Button#submit.primary"`
 *   - Descendant: `"Box Text"`, `"Box.sidebar Text.heading"`
 */
export function createStyleSheet(rules: Record<string, StyleRule>): StyleSheet {
  const compiled: CompiledRule[] = [];

  for (const [selector, style] of Object.entries(rules)) {
    const parsed = parseSelector(selector);
    if (!parsed) {
      // Skip invalid selectors silently in production.
      // In development you'd want a warning here.
      continue;
    }
    compiled.push({ parsed, style });
  }

  // Sort by specificity ascending so lower-specificity rules are applied first,
  // then overridden by higher-specificity rules during merge.
  compiled.sort((a, b) => a.parsed.specificity - b.parsed.specificity);

  return new StyleSheet(compiled);
}
