import React, { useRef, useCallback, createContext, useContext } from "react";
import { useInput } from "../../hooks/useInput.js";
import { useForceUpdate } from "../../hooks/useForceUpdate.js";
import { useTui } from "../../context/TuiContext.js";
import { useColors } from "../../hooks/useColors.js";
import { usePersonality } from "../../core/personality.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { FocusGroup } from "../core/FocusGroup.js";
import type { KeyEvent } from "../../input/types.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { findNextNavigable } from "../../utils/navigation.js";

export interface PaletteCommand {
  /** Unique identifier for the command. */
  id: string;
  /** Display name shown in the palette. */
  name: string;
  /** Brief description shown dim after the name. */
  description: string;
  /** Category for grouping (e.g. "File", "Edit", "Navigation"). */
  category?: string;
  /** Keyboard shortcut hint (e.g. "Ctrl+S"). Rendered right-aligned and dim. */
  shortcut?: string;
  /** Icon character or emoji rendered before the name. */
  icon?: string;
  /** Whether this command is currently disabled. */
  disabled?: boolean;
}

/**
 * Simple fuzzy match: checks if all characters of the query appear
 * in order within the target string. Returns a score (lower = better match)
 * or -1 if no match.
 */
function fuzzyScore(target: string, query: string): number {
  const tLower = target.toLowerCase();
  const qLower = query.toLowerCase();
  let tIdx = 0;
  let score = 0;
  let lastMatchIdx = -1;

  for (let qIdx = 0; qIdx < qLower.length; qIdx++) {
    const ch = qLower[qIdx]!;
    let found = false;
    while (tIdx < tLower.length) {
      if (tLower[tIdx] === ch) {
        // Bonus for consecutive matches
        const gap = lastMatchIdx >= 0 ? tIdx - lastMatchIdx - 1 : tIdx;
        score += gap;
        // Bonus for matching at word boundaries
        if (tIdx === 0 || tLower[tIdx - 1] === " " || tLower[tIdx - 1] === "-" || tLower[tIdx - 1] === "_") {
          score -= 2;
        }
        lastMatchIdx = tIdx;
        tIdx++;
        found = true;
        break;
      }
      tIdx++;
    }
    if (!found) return -1;
  }

  return score;
}

function fuzzyMatch(command: PaletteCommand, query: string): boolean {
  if (query === "") return true;
  const nameScore = fuzzyScore(command.name, query);
  if (nameScore >= 0) return true;
  const descScore = fuzzyScore(command.description, query);
  if (descScore >= 0) return true;
  if (command.category) {
    const catScore = fuzzyScore(command.category, query);
    if (catScore >= 0) return true;
  }
  return false;
}

function fuzzyRank(command: PaletteCommand, query: string): number {
  if (query === "") return 0;
  const nameScore = fuzzyScore(command.name, query);
  const descScore = fuzzyScore(command.description, query);
  const catScore = command.category ? fuzzyScore(command.category, query) : -1;
  const scores = [nameScore, descScore, catScore].filter((s) => s >= 0);
  if (scores.length === 0) return Infinity;
  return Math.min(...scores);
}

export interface CommandPaletteContextValue {
  isOpen: boolean;
  query: string;
  filtered: PaletteCommand[];
  activeIndex: number;
  onExecute: (command: PaletteCommand) => void;
  close: () => void;
}

export const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPaletteContext(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("CommandPalette sub-components must be used inside CommandPalette.Root");
  return ctx;
}

let nextPaletteId = 0;

export interface CommandPaletteRootProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  filtered: PaletteCommand[];
  activeIndex: number;
  onExecute: (command: PaletteCommand) => void;
  children: React.ReactNode;
}

function CommandPaletteRoot({
  isOpen,
  onClose,
  query,
  filtered,
  activeIndex,
  onExecute,
  children,
}: CommandPaletteRootProps): React.ReactElement | null {
  const personality = usePersonality();
  const colors = useColors();

  const groupIdRef = useRef(`cmd-palette-${nextPaletteId++}`);

  if (!isOpen) return null;

  const ctx: CommandPaletteContextValue = {
    isOpen,
    query,
    filtered,
    activeIndex,
    onExecute,
    close: onClose,
  };

  return React.createElement(
    "tui-overlay",
    {
      visible: true,
      position: "top-center",
      borderStyle: personality.borders.panel,
      borderColor: colors.brand.primary,
      padding: 1,
      width: 60,
      role: "dialog",
      "aria-label": "Command Palette",
    },
    React.createElement(
      FocusGroup,
      { id: groupIdRef.current, trap: true, direction: "vertical" },
      React.createElement(
        CommandPaletteContext.Provider,
        { value: ctx },
        React.createElement("tui-box", { flexDirection: "column" }, children),
      ),
    ),
  );
}

