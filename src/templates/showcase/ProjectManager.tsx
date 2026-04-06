import React, { useState, useRef } from "react";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { TabbedContent } from "../../components/extras/TabbedContent.js";
import { Badge } from "../../components/extras/Badge.js";
import { Tag } from "../../components/extras/Tag.js";
import { Avatar } from "../../components/extras/Avatar.js";
import { Stepper } from "../../components/extras/Stepper.js";
import { GradientProgress } from "../../components/effects/GradientProgress.js";

import { Switch } from "../../components/core/Switch.js";
import { Form } from "../../components/extras/Form.js";
import { Gradient } from "../../components/effects/Gradient.js";
import { KeyboardHelp } from "../../components/extras/KeyboardHelp.js";
import { useTerminal } from "../../hooks/useTerminal.js";
import { useColors } from "../../hooks/useColors.js";

export interface ProjectManagerProps {
  projectName?: string;
}

// C color aliases are set inside the component via useColors()

interface CardData { id: string; title: string; priority: "High" | "Medium" | "Low"; assignee: string }
type ColName = "BACKLOG" | "TODO" | "IN PROGRESS" | "DONE";

const INIT_COLS: Record<ColName, CardData[]> = {
  BACKLOG: [
    { id: "b1", title: "Design system audit", priority: "Low", assignee: "AK" },
    { id: "b2", title: "API rate limiter", priority: "High", assignee: "MJ" },
    { id: "b3", title: "Dark mode support", priority: "Medium", assignee: "LS" },
  ],
  TODO: [
    { id: "t1", title: "Auth flow refactor", priority: "High", assignee: "RD" },
    { id: "t2", title: "Cache invalidation", priority: "Medium", assignee: "AK" },
  ],
  "IN PROGRESS": [
    { id: "i1", title: "WebSocket transport", priority: "High", assignee: "MJ" },
    { id: "i2", title: "Unit test coverage", priority: "Low", assignee: "LS" },
  ],
  DONE: [
    { id: "d1", title: "CI pipeline setup", priority: "Medium", assignee: "RD" },
    { id: "d2", title: "Lint config", priority: "Low", assignee: "AK" },
    { id: "d3", title: "README overhaul", priority: "Low", assignee: "MJ" },
  ],
};

const COL_KEYS: ColName[] = ["BACKLOG", "TODO", "IN PROGRESS", "DONE"];
const TAB_DEFS = [{ label: "Board", key: "board" }, { label: "Timeline", key: "timeline" }, { label: "Settings", key: "settings" }];
const STEPS = [{ label: "Planning" }, { label: "Development" }, { label: "Testing" }, { label: "Launch" }];
const TASKS = [
  { name: "Core engine", pct: 85 }, { name: "API layer", pct: 62 },
  { name: "Test suite", pct: 40 }, { name: "Documentation", pct: 25 }, { name: "Deployment", pct: 10 },
];
const FORM_FIELDS = [
  { key: "name", label: "Project Name", type: "text" as const },
  { key: "desc", label: "Description", type: "text" as const },
  { key: "priority", label: "Priority", type: "text" as const, placeholder: "high / medium / low" },
];

// PRIO_COLOR is set inside the component via useColors()

/** Column header labels — abbreviate "IN PROGRESS" for narrow terminals. */
function colLabel(name: ColName, colWidth: number): string {
  if (name === "IN PROGRESS" && colWidth < 16) return "IN PROG";
  return name;
}

