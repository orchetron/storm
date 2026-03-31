/**
 * ShowcaseData -- "Data Display" showcase template.
 *
 * Demos 9 data-oriented components with headings and live rendered examples.
 */

import React from "react";
import { useColors } from "../../hooks/useColors.js";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { ScrollView } from "../../components/ScrollView.js";
import { Table } from "../../components/Table.js";
import { DataGrid } from "../../components/DataGrid.js";
import { Tree } from "../../components/Tree.js";
import { ListView } from "../../components/ListView.js";
import { OrderedList } from "../../components/OrderedList.js";
import { UnorderedList } from "../../components/UnorderedList.js";
import { DefinitionList } from "../../components/DefinitionList.js";
import { Pretty } from "../../components/Pretty.js";
import { Sparkline } from "../../components/Sparkline.js";

export interface ShowcaseDataProps {
  title?: string;
}

const MOCK_DATA = [
  { name: "Alice", role: "Engineer", status: "Active" },
  { name: "Bob", role: "Designer", status: "Away" },
  { name: "Carol", role: "Manager", status: "Active" },
  { name: "Dave", role: "DevOps", status: "Offline" },
];

const TABLE_COLUMNS = [
  { key: "name", header: "Name", width: 12 },
  { key: "role", header: "Role", width: 12 },
  { key: "status", header: "Status", width: 10 },
];

const GRID_COLUMNS = [
  { key: "name", label: "Name", width: 12 },
  { key: "role", label: "Role", width: 12 },
  { key: "status", label: "Status", width: 10 },
];

const TREE_NODES = [
  {
    key: "src",
    label: "src",
    expanded: true,
    children: [
      { key: "components", label: "components" },
      { key: "hooks", label: "hooks" },
      { key: "utils", label: "utils" },
    ],
  },
];

const LIST_ITEMS = [
  { key: "a", label: "Router", icon: "\u2192", description: "HTTP request routing" },
  { key: "b", label: "Logger", icon: "\u270E", description: "Structured logging" },
  { key: "c", label: "Cache", icon: "\u2693", description: "In-memory store" },
  { key: "d", label: "Queue", icon: "\u25B6", description: "Task scheduling" },
  { key: "e", label: "Auth", icon: "\u2602", description: "Token validation" },
];

const SPARK_DATA = [3, 7, 2, 9, 5, 11, 4, 8, 1, 6, 10, 3, 7, 12, 5];

function heading(label: string, key: string): React.ReactElement {
  const colors = useColors();
  return React.createElement("tui-text", {
    key, bold: true, color: colors.brand.primary,
  }, `  ${label}`);
}

function blank(key: string): React.ReactElement {
  const colors = useColors();
  return React.createElement("tui-text", { key }, "");
}

export function ShowcaseData(props: ShowcaseDataProps): React.ReactElement {
  const colors = useColors();
  const { title = "Data Display" } = props;
  const { exit } = useTui();

  useInput((event) => {
    if (event.key === "q" || event.char === "q") exit();
  });

  return React.createElement(ScrollView, { flex: 1 },
    // Title
    React.createElement("tui-text", {
      key: "title", bold: true, color: colors.brand.light,
    }, `  === ${title} ===`),
    blank("b0"),

    // 1. Table
    heading("Table", "h-table"),
    blank("b1a"),
    React.createElement("tui-box", { key: "d-table", marginLeft: 2 },
      React.createElement(Table, { columns: TABLE_COLUMNS, data: MOCK_DATA, stripe: true }),
    ),
    blank("b1b"),

    // 2. DataGrid
    heading("DataGrid", "h-grid"),
    blank("b2a"),
    React.createElement("tui-box", { key: "d-grid", marginLeft: 2 },
      React.createElement(DataGrid, {
        columns: GRID_COLUMNS,
        rows: MOCK_DATA,
        sortColumn: "name",
        sortDirection: "asc",
        isFocused: false,
      }),
    ),
    blank("b2b"),

    // 3. Tree
    heading("Tree", "h-tree"),
    blank("b3a"),
    React.createElement("tui-box", { key: "d-tree", marginLeft: 2 },
      React.createElement(Tree, { nodes: TREE_NODES }),
    ),
    blank("b3b"),

    // 4. ListView
    heading("ListView", "h-list"),
    blank("b4a"),
    React.createElement("tui-box", { key: "d-list", marginLeft: 2 },
      React.createElement(ListView, { items: LIST_ITEMS, maxVisible: 5, isFocused: false }),
    ),
    blank("b4b"),

    // 5. OrderedList
    heading("OrderedList", "h-ol"),
    blank("b5a"),
    React.createElement("tui-box", { key: "d-ol", marginLeft: 2 },
      React.createElement(OrderedList, {
        items: [
          { content: "Install dependencies", children: ["npm install", "npm audit"] },
          "Build the project",
          "Run tests",
        ],
      }),
    ),
    blank("b5b"),

    // 6. UnorderedList
    heading("UnorderedList", "h-ul"),
    blank("b6a"),
    React.createElement("tui-box", { key: "d-ul", marginLeft: 2 },
      React.createElement(UnorderedList, {
        items: ["Components", "Hooks", "Utilities"],
      }),
    ),
    blank("b6b"),

    // 7. DefinitionList
    heading("DefinitionList", "h-dl"),
    blank("b7a"),
    React.createElement("tui-box", { key: "d-dl", marginLeft: 2 },
      React.createElement(DefinitionList, {
        items: [
          { term: "TUI", definition: "Terminal User Interface" },
          { term: "CLI", definition: "Command Line Interface" },
          { term: "REPL", definition: "Read-Eval-Print Loop" },
        ],
        layout: "stacked",
      }),
    ),
    blank("b7b"),

    // 8. Pretty
    heading("Pretty", "h-pretty"),
    blank("b8a"),
    React.createElement("tui-box", { key: "d-pretty", marginLeft: 2 },
      React.createElement(Pretty, {
        data: { name: "Storm", version: "1.0", features: ["layout", "scroll"] },
      }),
    ),
    blank("b8b"),

    // 9. Sparkline
    heading("Sparkline", "h-spark"),
    blank("b9a"),
    React.createElement("tui-box", { key: "d-spark", marginLeft: 2 },
      React.createElement(Sparkline, { data: SPARK_DATA, label: "Activity" }),
    ),
    blank("b9b"),

    // Footer
    React.createElement("tui-text", { key: "footer", dim: true },
      "  [q] Quit"),
  );
}
