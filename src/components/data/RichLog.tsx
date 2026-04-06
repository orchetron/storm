import React, { useRef, createContext, useContext } from "react";
import { useInput } from "../../hooks/useInput.js";
import { useTui } from "../../context/TuiContext.js";
import { useColors } from "../../hooks/useColors.js";
import type { StormColors } from "../../theme/colors.js";
import type { KeyEvent } from "../../input/types.js";
import type { StormContainerStyleProps } from "../../styles/styleProps.js";
import { mergeBoxStyles, pickStyleProps } from "../../styles/applyStyles.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { renderHighlightedText } from "../../utils/highlight.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Numeric severity for level comparison. Higher = more severe. */
const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Prefix indicator for each level. */
const LEVEL_PREFIX: Record<LogLevel, string> = {
  debug: "D",
  info: "I",
  warn: "W",
  error: "E",
};

/** Color for each level. */
function getLevelColors(colors: StormColors): Record<LogLevel, string | number | undefined> {
  return {
    debug: undefined, // dim
    info: undefined,  // default
    warn: colors.warning,
    error: colors.error,
  };
}

export interface LogEntry {
  text: string;
  color?: string | number;
  dim?: boolean;
  bold?: boolean;
  timestamp?: string;
  /** Log level for filtering and color coding. */
  level?: LogLevel;
}

export interface RichLogProps extends StormContainerStyleProps {
  entries: readonly LogEntry[];
  maxVisible?: number;
  autoScroll?: boolean;
  showTimestamp?: boolean;
  timestampColor?: string | number;
  isFocused?: boolean;
  /** Only show entries at or above this level. */
  filterLevel?: LogLevel;
  /** When provided, highlights matching text in log entries and enables Ctrl+N/Ctrl+P navigation. */
  searchQuery?: string;
  /** Custom render for each log entry. */
  renderEntry?: (entry: LogEntry, state: { isMatch: boolean }) => React.ReactNode;
}

export interface RichLogContextValue {
  scrollOffset: number;
  setScrollOffset: (offset: number) => void;
  filterLevel: LogLevel | undefined;
  searchQuery: string | undefined;
}

export const RichLogContext = createContext<RichLogContextValue | null>(null);

export function useRichLogContext(): RichLogContextValue {
  const ctx = useContext(RichLogContext);
  if (!ctx) throw new Error("RichLog sub-components must be used inside RichLog.Root");
  return ctx;
}

export interface RichLogRootProps {
  scrollOffset?: number;
  onScrollChange?: (offset: number) => void;
  filterLevel?: LogLevel;
  searchQuery?: string;
  children: React.ReactNode;
}

function RichLogRoot({
  scrollOffset = 0,
  onScrollChange,
  filterLevel,
  searchQuery,
  children,
}: RichLogRootProps): React.ReactElement {
  const colors = useColors();
  const { requestRender } = useTui();
  const onScrollRef = useRef(onScrollChange);
  onScrollRef.current = onScrollChange;

  const ctx: RichLogContextValue = {
    scrollOffset,
    setScrollOffset: (o: number) => { onScrollRef.current?.(o); requestRender(); },
    filterLevel,
    searchQuery,
  };

  return React.createElement(
    RichLogContext.Provider,
    { value: ctx },
    React.createElement("tui-box", { flexDirection: "column" }, children),
  );
}

export interface RichLogCompoundEntryProps {
  entry: LogEntry;
  index?: number;
  children?: React.ReactNode;
}

function RichLogCompoundEntry({ entry, index, children }: RichLogCompoundEntryProps): React.ReactElement {
  const colors = useColors();
  const levelColors = getLevelColors(colors);
  if (children) {
    return React.createElement("tui-box", { flexDirection: "row" }, children);
  }

  const parts: React.ReactElement[] = [];

  if (entry.level) {
    const levelColor = levelColors[entry.level];
    const levelPrefix = LEVEL_PREFIX[entry.level];
    const levelProps: Record<string, unknown> = { key: "lvl", bold: true };
    if (levelColor !== undefined) levelProps["color"] = levelColor;
    if (entry.level === "debug") levelProps["dim"] = true;
    parts.push(React.createElement("tui-text", levelProps, `${levelPrefix} `));
  }

  if (entry.timestamp !== undefined) {
    parts.push(
      React.createElement("tui-text", { key: "ts", color: colors.text.dim, dim: true }, `${entry.timestamp}  `),
    );
  }

  const textProps: Record<string, unknown> = { key: "txt" };
  if (entry.color !== undefined) textProps["color"] = entry.color;
  else if (entry.level) {
    const lc = levelColors[entry.level];
    if (lc !== undefined) textProps["color"] = lc;
  }
  if (entry.dim === true || entry.level === "debug") textProps["dim"] = true;
  if (entry.bold === true) textProps["bold"] = true;

  parts.push(React.createElement("tui-text", textProps, entry.text));

  return React.createElement("tui-box", { flexDirection: "row" }, ...parts);
}