export function ProjectManager(props: ProjectManagerProps): React.ReactElement {
  const colors = useColors();
  const C = { primary: colors.brand.primary, accent: colors.brand.glow, warn: colors.warning, crit: colors.error, info: colors.info };
  const PRIO_COLOR: Record<string, string> = { High: colors.error, Medium: colors.warning, Low: colors.success };
  const { projectName = "Storm v2.0" } = props;
  const { exit, flushSync } = useTui();
  const { width, height } = useTerminal();

  const [activeTab, setActiveTab] = useState("board");
  const [columns, setColumns] = useState(INIT_COLS);
  const [selCol, setSelCol] = useState(0);
  const [selCard, setSelCard] = useState(0);
  const [notifs, setNotifs] = useState(true);
  const [autoAssign, setAutoAssign] = useState(false);

  const stateRef = useRef({ activeTab, selCol, selCard, columns });
  stateRef.current = { activeTab, selCol, selCard, columns };

  useInput((ev) => {
    const s = stateRef.current;
    if (ev.char === "q") { exit(); return; }

    // Tab / Shift+Tab: switch tabs (works on every tab)
    if (ev.key === "tab") {
      const curIdx = TAB_DEFS.findIndex((t) => t.key === s.activeTab);
      if (ev.shift) {
        const prev = curIdx > 0 ? curIdx - 1 : TAB_DEFS.length - 1;
        flushSync(() => setActiveTab(TAB_DEFS[prev]!.key));
      } else {
        const next = curIdx < TAB_DEFS.length - 1 ? curIdx + 1 : 0;
        flushSync(() => setActiveTab(TAB_DEFS[next]!.key));
      }
      return;
    }

    // Board-only bindings: arrows + m
    if (s.activeTab === "board") {
      if (ev.key === "left") {
        const newCol = Math.max(0, s.selCol - 1);
        const col = COL_KEYS[newCol]!;
        const maxCard = Math.max(0, s.columns[col].length - 1);
        flushSync(() => { setSelCol(newCol); setSelCard(Math.min(s.selCard, maxCard)); });
      } else if (ev.key === "right") {
        const newCol = Math.min(3, s.selCol + 1);
        const col = COL_KEYS[newCol]!;
        const maxCard = Math.max(0, s.columns[col].length - 1);
        flushSync(() => { setSelCol(newCol); setSelCard(Math.min(s.selCard, maxCard)); });
      } else if (ev.key === "up") {
        flushSync(() => { setSelCard(Math.max(0, s.selCard - 1)); });
      } else if (ev.key === "down") {
        const col = COL_KEYS[s.selCol]!;
        flushSync(() => { setSelCard(Math.min(Math.max(0, s.columns[col].length - 1), s.selCard + 1)); });
      } else if (ev.char === "m" && s.selCol < 3) {
        flushSync(() => {
          const fromKey = COL_KEYS[s.selCol]!;
          const toKey = COL_KEYS[s.selCol + 1]!;
          const next = { ...s.columns };
          const fromArr = [...next[fromKey]];
          const card = fromArr[s.selCard];
          if (!card) return;
          fromArr.splice(s.selCard, 1);
          next[fromKey] = fromArr;
          next[toKey] = [...next[toKey], card];
          setColumns(next as typeof INIT_COLS);
          setSelCard(Math.max(0, Math.min(s.selCard, fromArr.length - 1)));
        });
      }
    }
  });

  const colWidth = Math.floor((width - 3) / 4);

  // --- Board view ---
  function renderBoard(): React.ReactElement {
    const titleMaxLen = Math.max(1, colWidth - 4);

    const colElements = COL_KEYS.map((colName, ci) => {
      const cards = columns[colName];
      const cardEls = cards.map((card, idx) => {
        const isActive = ci === selCol && idx === selCard;
        const displayTitle = card.title.length > titleMaxLen
          ? card.title.slice(0, titleMaxLen - 3) + "..."
          : card.title;
        return React.createElement("tui-box", {
          key: card.id, borderStyle: "single",
          borderColor: isActive ? C.primary : undefined, marginBottom: 1,
        },
          React.createElement("tui-text", { key: "t", bold: true, color: isActive ? C.primary : undefined }, ` ${displayTitle}`),
          React.createElement("tui-box", { key: "r", flexDirection: "row" },
            React.createElement(Tag, { key: "tag", label: card.priority, color: PRIO_COLOR[card.priority] ?? C.primary }),
            React.createElement("tui-text", { key: "sp" }, "  "),
            React.createElement(Avatar, { key: "av", name: card.assignee, color: C.info }),
          ),
        );
      });

      return React.createElement("tui-box", {
        key: colName, width: colWidth, borderStyle: "round", marginRight: ci < 3 ? 1 : 0,
      },
        React.createElement("tui-box", { key: "hdr", flexDirection: "row" },
          React.createElement("tui-text", { key: "n", bold: true, color: C.accent }, ` ${colLabel(colName, colWidth)} `),
          React.createElement(Badge, { key: "b", label: String(cards.length), color: C.primary }),
        ),
        ...cardEls,
      );
    });

    return React.createElement("tui-box", { key: "board", flexDirection: "row" }, ...colElements);
  }

  // --- Timeline view ---
  function renderTimeline(): React.ReactElement {
    const taskEls = TASKS.map((t, i) =>
      React.createElement("tui-box", { key: `t${i}`, flexDirection: "row", marginBottom: 1 },
        React.createElement("tui-text", { key: "n" }, `  ${t.name.padEnd(12)}`),
        React.createElement(GradientProgress, { key: "p", value: t.pct, width: 12, colors: [C.accent, C.primary], showPercentage: true }),
      ),
    );

    return React.createElement("tui-box", { key: "timeline", flexDirection: "column" },
      React.createElement("tui-box", { key: "st", marginBottom: 1, marginLeft: 2 },
        React.createElement(Stepper, { steps: STEPS, activeStep: 1, completedColor: C.primary, activeColor: C.accent }),
      ),
      ...taskEls,
      React.createElement("tui-box", { key: "days", marginLeft: 2, marginTop: 1, flexDirection: "row" },
        React.createElement("tui-text", { key: "lbl", color: C.warn, bold: true }, "  Days Remaining: "),
        React.createElement("tui-text", { key: "val", color: C.warn, bold: true }, "42"),
      ),
    );
  }

  // --- Settings view ---
  function renderSettings(): React.ReactElement {
    return React.createElement("tui-box", { key: "settings", flexDirection: "column", marginLeft: 2 },
      React.createElement("tui-box", { key: "form" },
        React.createElement(Form, { fields: FORM_FIELDS, isFocused: false, color: C.primary }),
      ),
      React.createElement("tui-box", { key: "sw1", marginTop: 1, flexDirection: "row" },
        React.createElement(Switch, { checked: notifs, label: "Notifications", color: C.primary, isFocused: false }),
      ),
      React.createElement("tui-box", { key: "sw2", marginTop: 1, flexDirection: "row" },
        React.createElement(Switch, { checked: autoAssign, label: "Auto-assign", color: C.primary, isFocused: false }),
      ),
    );
  }

  // Only render the active tab panel
  const activePanel = activeTab === "board" ? renderBoard()
    : activeTab === "timeline" ? renderTimeline()
    : renderSettings();

  const helpBindings = activeTab === "board"
    ? [{ key: "Tab", label: "Switch tab" }, { key: "\u2190\u2192", label: "Columns" }, { key: "\u2191\u2193", label: "Cards" }, { key: "m", label: "Move" }, { key: "q", label: "Quit" }]
    : [{ key: "Tab", label: "Switch tab" }, { key: "q", label: "Quit" }];

  // No onTabChange passed to TabbedContent — we handle tab switching ourselves
  // via Tab/Shift+Tab so TabbedContent's left/right handler is disabled.
  return React.createElement("tui-box", { flexDirection: "column", width, height },
    // Header
    React.createElement("tui-box", { key: "hdr", flexDirection: "row", marginBottom: 1 },
      React.createElement(Gradient, { key: "g", colors: [C.primary, C.accent], children: "  PROJECT HQ" }),
      React.createElement("tui-text", { key: "pn", dim: true }, `  ${projectName}`),
    ),
    // Tabs + content — only active panel rendered
    React.createElement(TabbedContent, {
      key: "tabs", tabs: TAB_DEFS, activeKey: activeTab,
      activeTabColor: C.primary,
      children: activeTab === "board" ? [activePanel, null, null]
        : activeTab === "timeline" ? [null, activePanel, null]
        : [null, null, activePanel],
    }),
    // Footer
    React.createElement("tui-box", { key: "ftr", marginTop: 1 },
      React.createElement(KeyboardHelp, { bindings: helpBindings, keyColor: C.primary }),
    ),
  );
}
