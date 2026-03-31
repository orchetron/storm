/**
 * ComponentGallery — interactive in-terminal component catalog.
 *
 * A split-pane widget that showcases every Storm component:
 *   Left sidebar:  categorized, scrollable list with keyboard navigation
 *   Right panel:   live description + preview of the selected component
 *
 * Uses imperative mutation + requestRender() for navigation state.
 *
 * @module
 */

import React, { useRef } from "react";
import { useInput } from "../hooks/useInput.js";
import { useTui } from "../context/TuiContext.js";
import { useColors } from "../hooks/useColors.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

// ── Types ────────────────────────────────────────────────────────────

export interface ComponentGalleryProps {
  /** Optional filter for component categories */
  categories?: string[];
  /** Width of the gallery */
  width?: number;
  /** Height of the gallery */
  height?: number;
  /** Whether the gallery captures keyboard input (default true) */
  isFocused?: boolean;
  /** Custom render for category headers */
  renderCategory?: (name: string, isSelected: boolean) => React.ReactNode;
  /** Custom render for gallery items */
  renderItem?: (name: string, isSelected: boolean) => React.ReactNode;
  /** Selection indicator character (default "▸ ") */
  selectionIndicator?: string;
}

// ── Gallery Data ─────────────────────────────────────────────────────

interface GalleryItem {
  name: string;
  description: string;
  preview: string;
}

interface GalleryCategory {
  category: string;
  items: GalleryItem[];
}