interface SearchMatch {
  entryIndex: number; // index in filteredEntries
}

function findMatches(entries: readonly LogEntry[], query: string): SearchMatch[] {
  if (!query) return [];
  const lower = query.toLowerCase();
  const matches: SearchMatch[] = [];
  for (let i = 0; i < entries.length; i++) {
    if (entries[i]!.text.toLowerCase().includes(lower)) {
      matches.push({ entryIndex: i });
    }
  }
  return matches;
}

// renderHighlightedText is now imported from ../utils/highlight.js

const RichLogBase = React.memo(function RichLog(rawProps: RichLogProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("RichLog", rawProps);
  const {
    entries,
    maxVisible = 10,
    autoScroll = true,
    showTimestamp = false,
    timestampColor: timestampColorProp,
    isFocused = true,
    filterLevel,
    searchQuery,
  } = props;

  const timestampColor = timestampColorProp ?? colors.text.dim;
  const levelColors = getLevelColors(colors);
  const userStyles = pickStyleProps(props);
  const { requestRender } = useTui();

  const filteredEntries = filterLevel
    ? entries.filter((entry) => {
        if (!entry.level) return true; // entries without level always pass
        return LEVEL_SEVERITY[entry.level] >= LEVEL_SEVERITY[filterLevel];
      })
    : entries;

  if (filteredEntries.length === 0) {
    return React.createElement(
      "tui-text",
      { color: colors.text.dim, dim: true },
      filterLevel ? `No entries at level \u2265 ${filterLevel}` : "No entries",
    );
  }

  const scrollOffsetRef = useRef(0);
  const prevLengthRef = useRef(filteredEntries.length);
  const currentMatchRef = useRef(0);

  // Search matches
  const matches = searchQuery ? findMatches(filteredEntries, searchQuery) : [];
  const matchEntryIndices = new Set(matches.map((m) => m.entryIndex));

  // Clamp current match index
  if (matches.length > 0 && currentMatchRef.current >= matches.length) {
    currentMatchRef.current = 0;
  }

  // Auto-scroll when new entries are appended
  if (autoScroll && filteredEntries.length > prevLengthRef.current) {
    const maxOffset = Math.max(0, filteredEntries.length - maxVisible);
    scrollOffsetRef.current = maxOffset;
  }
  prevLengthRef.current = filteredEntries.length;

  // Clamp scroll offset
  const maxOffset = Math.max(0, filteredEntries.length - maxVisible);
  if (scrollOffsetRef.current > maxOffset) {
    scrollOffsetRef.current = maxOffset;
  }
  if (scrollOffsetRef.current < 0) {
    scrollOffsetRef.current = 0;
  }

  const handleInput = React.useCallback(
    (event: KeyEvent) => {
      const max = Math.max(0, filteredEntries.length - maxVisible);
      const prev = scrollOffsetRef.current;

      // Ctrl+N / Ctrl+P for search match navigation
      if (searchQuery && matches.length > 0) {
        if (event.key === "n" && event.ctrl) {
          currentMatchRef.current = (currentMatchRef.current + 1) % matches.length;
          // Scroll to make current match visible
          const matchIdx = matches[currentMatchRef.current]!.entryIndex;
          if (matchIdx < scrollOffsetRef.current) {
            scrollOffsetRef.current = matchIdx;
          } else if (matchIdx >= scrollOffsetRef.current + maxVisible) {
            scrollOffsetRef.current = Math.min(max, matchIdx - Math.floor(maxVisible / 2));
          }
          requestRender();
          return;
        }
        if (event.key === "p" && event.ctrl) {
          currentMatchRef.current = (currentMatchRef.current - 1 + matches.length) % matches.length;
          const matchIdx = matches[currentMatchRef.current]!.entryIndex;
          if (matchIdx < scrollOffsetRef.current) {
            scrollOffsetRef.current = matchIdx;
          } else if (matchIdx >= scrollOffsetRef.current + maxVisible) {
            scrollOffsetRef.current = Math.min(max, matchIdx - Math.floor(maxVisible / 2));
          }
          requestRender();
          return;
        }
      }

      if (event.key === "up") {
        scrollOffsetRef.current = Math.max(0, scrollOffsetRef.current - 1);
      } else if (event.key === "down") {
        scrollOffsetRef.current = Math.min(max, scrollOffsetRef.current + 1);
      } else if (event.key === "pageup") {
        scrollOffsetRef.current = Math.max(0, scrollOffsetRef.current - maxVisible);
      } else if (event.key === "pagedown") {
        scrollOffsetRef.current = Math.min(max, scrollOffsetRef.current + maxVisible);
      } else if (event.key === "home") {
        scrollOffsetRef.current = 0;
      } else if (event.key === "end") {
        scrollOffsetRef.current = max;
      }
      if (scrollOffsetRef.current !== prev) {
        requestRender();
      }
    },
    [filteredEntries.length, maxVisible, requestRender, searchQuery, matches],
  );

  useInput(handleInput, { isActive: isFocused });

  const start = scrollOffsetRef.current;
  const end = Math.min(filteredEntries.length, start + maxVisible);
  const visibleEntries = filteredEntries.slice(start, end);

  // Current match entry index for highlighting the "active" match
  const currentMatchEntryIdx = matches.length > 0
    ? matches[currentMatchRef.current]?.entryIndex ?? -1
    : -1;

  const rows: React.ReactElement[] = [];
  for (let i = 0; i < visibleEntries.length; i++) {
    const entry = visibleEntries[i]!;
    const globalIdx = start + i; // index in filteredEntries

    if (props.renderEntry) {
      const isMatch = searchQuery ? matchEntryIndices.has(globalIdx) : false;
      rows.push(
        React.createElement(
          "tui-box",
          { key: `log-${globalIdx}`, flexDirection: "row" },
          props.renderEntry(entry, { isMatch }),
        ),
      );
      continue;
    }

    const children: React.ReactElement[] = [];

    // Level prefix indicator
    if (entry.level) {
      const levelColor = levelColors[entry.level];
      const levelPrefix = LEVEL_PREFIX[entry.level];
      const levelProps: Record<string, unknown> = { key: "lvl" };
      if (levelColor !== undefined) {
        levelProps["color"] = levelColor;
      }
      if (entry.level === "debug") {
        levelProps["dim"] = true;
      }
      levelProps["bold"] = true;
      children.push(
        React.createElement("tui-text", levelProps, `${levelPrefix} `),
      );
    }

    // Timestamp column
    if (showTimestamp && entry.timestamp !== undefined) {
      children.push(
        React.createElement(
          "tui-text",
          { key: "ts", color: timestampColor, dim: true },
          `${entry.timestamp}  `,
        ),
      );
    }

    // Entry text — apply level-based coloring if no explicit color
    const textProps: Record<string, unknown> = {};
    if (entry.color !== undefined) {
      textProps["color"] = entry.color;
    } else if (entry.level) {
      const levelColor = levelColors[entry.level];
      if (levelColor !== undefined) {
        textProps["color"] = levelColor;
      }
    }
    if (entry.dim === true || entry.level === "debug") {
      textProps["dim"] = true;
    }
    if (entry.bold === true) textProps["bold"] = true;

    if (searchQuery && matchEntryIndices.has(globalIdx)) {
      const isCurrentMatchEntry = globalIdx === currentMatchEntryIdx;
      const highlightedParts = renderHighlightedText(
        entry.text, searchQuery, textProps, globalIdx,
        isCurrentMatchEntry ? { color: colors.brand.primary } : undefined,
      );
      children.push(...highlightedParts);
    } else {
      children.push(
        React.createElement("tui-text", { ...textProps, key: "txt" }, entry.text),
      );
    }

    rows.push(
      React.createElement(
        "tui-box",
        { key: `log-${globalIdx}`, flexDirection: "row" },
        ...children,
      ),
    );
  }

  // Search indicator
  if (searchQuery) {
    const matchInfo = matches.length > 0
      ? `${currentMatchRef.current + 1}/${matches.length} matches`
      : "No matches";
    rows.push(
      React.createElement(
        "tui-text",
        { key: "__search-indicator", color: colors.brand.primary, dim: true },
        `Search: "${searchQuery}" \u2014 ${matchInfo}  (Ctrl+N/Ctrl+P to navigate)`,
      ),
    );
  }

  // Level filter indicator
  if (filterLevel) {
    rows.push(
      React.createElement(
        "tui-text",
        { key: "__filter-indicator", color: colors.text.dim, dim: true },
        `Filter: \u2265 ${filterLevel} (${filteredEntries.length}/${entries.length} entries)`,
      ),
    );
  }

  const boxProps = mergeBoxStyles(
    { flexDirection: "column", role: "log" },
    userStyles,
  );

  return React.createElement(
    "tui-box",
    boxProps,
    ...rows,
  );
});

export const RichLog = Object.assign(RichLogBase, {
  Root: RichLogRoot,
  Entry: RichLogCompoundEntry,
});
