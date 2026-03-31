/**
 * ShowcaseAdvanced — "Advanced Components" showcase template.
 *
 * Demos: Header, Footer, ConfirmDialog, ProgressBar, VirtualList,
 * DirectoryTree, FilePicker, RichLog, Stopwatch.
 */

import React from "react";
import { colors as defaultColors } from "../../theme/colors.js";
import { useColors } from "../../hooks/useColors.js";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { Header } from "../../components/Header.js";
import { Footer } from "../../components/Footer.js";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";
import { ProgressBar } from "../../components/ProgressBar.js";
import { VirtualList, type VirtualListProps } from "../../components/VirtualList.js";
import { DirectoryTree } from "../../components/DirectoryTree.js";
import { FilePicker } from "../../components/FilePicker.js";
import { RichLog } from "../../components/RichLog.js";
import { Stopwatch } from "../../components/Stopwatch.js";
import { ScrollView } from "../../components/ScrollView.js";
import { useTerminal } from "../../hooks/useTerminal.js";
import type { LogEntry } from "../../components/RichLog.js";
import type { FileNode } from "../../components/FilePicker.js";

export interface ShowcaseAdvancedProps {
  title?: string;
}

// heading and gap are plain helper functions used by ShowcaseAdvanced below

const VIRTUAL_ITEMS = Array.from({ length: 100 }, (_, i) => `Item ${i + 1}`);

const LOG_ENTRIES: readonly LogEntry[] = [
  { text: "Server started", color: defaultColors.success, bold: true },
  { text: "Loaded 42 routes", color: defaultColors.info },
  { text: "Cache warm-up complete", color: defaultColors.text.secondary },
  { text: "Request GET /api (200, 12ms)", color: defaultColors.text.primary },
  { text: "Warning: slow query (340ms)", color: defaultColors.warning },
];

const MOCK_FILES: readonly FileNode[] = [
  {
    name: "src", path: "/src", isDirectory: true,
    children: [
      { name: "index.ts", path: "/src/index.ts", isDirectory: false },
      { name: "utils.ts", path: "/src/utils.ts", isDirectory: false },
    ],
  },
  { name: "package.json", path: "/package.json", isDirectory: false },
];

export function ShowcaseAdvanced(props: ShowcaseAdvancedProps): React.ReactElement {
  const colors = useColors();
  const { title = "Advanced Components" } = props;
  const { exit } = useTui();
  const { width } = useTerminal();

  useInput((event) => {
    if (event.key === "q" || event.char === "q") exit();
  });

  const heading = (label: string) => React.createElement("tui-text", { bold: true, color: colors.brand.primary }, `\n  ${label}`);
  const gap = () => React.createElement("tui-text", null, "");

  const header = React.createElement("tui-text", {
    bold: true, color: colors.brand.light,
  }, `  === ${title} ===`);

  // 1. Header
  const headerComp = React.createElement(Header, {
    title: "My App", subtitle: "v1.0.0",
  });

  // 2. Footer
  const footerComp = React.createElement(Footer, {},
    React.createElement("tui-text", { dim: true }, "  Ready | 3 files open | UTF-8"),
  );

  // 3. ConfirmDialog
  const confirmDialog = React.createElement(ConfirmDialog, {
    visible: true, message: "Are you sure?",
  });

  // 4. ProgressBar — 3 bars
  const pb25 = React.createElement(ProgressBar, { value: 25, showPercent: true, width: 20 });
  const pb50 = React.createElement(ProgressBar, { value: 50, showPercent: true, width: 20 });
  const pb75 = React.createElement(ProgressBar, { value: 75, showPercent: true, width: 20 });

  // 5. VirtualList
  const virtualList = React.createElement(VirtualList as React.ComponentType<VirtualListProps<string>>, {
    items: VIRTUAL_ITEMS,
    height: 5,
    renderItem: (item: string) => React.createElement("tui-text", null, `  ${item}`),
    isFocused: false,
  });

  // 6. DirectoryTree
  const dirTree = React.createElement(DirectoryTree, {
    rootPath: process.cwd(), isFocused: false,
  });

  // 7. FilePicker
  const filePicker = React.createElement(FilePicker, {
    files: MOCK_FILES, isFocused: false, maxVisible: 5,
  });

  // 8. RichLog
  const richLog = React.createElement(RichLog, {
    entries: LOG_ENTRIES, maxVisible: 5, isFocused: false,
  });

  // 9. Stopwatch
  const stopwatch = React.createElement(Stopwatch, {
    running: true, format: "ss.ms",
  });

  const footer = React.createElement("tui-text", { dim: true }, "  [q] Quit");

  return React.createElement(ScrollView, { flex: 1 },
    React.createElement("tui-box", {
      flexDirection: "column", width: width - 2,
    },
      header, gap(),
      heading("Header"), React.createElement("tui-box", { marginLeft: 2 }, headerComp), gap(),
      heading("Footer"), React.createElement("tui-box", { marginLeft: 2 }, footerComp), gap(),
      heading("ConfirmDialog"), React.createElement("tui-box", { marginLeft: 2 }, confirmDialog), gap(),
      heading("ProgressBar (25%, 50%, 75%)"),
      React.createElement("tui-box", { flexDirection: "column", marginLeft: 2 }, pb25, pb50, pb75), gap(),
      heading("VirtualList (100 items, height 5)"),
      React.createElement("tui-box", { marginLeft: 2 }, virtualList), gap(),
      heading("DirectoryTree"), React.createElement("tui-box", { marginLeft: 2 }, dirTree), gap(),
      heading("FilePicker"), React.createElement("tui-box", { marginLeft: 2 }, filePicker), gap(),
      heading("RichLog"), React.createElement("tui-box", { marginLeft: 2 }, richLog), gap(),
      heading("Stopwatch (ss.ms)"), React.createElement("tui-box", { marginLeft: 2 }, stopwatch), gap(),
      footer,
    ),
  );
}