const GALLERY_ITEMS: readonly GalleryCategory[] = [
  {
    category: "Core",
    items: [
      {
        name: "Box",
        description: "Flexbox layout container",
        preview:
          "┌─────────────────┐\n│  Box (row)       │\n│ ┌───┐ ┌───┐     │\n│ │ A │ │ B │     │\n│ └───┘ └───┘     │\n└─────────────────┘\nFlexbox with direction, wrap,\nalign, justify, padding, margin.",
      },
      {
        name: "Text",
        description: "Styled text display",
        preview:
          "Normal text\n\x1b[1mBold text\x1b[0m\n\x1b[2mDim text\x1b[0m\n\x1b[3mItalic text\x1b[0m\n\x1b[4mUnderline text\x1b[0m\nSupports color, bold, dim,\nitalic, underline, strikethrough.",
      },
      {
        name: "Spacer",
        description: "Flexible space filler",
        preview:
          "┌─────────────────┐\n│ Left   ···  Right│\n└─────────────────┘\nExpands to fill available space\nin a flex container.",
      },
    ],
  },
  {
    category: "Input",
    items: [
      {
        name: "TextInput",
        description: "Single-line text input with cursor",
        preview: "┌─ Input ─────────┐\n│ Hello world│     │\n└─────────────────┘\nCursor, selection, placeholder.",
      },
      {
        name: "ChatInput",
        description: "Auto-wrapping chat prompt with scroll",
        preview:
          "╭─ ChatInput ─────╮\n│ Type here...     │\n│ Auto-wraps and   │\n│ expands to 4 rows│\n╰─────────────────╯\nEnter sends. Mouse scroll.",
      },
      {
        name: "Button",
        description: "Pressable button with loading state",
        preview: "[ Submit ]  [ Cancel ]\n[ ◠ Loading... ]\nFocusable, press handler, loading.",
      },
      {
        name: "Checkbox",
        description: "Toggle checkbox",
        preview: "[✓] Option A\n[ ] Option B\n[✓] Option C\nToggle with Space key.",
      },
      {
        name: "Switch",
        description: "Toggle switch",
        preview: "Dark mode   [●━━━ ]\nNotify      [ ━━━●]\nBinary on/off toggle.",
      },
      {
        name: "RadioGroup",
        description: "Single-select radio buttons",
        preview: "(●) Small\n( ) Medium\n( ) Large\nSingle selection from group.",
      },
      {
        name: "Select",
        description: "Dropdown select with search",
        preview: "┌─ Language ──────┐\n│ TypeScript     ▾│\n├─────────────────┤\n│ JavaScript      │\n│ TypeScript    ← │\n│ Python          │\n└─────────────────┘",
      },
      {
        name: "SelectionList",
        description: "Multi-select checklist",
        preview: "[✓] React\n[✓] Vue\n[ ] Angular\n[ ] Svelte\nMulti-select with check marks.",
      },
      {
        name: "MaskedInput",
        description: "Formatted input (phone, date)",
        preview: "Phone: (555) 123-4567\nDate:  12/25/2025\nSSN:   ***-**-1234\nAuto-format as you type.",
      },
      {
        name: "SearchInput",
        description: "Search with icon prefix",
        preview: "🔍 Search components...\nIcon prefix, debounced onChange,\nclear button.",
      },
      {
        name: "Form",
        description: "Multi-field form with validation",
        preview:
          "Name:  [John Doe        ]\nEmail: [john@example.com ]\n       ⚠ Invalid email\n[ Submit ]  [ Reset ]\nValidation, focus management.",
      },
      {
        name: "Calendar",
        description: "Month calendar with day selection",
        preview:
          "     March 2026\nMo Tu We Th Fr Sa Su\n                   1\n 2  3  4  5  6  7  8\n 9 10 11 12 13 14 15\n16 17 18 19 20 21 22\n23 24 25 [26] 27 28 29\n30 31",
      },
    ],
  },
  {
    category: "Display",
    items: [
      {
        name: "Badge",
        description: "Colored status label",
        preview: " success   warning   error \nSmall colored labels for status.",
      },
      {
        name: "Alert",
        description: "Boxed attention message",
        preview:
          "┌─ ⚠ Warning ─────────┐\n│ Disk space is low.   │\n│ Free up space soon.  │\n└──────────────────────┘\ninfo, success, warning, error.",
      },
      {
        name: "StatusMessage",
        description: "Inline status with icon",
        preview: "✓ Build succeeded\n⚠ 3 warnings found\n✗ Test failed\nInline icon + colored message.",
      },
      {
        name: "Gradient",
        description: "Text with color gradient",
        preview: "G r a d i e n t   T e x t\nSmooth color transitions across\ntext characters.",
      },
      {
        name: "Digits",
        description: "Large block-character numbers",
        preview:
          "█▀█ ▀█  █▀█\n█▄█  █  █▄█\nLarge 3x3 block digits for\ncountdowns, dashboards.",
      },
      {
        name: "Pretty",
        description: "JSON/object pretty-printer",
        preview: '{\n  "name": "Storm",\n  "version": "1.0",\n  "fast": true\n}\nSyntax-highlighted object display.',
      },
      {
        name: "Avatar",
        description: "User avatar/initials",
        preview: "┌──┐\n│JD│  John Doe\n└──┘\nInitials in a colored circle/box.",
      },
      {
        name: "Tag",
        description: "Colored label chip",
        preview: " typescript   react   storm \nSmall inline labels/chips.",
      },
      {
        name: "Breadcrumb",
        description: "Navigation trail",
        preview: "Home > Settings > Theme\nSeparator-delimited path trail.",
      },
      {
        name: "Card",
        description: "Storm's signature content card",
        preview:
          "╭─ My Card ──────────╮\n│                     │\n│  Card content here   │\n│                     │\n╰─────────────────────╯\nBordered container with title.",
      },
      {
        name: "Shadow",
        description: "Drop shadow wrapper",
        preview: "┌──────────┐\n│  Content │░\n└──────────┘░\n ░░░░░░░░░░░\nAdds shadow chars to any box.",
      },
    ],
  },
  {
    category: "Data",
    items: [
      {
        name: "Table",
        description: "Data table",
        preview:
          "Name       │ Role       │ Lvl\n───────────┼────────────┼────\nAlice      │ Engineer   │  5\nBob        │ Designer   │  3\nHeaders, alignment, borders.",
      },
      {
        name: "DataGrid",
        description: "Sortable data grid",
        preview: "Name  ▲ │ Size  │ Modified\nAlice   │ 1.2K  │ Mar 26\nBob     │ 3.4K  │ Mar 25\nSortable columns, selection.",
      },
      {
        name: "Tree",
        description: "Expandable tree view",
        preview: "▾ src/\n  ▾ components/\n      Box.tsx\n      Text.tsx\n  ▸ hooks/\n    index.ts\nCollapsible nested tree nodes.",
      },
      {
        name: "OrderedList",
        description: "Numbered list with nesting",
        preview: "1. First item\n2. Second item\n   1. Nested item\n3. Third item\nNumbered with nesting support.",
      },
      {
        name: "UnorderedList",
        description: "Bulleted list with nesting",
        preview: "• First item\n• Second item\n  ◦ Nested item\n• Third item\nCustomizable bullet characters.",
      },
      {
        name: "DefinitionList",
        description: "Term-definition pairs",
        preview: "Storm\n  A compositor-based TUI framework\nCell\n  A single character + style\nTerm/definition display.",
      },
      {
        name: "ListView",
        description: "Scrollable item list",
        preview: "  Item 1\n▸ Item 2  ←\n  Item 3\n  Item 4\nScrollable, selectable items.",
      },
      {
        name: "VirtualList",
        description: "Virtualized large list",
        preview:
          "│ Row 1          │ ▲\n│ Row 2          │ █\n│ Row 3          │ █\n│ Row 4          │ ▼\nRenders only visible rows.\nHandles 100K+ items.",
      },
      {
        name: "Sparkline",
        description: "Inline data chart",
        preview: "▁▂▃▅▇█▇▅▃▂▁▂▄▆█\nInline bar chart from data array.\nMin/max/trend at a glance.",
      },
    ],
  },
  {
    category: "Feedback",
    items: [
      {
        name: "Spinner",
        description: "Loading spinner (6 styles incl. Storm)",
        preview: "◐ Loading...     (circle)\n⠋ Processing...  (dots)\n⣾ Building...    (braille)\n▁ Rendering...   (storm)\n6 animation styles.",
      },
      {
        name: "ProgressBar",
        description: "Progress indicator",
        preview: "████████░░░░░░░░ 50%\n████████████████ 100%\nLabel, percentage, color.",
      },
      {
        name: "GradientProgress",
        description: "Gradient progress bar",
        preview: "█████████░░░░░░░ 60%\nColor gradient from start to end.\nSmooth multi-color transition.",
      },
      {
        name: "Gauge",
        description: "Block-character gauge",
        preview: "CPU [████████▒▒] 80%\nMEM [██▒▒▒▒▒▒▒▒] 20%\nBlock-level precision gauge.",
      },
      {
        name: "Toast",
        description: "Auto-hide notification",
        preview: "╭─ ✓ Success ─────────╮\n│ File saved.          │\n╰──────────────────────╯\nAuto-dismisses after timeout.",
      },
      {
        name: "Timer",
        description: "Countdown timer",
        preview: "⏱ 02:30\n⏱ 00:05 ← warning color\n⏱ 00:00 ← expired!\nCountdown with color thresholds.",
      },
      {
        name: "Stopwatch",
        description: "Count-up timer",
        preview: "⏱ 00:00:15.3\nCounts up from zero.\nStart, stop, reset, lap.",
      },
    ],
  },
  {
    category: "Layout",
    items: [
      {
        name: "ScrollView",
        description: "Scrollable container",
        preview:
          "┌─────────────────┐\n│ Line 1           │ ▲\n│ Line 2           │ █\n│ Line 3           │ █\n│ Line 4           │ ▼\n└─────────────────┘\nVertical/horizontal scrolling.",
      },
      {
        name: "Tabs",
        description: "Tab navigation",
        preview:
          "┌─ Files ─┬─ Search ─┬─ Git ─┐\n│                              │\n│  Tab content here            │\n│                              │\n└──────────────────────────────┘\nKeyboard tab switching.",
      },
      {
        name: "TabbedContent",
        description: "Tabbed content panels",
        preview: "[ Overview | Details | Logs ]\n─────────────────────────────\nContent for selected tab.\nTab bar + content in one widget.",
      },
      {
        name: "Accordion",
        description: "Collapsible sections",
        preview: "▾ Section 1\n  Content for section 1\n▸ Section 2 (collapsed)\n▸ Section 3 (collapsed)\nExpand one or many sections.",
      },
      {
        name: "Modal",
        description: "Dialog overlay",
        preview:
          "╭─ Confirm ───────────╮\n│                      │\n│ Delete this file?    │\n│                      │\n│ [ Yes ]    [ No ]    │\n╰──────────────────────╯\nCentered overlay dialog.",
      },
      {
        name: "Overlay",
        description: "Positioned overlay",
        preview: "Content below\n   ┌────────┐\n   │Floating│\n   └────────┘\nAbsolute-positioned layer\non top of other content.",
      },
      {
        name: "Collapsible",
        description: "Expandable section",
        preview: "▾ Details\n  Hidden content revealed\n  when section is expanded.\n▸ More (collapsed)\nToggle visibility of content.",
      },
      {
        name: "ContentSwitcher",
        description: "View switcher",
        preview: "[ Grid ] | List | Cards\n┌──┐┌──┐┌──┐\n│  ││  ││  │\n└──┘└──┘└──┘\nSwitch between content views.",
      },
      {
        name: "Tooltip",
        description: "Hover tooltip",
        preview:
          '       ┌─────────────┐\n       │ "Click to    │\n       │  save file"  │\n       └──────┬───────┘\n         [ Save ]\nContextual help on focus/hover.',
      },
      {
        name: "RevealTransition",
        description: "Appear animation",
        preview: "Frame 1: ░░░░░░░░░\nFrame 2: ████░░░░░\nFrame 3: █████████\nAnimated content reveal\n(slide, fade, expand).",
      },
    ],
  },
  {
    category: "Navigation",
    items: [
      {
        name: "Menu",
        description: "Vertical menu with shortcuts",
        preview: "  New File       ⌘N\n▸ Open File      ⌘O\n  Save           ⌘S\n  ─────────────────\n  Quit           ⌘Q\nKeyboard shortcuts, dividers.",
      },
      {
        name: "Stepper",
        description: "Step wizard progress",
        preview:
          "● Setup ─── ● Config ─── ○ Review ─── ○ Done\nStep 2 of 4: Config\nWizard-style step indicator.",
      },
      {
        name: "Paginator",
        description: "Page navigation",
        preview: "← 1 2 [3] 4 5 →\nPage 3 of 5 (20 items/page)\nPrevious/next page controls.",
      },
      {
        name: "KeyboardHelp",
        description: "Keybinding help bar",
        preview:
          "↑↓ Navigate  ⏎ Select  ⇥ Switch  q Quit\nBottom bar showing active\nkeybindings for current context.",
      },
      {
        name: "Header",
        description: "App header",
        preview: "╭──────────────────────────╮\n│  ⚡ Storm TUI  v1.0     │\n╰──────────────────────────╯\nApp title bar with branding.",
      },
      {
        name: "Footer",
        description: "App footer",
        preview:
          "──────────────────────────\n Ready │ Ln 42, Col 8 │ TS\nStatus bar with segments.",
      },
    ],
  },
  {
    category: "AI-Native",
    items: [
      {
        name: "TokenStream",
        description: "Live token streaming status",
        preview:
          "model-v2 │ In: 1.2K │ Out: 456 │ 42 t/s\n████████░░░░░░░░ 3.2K / 8K\nReal-time token count + speed.",
      },
      {
        name: "ContextWindow",
        description: "Context usage visualization",
        preview:
          "Context: ████████░░ 80%\nSystem: 1.2K  User: 3.4K  Asst: 2.1K\nVisualizes token budget usage.",
      },
      {
        name: "CostTracker",
        description: "LLM cost accumulator",
        preview:
          "Session: $0.42  │  Total: $12.38\nIn: $0.12 (1.2K) Out: $0.30 (456)\nTracks and displays API costs.",
      },
      {
        name: "ModelBadge",
        description: "Model identity badge",
        preview: " qwen-2.5-72b  │  command-r-plus \nColored badge showing model name\nand provider.",
      },
      {
        name: "CommandBlock",
        description: "Collapsible command block",
        preview:
          "▾ $ npm test              ✓\n│ PASS src/index.test.ts\n│ 42 tests passed\n│ Duration: 1.2s\nCollapsible command + output.",
      },
      {
        name: "PerformanceHUD",
        description: "Performance metrics overlay",
        preview:
          "┌─ Storm HUD ─────┐\n│ FPS: 60  RT: 2ms │\n│ Cells: 1.2K/4.8K │\n│ Mem: 24.3 MB     │\n└──────────────────┘\nReal-time rendering metrics.",
      },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

/** Flatten categories into a list of (categoryIndex, itemIndex) pairs. */
function buildFlatIndex(
  categories: readonly GalleryCategory[],
): Array<{ catIdx: number; itemIdx: number }> {
  const flat: Array<{ catIdx: number; itemIdx: number }> = [];
  for (let ci = 0; ci < categories.length; ci++) {
    const cat = categories[ci]!;
    for (let ii = 0; ii < cat.items.length; ii++) {
      flat.push({ catIdx: ci, itemIdx: ii });
    }
  }
  return flat;
}

// ── Component ────────────────────────────────────────────────────────

export const ComponentGallery = React.memo(function ComponentGallery(
  rawProps: ComponentGalleryProps,
): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("ComponentGallery", rawProps as unknown as Record<string, unknown>) as unknown as ComponentGalleryProps;
  const { categories: filterCategories, width = 80, height = 30, isFocused, renderCategory, renderItem, selectionIndicator = "\u25B8 " } = props;

  const { requestRender } = useTui();
  const requestRenderRef = useRef(requestRender);
  requestRenderRef.current = requestRender;

  // Filter categories if specified
  const filteredCategories =
    filterCategories && filterCategories.length > 0
      ? GALLERY_ITEMS.filter((c) => filterCategories.includes(c.category))
      : GALLERY_ITEMS;

  const flatIndex = buildFlatIndex(filteredCategories);
  const totalItems = flatIndex.length;

  // Imperative state via refs
  const selectedRef = useRef(0);
  const focusPaneRef = useRef<"sidebar" | "preview">("sidebar");
  const scrollOffsetRef = useRef(0);

  // Navigation
  useInput((event: import("../input/types.js").KeyEvent) => {
    if (event.key === "tab") {
      focusPaneRef.current =
        focusPaneRef.current === "sidebar" ? "preview" : "sidebar";
      requestRenderRef.current();
      return;
    }

    if (focusPaneRef.current !== "sidebar") return;

    if (event.key === "up") {
      if (selectedRef.current > 0) {
        selectedRef.current--;
        // Adjust scroll offset if needed
        const sidebarHeight = height - 4; // borders + header + footer
        if (selectedRef.current < scrollOffsetRef.current) {
          scrollOffsetRef.current = selectedRef.current;
        }
        requestRenderRef.current();
      }
      return;
    }

    if (event.key === "down") {
      if (selectedRef.current < totalItems - 1) {
        selectedRef.current++;
        // Adjust scroll offset if needed
        const sidebarHeight = height - 4;
        // Account for category headers in visible height
        const visibleEnd = scrollOffsetRef.current + sidebarHeight;
        if (selectedRef.current >= visibleEnd) {
          scrollOffsetRef.current = selectedRef.current - sidebarHeight + 1;
        }
        requestRenderRef.current();
      }
      return;
    }
  }, { isActive: isFocused !== false });

  // ── Build sidebar lines ────────────────────────────────────────────

  const sidebarWidth = Math.max(24, Math.floor(width * 0.35));
  const previewWidth = width - sidebarWidth - 3; // 3 for separator

  const sidebarLines: React.ReactElement[] = [];
  let flatIdx = 0;

  for (let ci = 0; ci < filteredCategories.length; ci++) {
    const cat = filteredCategories[ci]!;

    // Category header
    const isCatSelected = selectedRef.current >= flatIdx && selectedRef.current < flatIdx + cat.items.length;
    sidebarLines.push(
      React.createElement(
        "tui-box",
        { key: `cat-${ci}`, flexDirection: "row" },
        renderCategory
          ? React.createElement(React.Fragment, null, renderCategory(cat.category, isCatSelected))
          : React.createElement(
              "tui-text",
              { bold: true, color: colors.brand.primary },
              ci === 0 ? cat.category : `\n${cat.category}`,
            ),
      ),
    );

    // Items in this category
    for (let ii = 0; ii < cat.items.length; ii++) {
      const item = cat.items[ii]!;
      const isSelected = flatIdx === selectedRef.current;
      const isSidebarFocused = focusPaneRef.current === "sidebar";
      const indicator = isSelected ? selectionIndicator : " ".repeat(selectionIndicator.length);
      const itemColor =
        isSelected && isSidebarFocused
          ? colors.brand.light
          : isSelected
            ? colors.text.primary
            : colors.text.secondary;

      sidebarLines.push(
        React.createElement(
          "tui-box",
          { key: `item-${ci}-${ii}`, flexDirection: "row" },
          renderItem
            ? React.createElement(React.Fragment, null, renderItem(item.name, isSelected))
            : React.createElement(
                React.Fragment,
                null,
                React.createElement(
                  "tui-text",
                  {
                    color: isSelected && isSidebarFocused
                      ? colors.brand.primary
                      : colors.text.dim,
                  },
                  indicator,
                ),
                React.createElement(
                  "tui-text",
                  {
                    color: itemColor,
                    bold: isSelected,
                  },
                  item.name,
                ),
              ),
        ),
      );
      flatIdx++;
    }
  }

  // ── Build preview panel ────────────────────────────────────────────

  const selectedEntry = flatIndex[selectedRef.current];
  const selectedCat = selectedEntry
    ? filteredCategories[selectedEntry.catIdx]
    : undefined;
  const selectedItem = selectedEntry && selectedCat
    ? selectedCat.items[selectedEntry.itemIdx]
    : undefined;
  const selectedCategory = selectedCat
    ? selectedCat.category
    : "";

  const previewLines: React.ReactElement[] = [];

  if (selectedItem) {
    // Component name
    previewLines.push(
      React.createElement(
        "tui-text",
        { key: "p-name", bold: true, color: colors.brand.light },
        selectedItem.name,
      ),
    );

    // Category
    previewLines.push(
      React.createElement(
        "tui-text",
        { key: "p-cat", color: colors.text.dim },
        `Category: ${selectedCategory}`,
      ),
    );

    // Description
    previewLines.push(
      React.createElement(
        "tui-text",
        { key: "p-desc", color: colors.text.secondary },
        `\n${selectedItem.description}`,
      ),
    );

    // Separator
    previewLines.push(
      React.createElement(
        "tui-text",
        { key: "p-sep", color: colors.divider },
        "\n" + "─".repeat(Math.min(previewWidth, 40)),
      ),
    );

    // Preview
    previewLines.push(
      React.createElement(
        "tui-text",
        { key: "p-preview", color: colors.text.primary },
        `\n${selectedItem.preview}`,
      ),
    );
  }

  // ── Build help bar ─────────────────────────────────────────────────

  const isSidebar = focusPaneRef.current === "sidebar";
  const helpText = isSidebar
    ? "↑↓ Navigate  ⇥ Switch pane  q Quit"
    : "⇥ Switch pane  q Quit";

  const helpBar = React.createElement(
    "tui-text",
    { key: "help", dim: true, color: colors.text.dim },
    helpText,
  );

  // ── Title ──────────────────────────────────────────────────────────

  const title = React.createElement(
    "tui-box",
    { key: "title", flexDirection: "row" },
    React.createElement(
      "tui-text",
      { bold: true, color: colors.brand.primary },
      "⚡ Storm Component Gallery",
    ),
    React.createElement(
      "tui-text",
      { color: colors.text.dim },
      `  (${totalItems} components)`,
    ),
  );

  // ── Separator ──────────────────────────────────────────────────────

  const separator = React.createElement(
    "tui-text",
    { key: "sep", color: colors.divider },
    "─".repeat(width),
  );

  // ── Assemble layout ────────────────────────────────────────────────

  // Slice sidebar lines based on scroll offset and available height
  const sidebarHeight = height - 4; // borders + header + footer
  const visibleSidebarLines = sidebarLines.slice(
    scrollOffsetRef.current,
    scrollOffsetRef.current + sidebarHeight,
  );

  const sidebarPane = React.createElement(
    "tui-box",
    {
      key: "sidebar",
      flexDirection: "column",
      width: sidebarWidth,
      borderStyle: isSidebar ? "round" : "single",
      borderColor: isSidebar ? colors.brand.primary : colors.text.dim,
      paddingLeft: 1,
      paddingRight: 1,
    },
    ...visibleSidebarLines,
  );

  const previewPane = React.createElement(
    "tui-box",
    {
      key: "preview",
      flexDirection: "column",
      width: previewWidth,
      borderStyle: !isSidebar ? "round" : "single",
      borderColor: !isSidebar ? colors.brand.primary : colors.text.dim,
      paddingLeft: 1,
      paddingRight: 1,
    },
    ...previewLines,
  );

  const mainRow = React.createElement(
    "tui-box",
    { key: "main", flexDirection: "row", height: height - 4 },
    sidebarPane,
    previewPane,
  );

  return React.createElement(
    "tui-box",
    {
      flexDirection: "column",
      width,
      height,
    },
    title,
    separator,
    mainRow,
    helpBar,
  );
});
