/**
 * ShowcaseSelection -- "Selection & Navigation" showcase template.
 *
 * Demos 9 selection/navigation components with headings and live examples.
 */

import React, { useState } from "react";
import { useColors } from "../../hooks/useColors.js";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { ScrollView } from "../../components/ScrollView.js";
import { Select } from "../../components/Select.js";
import { SelectInput } from "../../components/SelectInput.js";
import { SelectionList } from "../../components/SelectionList.js";
import { Menu } from "../../components/Menu.js";
import { Tabs } from "../../components/Tabs.js";
import { Calendar } from "../../components/Calendar.js";
import { Paginator } from "../../components/Paginator.js";
import { Stepper } from "../../components/Stepper.js";
import { KeyboardHelp } from "../../components/KeyboardHelp.js";

export interface ShowcaseSelectionProps {
  title?: string;
}

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

const SELECT_OPTIONS = [
  { label: "Apple", value: "apple" },
  { label: "Banana", value: "banana" },
  { label: "Cherry", value: "cherry" },
];

const SELECT_INPUT_ITEMS = [
  { label: "Option A", value: "a" },
  { label: "Option B", value: "b" },
  { label: "Option C", value: "c" },
  { label: "Option D", value: "d" },
];

const SELECTION_ITEMS = [
  { label: "Node.js", value: "node" },
  { label: "TypeScript", value: "ts" },
  { label: "React", value: "react" },
  { label: "Vitest", value: "vitest" },
];

const MENU_ITEMS = [
  { label: "New File", value: "new", shortcut: "n" },
  { label: "Open", value: "open", shortcut: "o" },
  { label: "Save", value: "save", shortcut: "s" },
  { label: "Export", value: "export", shortcut: "e" },
  { label: "Quit", value: "quit", shortcut: "q" },
];

const TAB_ITEMS = [
  { key: "overview", label: "Overview" },
  { key: "details", label: "Details" },
  { key: "settings", label: "Settings" },
];

const STEPPER_STEPS = [
  { label: "Setup" },
  { label: "Configure" },
  { label: "Review" },
  { label: "Deploy" },
];

const KB_BINDINGS = [
  { key: "Up/Down", label: "Navigate" },
  { key: "Enter", label: "Select" },
  { key: "Space", label: "Toggle" },
  { key: "q", label: "Quit" },
];

export function ShowcaseSelection(props: ShowcaseSelectionProps): React.ReactElement {
  const colors = useColors();
  const { title = "Selection & Navigation" } = props;
  const { flushSync, exit } = useTui();

  const [selectVal, setSelectVal] = useState<string | undefined>(undefined);
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectionVals, setSelectionVals] = useState<string[]>(["ts"]);
  const [activeTab, setActiveTab] = useState("overview");
  const [calDay, setCalDay] = useState(15);
  const [page, setPage] = useState(1);

  useInput((event) => {
    if (event.key === "q" && event.ctrl) exit();
  });

  const now = new Date();

  return React.createElement(ScrollView, { flex: 1 },
    // Title
    React.createElement("tui-text", {
      key: "title", bold: true, color: colors.brand.light,
    }, `  === ${title} ===`),
    blank("b0"),

    // 1. Select
    heading("Select", "h-sel"),
    blank("b1a"),
    React.createElement("tui-box", { key: "d-sel", marginLeft: 2 },
      React.createElement(Select, {
        options: SELECT_OPTIONS,
        ...(selectVal !== undefined ? { value: selectVal } : {}),
        onChange: (v: string) => { flushSync(() => setSelectVal(v)); },
        isOpen: selectOpen,
        onOpenChange: (o: boolean) => { flushSync(() => setSelectOpen(o)); },
        isFocused: false,
      }),
    ),
    blank("b1b"),

    // 2. SelectInput
    heading("SelectInput", "h-si"),
    blank("b2a"),
    React.createElement("tui-box", { key: "d-si", marginLeft: 2 },
      React.createElement(SelectInput, {
        items: SELECT_INPUT_ITEMS,
        onSelect: () => {},
        isFocused: false,
      }),
    ),
    blank("b2b"),

    // 3. SelectionList
    heading("SelectionList", "h-sl"),
    blank("b3a"),
    React.createElement("tui-box", { key: "d-sl", marginLeft: 2 },
      React.createElement(SelectionList, {
        items: SELECTION_ITEMS,
        selectedValues: selectionVals,
        onChange: (v: string[]) => { flushSync(() => setSelectionVals(v)); },
        isFocused: false,
      }),
    ),
    blank("b3b"),

    // 4. Menu
    heading("Menu", "h-menu"),
    blank("b4a"),
    React.createElement("tui-box", { key: "d-menu", marginLeft: 2 },
      React.createElement(Menu, {
        items: MENU_ITEMS,
        isFocused: false,
      }),
    ),
    blank("b4b"),

    // 5. Tabs
    heading("Tabs", "h-tabs"),
    blank("b5a"),
    React.createElement("tui-box", { key: "d-tabs", marginLeft: 2 },
      React.createElement(Tabs, {
        tabs: TAB_ITEMS,
        activeKey: activeTab,
        onChange: (k: string) => { flushSync(() => setActiveTab(k)); },
        isFocused: false,
      }),
    ),
    blank("b5b"),

    // 6. Calendar
    heading("Calendar", "h-cal"),
    blank("b6a"),
    React.createElement("tui-box", { key: "d-cal", marginLeft: 2 },
      React.createElement(Calendar, {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        selectedDay: calDay,
        onSelect: (d: number) => { flushSync(() => setCalDay(d)); },
        isFocused: false,
      }),
    ),
    blank("b6b"),

    // 7. Paginator
    heading("Paginator", "h-page"),
    blank("b7a"),
    React.createElement("tui-box", { key: "d-page", marginLeft: 2 },
      React.createElement(Paginator, {
        total: 5,
        current: page,
        style: "dots",
        onPageChange: (p: number) => { flushSync(() => setPage(p)); },
      }),
    ),
    blank("b7b"),

    // 8. Stepper
    heading("Stepper", "h-step"),
    blank("b8a"),
    React.createElement("tui-box", { key: "d-step", marginLeft: 2 },
      React.createElement(Stepper, {
        steps: STEPPER_STEPS,
        activeStep: 1,
      }),
    ),
    blank("b8b"),

    // 9. KeyboardHelp
    heading("KeyboardHelp", "h-kb"),
    blank("b9a"),
    React.createElement("tui-box", { key: "d-kb", marginLeft: 2 },
      React.createElement(KeyboardHelp, { bindings: KB_BINDINGS }),
    ),
    blank("b9b"),

    // Footer
    React.createElement("tui-text", { key: "footer", dim: true },
      "  [Ctrl+Q] Quit"),
  );
}