export interface CommandPaletteInputProps {
  placeholder?: string;
}

function CommandPaletteInput({ placeholder = "Type a command..." }: CommandPaletteInputProps): React.ReactElement {
  const colors = useColors();
  const { query } = useCommandPaletteContext();

  const children: React.ReactElement[] = [
    React.createElement("tui-text", { key: "icon", color: colors.brand.primary }, "> "),
  ];

  if (query.length > 0) {
    children.push(
      React.createElement("tui-text", { key: "query", color: colors.text.primary }, query),
      React.createElement("tui-text", { key: "cursor", color: colors.brand.light }, "\u2588"),
    );
  } else {
    children.push(
      React.createElement("tui-text", { key: "placeholder", color: colors.text.dim, dim: true }, placeholder),
      React.createElement("tui-text", { key: "cursor", color: colors.brand.light }, "\u2588"),
    );
  }

  return React.createElement("tui-box", { flexDirection: "row" }, ...children);
}

export interface CommandPaletteListProps {
  children?: React.ReactNode;
  emptyText?: string;
}

function CommandPaletteList({ children, emptyText = "No commands found" }: CommandPaletteListProps): React.ReactElement {
  const colors = useColors();
  const { filtered } = useCommandPaletteContext();

  if (filtered.length === 0) {
    return React.createElement(
      "tui-box",
      { flexDirection: "column", marginTop: 1 },
      React.createElement("tui-text", { color: colors.text.dim, dim: true }, emptyText),
    );
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "column", marginTop: 1 },
    children,
  );
}

export interface CommandPaletteItemProps {
  command: PaletteCommand;
  isActive?: boolean;
  children?: React.ReactNode;
}

function CommandPaletteItem({ command, isActive = false, children }: CommandPaletteItemProps): React.ReactElement {
  const colors = useColors();

  if (children) {
    return React.createElement("tui-box", { flexDirection: "row" }, children);
  }

  const bgColor = isActive ? colors.surface.highlight : undefined;
  const nameColor = command.disabled
    ? colors.text.disabled
    : isActive
      ? colors.brand.light
      : colors.text.primary;

  const itemChildren: React.ReactElement[] = [];

  // Pointer indicator
  itemChildren.push(
    React.createElement(
      "tui-text",
      { key: "ptr", color: isActive ? colors.brand.primary : colors.text.dim },
      isActive ? "\u25B6 " : "  ",
    ),
  );

  // Icon
  if (command.icon) {
    itemChildren.push(
      React.createElement(
        "tui-text",
        { key: "icon", color: isActive ? colors.brand.primary : colors.text.secondary },
        command.icon + " ",
      ),
    );
  }

  // Name
  itemChildren.push(
    React.createElement(
      "tui-text",
      { key: "name", color: nameColor, bold: isActive && !command.disabled, dim: command.disabled },
      command.name,
    ),
  );

  // Description
  itemChildren.push(
    React.createElement(
      "tui-text",
      { key: "desc", color: colors.text.dim, dim: true },
      "  " + command.description,
    ),
  );

  // Shortcut (right-aligned via flex: 1 spacer)
  if (command.shortcut) {
    itemChildren.push(
      React.createElement("tui-box", { key: "spacer", flex: 1 }),
      React.createElement(
        "tui-text",
        { key: "shortcut", color: colors.text.dim, dim: true },
        " " + command.shortcut,
      ),
    );
  }

  return React.createElement(
    "tui-box",
    {
      flexDirection: "row",
      ...(bgColor !== undefined ? { backgroundColor: bgColor } : {}),
    },
    ...itemChildren,
  );
}

export interface CommandPaletteProps extends StormLayoutStyleProps {
  /** Array of command definitions to display. */
  commands: PaletteCommand[];
  /** Called when a command is selected. */
  onExecute: (command: PaletteCommand) => void;
  /** Key character that opens the palette (default: "/"). */
  trigger?: string;
  /** Whether the component listens for the trigger key (default: true). */
  isActive?: boolean;
  /** Controlled open state. Omit for uncontrolled (trigger key). */
  isOpen?: boolean;
  /** Called when open state changes (for controlled mode). */
  onOpenChange?: (open: boolean) => void;
  /** Maximum visible items before scrolling (default: 10). */
  maxVisible?: number;
  /** Overlay width (default: 60). */
  overlayWidth?: number;
  /** Placeholder text in the search input. */
  placeholder?: string;
  /** Text shown when no commands match the query. */
  emptyText?: string;
  /** ARIA label for the overlay. */
  "aria-label"?: string;
  /** Custom renderer for each command item. */
  renderItem?: (command: PaletteCommand, state: { isActive: boolean; index: number }) => React.ReactNode;
}

const CommandPaletteBase = React.memo(function CommandPalette(rawProps: CommandPaletteProps): React.ReactElement | null {
  const colors = useColors();
  const personality = usePersonality();
  const props = usePluginProps("CommandPalette", rawProps);

  const {
    commands,
    onExecute,
    trigger = "/",
    isActive = true,
    isOpen: controlledIsOpen,
    onOpenChange,
    maxVisible = 10,
    overlayWidth = 60,
    placeholder = "Type a command...",
    emptyText = "No commands found",
  } = props;

  const { requestRender } = useTui();
  const forceUpdate = useForceUpdate();

  // ── Refs for mutable state ─────────────────────────────────
  const isOpenRef = useRef(false);
  const queryRef = useRef("");
  const activeIndexRef = useRef(0);
  const groupIdRef = useRef(`cmd-palette-${nextPaletteId++}`);

  // ── Refs for latest props ──────────────────────────────────
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const onExecuteRef = useRef(onExecute);
  onExecuteRef.current = onExecute;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  // ── Controlled vs uncontrolled ─────────────────────────────
  const isControlled = controlledIsOpen !== undefined;
  const effectiveIsOpen = isControlled ? controlledIsOpen : isOpenRef.current;

  // ── Filtering ──────────────────────────────────────────────
  const getFiltered = (): PaletteCommand[] => {
    const q = queryRef.current;
    const cmds = commandsRef.current;
    if (q === "") return cmds;
    return cmds
      .filter((cmd) => fuzzyMatch(cmd, q))
      .sort((a, b) => fuzzyRank(a, q) - fuzzyRank(b, q));
  };

  // ── Open / Close ───────────────────────────────────────────
  const open = () => {
    queryRef.current = "";
    activeIndexRef.current = 0;
    if (!isControlled) {
      isOpenRef.current = true;
    }
    onOpenChangeRef.current?.(true);
    forceUpdate();
  };

  const close = () => {
    queryRef.current = "";
    activeIndexRef.current = 0;
    if (!isControlled) {
      isOpenRef.current = false;
    }
    onOpenChangeRef.current?.(false);
    forceUpdate();
  };

  // ── Compute filtered + clamp ───────────────────────────────
  const filtered = getFiltered();

  if (activeIndexRef.current >= filtered.length && filtered.length > 0) {
    activeIndexRef.current = filtered.length - 1;
  }

  if (filtered.length > 0 && filtered[activeIndexRef.current]?.disabled) {
    const len = filtered.length;
    for (let i = 1; i < len; i++) {
      const idx = (activeIndexRef.current + i) % len;
      if (!filtered[idx]?.disabled) {
        activeIndexRef.current = idx;
        break;
      }
    }
  }

  if (!effectiveIsOpen) {
    queryRef.current = "";
  }

  // ── Keyboard handler ───────────────────────────────────────
  const handleInput = useCallback((event: KeyEvent) => {
    const currentIsOpen = isOpenRef.current || controlledIsOpen;

    if (!currentIsOpen) {
      if (event.char === trigger && !event.ctrl && !event.meta) {
        event.consumed = true;
        open();
      }
      return;
    }

    // Palette is open — consume all keys to prevent pass-through
    event.consumed = true;

    if (event.key === "escape") {
      close();
      return;
    }

    if (event.key === "return") {
      const items = getFiltered();
      if (items.length > 0 && activeIndexRef.current < items.length) {
        const cmd = items[activeIndexRef.current]!;
        if (!cmd.disabled) {
          close();
          onExecuteRef.current(cmd);
        }
      }
      return;
    }

    if (event.key === "up" && !event.ctrl && !event.meta) {
      const items = getFiltered();
      if (items.length > 0) {
        activeIndexRef.current = findNextNavigable(items.length, activeIndexRef.current, -1, (i) => !items[i]?.disabled);
        forceUpdate();
      }
      return;
    }

    if (event.key === "down" && !event.ctrl && !event.meta) {
      const items = getFiltered();
      if (items.length > 0) {
        activeIndexRef.current = findNextNavigable(items.length, activeIndexRef.current, 1, (i) => !items[i]?.disabled);
        forceUpdate();
      }
      return;
    }

    if (event.key === "backspace") {
      if (queryRef.current.length === 0) {
        close();
      } else {
        queryRef.current = queryRef.current.slice(0, -1);
        activeIndexRef.current = 0;
        forceUpdate();
      }
      return;
    }

    // Printable character — append to query
    if (event.char && !event.ctrl && !event.meta && event.char.length === 1) {
      queryRef.current += event.char;
      activeIndexRef.current = 0;
      forceUpdate();
    }
  }, [trigger, controlledIsOpen, forceUpdate]);

  useInput(handleInput, { isActive, priority: 900 });

  // ── Render: hidden ─────────────────────────────────────────
  if (!effectiveIsOpen) return null;

  // ── Compute scroll window ──────────────────────────────────
  const visibleItems = maxVisible !== undefined && filtered.length > maxVisible
    ? (() => {
        const halfPage = Math.floor(maxVisible / 2);
        let start = Math.max(0, activeIndexRef.current - halfPage);
        start = Math.min(start, filtered.length - maxVisible);
        return { items: filtered.slice(start, start + maxVisible), offset: start };
      })()
    : { items: filtered, offset: 0 };

  // ── Build content ──────────────────────────────────────────
  const contentChildren: React.ReactElement[] = [];

  // Search input row
  const searchChildren: React.ReactElement[] = [
    React.createElement("tui-text", { key: "prompt", color: colors.brand.primary, bold: true }, "> "),
  ];

  if (queryRef.current.length > 0) {
    searchChildren.push(
      React.createElement("tui-text", { key: "query", color: colors.text.primary }, queryRef.current),
    );
  } else {
    searchChildren.push(
      React.createElement("tui-text", { key: "placeholder", color: colors.text.dim, dim: true }, placeholder),
    );
  }

  // Blinking cursor
  searchChildren.push(
    React.createElement("tui-text", { key: "cursor", color: colors.brand.light }, "\u2588"),
  );

  contentChildren.push(
    React.createElement("tui-box", { key: "search", flexDirection: "row" }, ...searchChildren),
  );

  // Divider
  const dividerWidth = Math.max(1, overlayWidth - 2);
  contentChildren.push(
    React.createElement(
      "tui-text",
      { key: "divider", color: colors.divider },
      "\u2500".repeat(dividerWidth),
    ),
  );

  // Result count hint
  if (queryRef.current.length > 0) {
    contentChildren.push(
      React.createElement(
        "tui-text",
        { key: "count", color: colors.text.dim, dim: true },
        `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`,
      ),
    );
  }

  // ── Command list ───────────────────────────────────────────
  if (filtered.length === 0) {
    contentChildren.push(
      React.createElement(
        "tui-box",
        { key: "empty", flexDirection: "column", marginTop: 1 },
        React.createElement("tui-text", { color: colors.text.dim, dim: true }, emptyText),
      ),
    );
  } else {
    const renderedCategories = new Set<string>();
    const itemElements: React.ReactElement[] = [];

    for (let i = 0; i < visibleItems.items.length; i++) {
      const command = visibleItems.items[i]!;
      const globalIndex = i + visibleItems.offset;
      const isActiveItem = globalIndex === activeIndexRef.current;

      // Category header — render once per category
      if (command.category && !renderedCategories.has(command.category)) {
        renderedCategories.add(command.category);
        itemElements.push(
          React.createElement(
            "tui-box",
            { key: `cat-${command.category}`, flexDirection: "column", marginTop: itemElements.length > 0 ? 1 : 0 },
            React.createElement(
              "tui-text",
              { color: colors.text.dim, dim: true, bold: true },
              command.category.toUpperCase(),
            ),
          ),
        );
      }

      // Custom renderer
      if (props.renderItem) {
        itemElements.push(
          React.createElement(
            React.Fragment,
            { key: command.id },
            props.renderItem(command, { isActive: isActiveItem, index: globalIndex }),
          ),
        );
        continue;
      }

      // Default item rendering
      const bgColor = isActiveItem ? colors.surface.highlight : undefined;
      const nameColor = command.disabled
        ? colors.text.disabled
        : isActiveItem
          ? colors.brand.light
          : colors.text.primary;

      const rowChildren: React.ReactElement[] = [];

      // Active indicator
      rowChildren.push(
        React.createElement(
          "tui-text",
          { key: "ptr", color: isActiveItem ? colors.brand.primary : colors.text.dim },
          isActiveItem ? "\u25B6 " : "  ",
        ),
      );

      // Icon
      if (command.icon) {
        rowChildren.push(
          React.createElement(
            "tui-text",
            { key: "icon", color: isActiveItem ? colors.brand.primary : colors.text.secondary },
            command.icon + " ",
          ),
        );
      }

      // Name
      rowChildren.push(
        React.createElement(
          "tui-text",
          { key: "name", color: nameColor, bold: isActiveItem && !command.disabled, dim: command.disabled },
          command.name,
        ),
      );

      // Description
      rowChildren.push(
        React.createElement(
          "tui-text",
          { key: "desc", color: colors.text.dim, dim: true },
          "  " + command.description,
        ),
      );

      // Shortcut hint (right-aligned via flex spacer)
      if (command.shortcut) {
        rowChildren.push(
          React.createElement("tui-box", { key: "spacer", flex: 1 }),
          React.createElement(
            "tui-text",
            { key: "shortcut", color: colors.text.dim, dim: true },
            " " + command.shortcut,
          ),
        );
      }

      itemElements.push(
        React.createElement(
          "tui-box",
          {
            key: command.id,
            flexDirection: "row",
            ...(bgColor !== undefined ? { backgroundColor: bgColor } : {}),
          },
          ...rowChildren,
        ),
      );
    }

    // Scroll indicator (top)
    if (visibleItems.offset > 0) {
      contentChildren.push(
        React.createElement(
          "tui-text",
          { key: "scroll-up", color: colors.text.dim, dim: true },
          "  \u25B2 " + visibleItems.offset + " more above",
        ),
      );
    }

    contentChildren.push(
      React.createElement(
        "tui-box",
        { key: "list", flexDirection: "column" },
        ...itemElements,
      ),
    );

    // Scroll indicator (bottom)
    const hiddenBelow = filtered.length - (visibleItems.offset + visibleItems.items.length);
    if (hiddenBelow > 0) {
      contentChildren.push(
        React.createElement(
          "tui-text",
          { key: "scroll-down", color: colors.text.dim, dim: true },
          "  \u25BC " + hiddenBelow + " more below",
        ),
      );
    }
  }

  // Hint bar
  contentChildren.push(
    React.createElement(
      "tui-box",
      { key: "hints", flexDirection: "row", marginTop: 1 },
      React.createElement("tui-text", { key: "h1", color: colors.text.dim, dim: true }, "\u2191\u2193 navigate"),
      React.createElement("tui-text", { key: "sep1", color: colors.text.disabled }, "  \u2502  "),
      React.createElement("tui-text", { key: "h2", color: colors.text.dim, dim: true }, "\u21B5 select"),
      React.createElement("tui-text", { key: "sep2", color: colors.text.disabled }, "  \u2502  "),
      React.createElement("tui-text", { key: "h3", color: colors.text.dim, dim: true }, "esc close"),
    ),
  );

  // ── Overlay ────────────────────────────────────────────────
  return React.createElement(
    "tui-overlay",
    {
      visible: true,
      position: "top-center",
      borderStyle: personality.borders.panel,
      borderColor: colors.brand.primary,
      padding: 1,
      width: overlayWidth,
      role: "dialog",
      "aria-label": props["aria-label"] ?? "Command Palette",
    },
    React.createElement(
      FocusGroup,
      { id: groupIdRef.current, trap: true, direction: "vertical" },
      React.createElement(
        "tui-box",
        { flexDirection: "column" },
        ...contentChildren,
      ),
    ),
  );
});

export const CommandPalette = Object.assign(CommandPaletteBase, {
  Root: CommandPaletteRoot,
  Input: CommandPaletteInput,
  List: CommandPaletteList,
  Item: CommandPaletteItem,
});
