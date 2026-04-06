import React, { useState } from "react";
import { useColors } from "../../hooks/useColors.js";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { ScrollView } from "../../components/core/ScrollView.js";
import { Collapsible } from "../../components/extras/Collapsible.js";
import { Accordion } from "../../components/extras/Accordion.js";
import { ContentSwitcher } from "../../components/extras/ContentSwitcher.js";
import { TabbedContent } from "../../components/extras/TabbedContent.js";
import { Modal } from "../../components/core/Modal.js";
import { Tooltip } from "../../components/extras/Tooltip.js";
import { Card } from "../../components/extras/Card.js";
import { Shadow } from "../../components/effects/Shadow.js";
import { heading, blank } from "./helpers.js";

export interface ShowcaseLayoutProps {
  title?: string;
}

const SCROLL_LINES = Array.from({ length: 10 }, (_, i) =>
  `  Line ${i + 1} — scrollable content area`
);

export function ShowcaseLayout(props: ShowcaseLayoutProps): React.ReactElement {
  const colors = useColors();
  const { title = "Layout & Containers" } = props;
  const { flushSync, exit } = useTui();

  const [switcherIndex, setSwitcherIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("tab1");
  const [accordionKeys, setAccordionKeys] = useState<string[]>(["s1"]);

  useInput((event) => {
    if (event.key === "q" || event.char === "q") exit();
    if (event.char === "s") {
      flushSync(() => setSwitcherIndex((prev) => (prev === 0 ? 1 : 0)));
    }
  });

  return React.createElement(ScrollView, { flex: 1 },
    // Title
    React.createElement("tui-text", {
      key: "title", bold: true, color: colors.brand.light,
    }, `  === ${title} ===`),
    blank("b0"),

    // 1. ScrollView (nested, small viewport)
    heading("ScrollView", "h-scroll"),
    blank("b1a"),
    React.createElement("tui-box", { key: "d-scroll", marginLeft: 2 },
      React.createElement(ScrollView, { height: 5 },
        ...SCROLL_LINES.map((line, i) =>
          React.createElement("tui-text", { key: `sl-${i}` }, line)
        ),
      ),
    ),
    blank("b1b"),

    // 2. Collapsible
    heading("Collapsible", "h-coll"),
    blank("b2a"),
    React.createElement("tui-box", { key: "d-coll", marginLeft: 2 },
      React.createElement(Collapsible, { title: "Click to expand", expanded: true },
        React.createElement("tui-text", null, "  Hidden content revealed!"),
      ),
    ),
    blank("b2b"),

    // 3. Accordion
    heading("Accordion", "h-acc"),
    blank("b3a"),
    React.createElement("tui-box", { key: "d-acc", marginLeft: 2 },
      React.createElement(Accordion, {
        sections: [
          { key: "s1", title: "Section One", content: React.createElement("tui-text", null, "  Content of section one.") },
          { key: "s2", title: "Section Two", content: React.createElement("tui-text", null, "  Content of section two.") },
          { key: "s3", title: "Section Three", content: React.createElement("tui-text", null, "  Content of section three.") },
        ],
        activeKeys: accordionKeys,
        onToggle: (key: string) => {
          flushSync(() => setAccordionKeys((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
          ));
        },
      }),
    ),
    blank("b3b"),

    // 4. ContentSwitcher
    heading("ContentSwitcher", "h-switch"),
    blank("b4a"),
    React.createElement("tui-box", { key: "d-switch", marginLeft: 2, flexDirection: "column" },
      React.createElement("tui-text", { dim: true, key: "switch-hint" },
        `  Press [s] to toggle  (view ${switcherIndex + 1}/2)`),
      React.createElement(ContentSwitcher, {
        activeIndex: switcherIndex,
        children: [
          React.createElement("tui-text", { key: "v1", color: colors.success }, "  View A: Dashboard metrics"),
          React.createElement("tui-text", { key: "v2", color: colors.info }, "  View B: Activity log"),
        ],
      }),
    ),
    blank("b4b"),

    // 5. TabbedContent
    heading("TabbedContent", "h-tabs"),
    blank("b5a"),
    React.createElement("tui-box", { key: "d-tabs", marginLeft: 2 },
      React.createElement(TabbedContent, {
        tabs: [
          { label: "Overview", key: "tab1" },
          { label: "Details", key: "tab2" },
          { label: "Settings", key: "tab3" },
        ],
        activeKey: activeTab,
        onTabChange: (key: string) => { flushSync(() => setActiveTab(key)); },
        children: [
          React.createElement("tui-text", { key: "p1" }, "  Overview panel content"),
          React.createElement("tui-text", { key: "p2" }, "  Detailed information here"),
          React.createElement("tui-text", { key: "p3" }, "  Configuration options"),
        ],
      }),
    ),
    blank("b5b"),

    // 6. Modal
    heading("Modal", "h-modal"),
    blank("b6a"),
    React.createElement("tui-box", { key: "d-modal", marginLeft: 2 },
      React.createElement(Modal, {
        visible: true,
        title: "Settings",
        width: 40,
        children: React.createElement("tui-text", null, "Modal body content here."),
      }),
    ),
    blank("b6b"),

    // 7. Tooltip
    heading("Tooltip", "h-tip"),
    blank("b7a"),
    React.createElement("tui-box", { key: "d-tip", marginLeft: 2 },
      React.createElement(Tooltip, {
        content: "This is a tooltip",
        visible: true,
        position: "right",
        children: React.createElement("tui-text", { color: colors.brand.primary }, "Hover target"),
      }),
    ),
    blank("b7b"),

    // 8. Card
    heading("Card", "h-card"),
    blank("b8a"),
    React.createElement("tui-box", { key: "d-card", marginLeft: 2 },
      React.createElement(Card, {
        variant: "storm",
        title: "Storm Card",
        width: 40,
        children: React.createElement("tui-text", null, "Card body with storm variant styling."),
      }),
    ),
    blank("b8b"),

    // 9. Shadow
    heading("Shadow", "h-shadow"),
    blank("b9a"),
    React.createElement("tui-box", { key: "d-shadow", marginLeft: 2 },
      React.createElement(Shadow, {
        children: React.createElement("tui-box", {
          borderStyle: "single",
          borderColor: colors.text.dim,
          paddingLeft: 1,
          paddingRight: 1,
        },
          React.createElement("tui-text", null, "Box with drop shadow"),
        ),
      }),
    ),
    blank("b9b"),

    // Footer
    React.createElement("tui-text", { key: "footer", dim: true },
      "  [q] Quit  [s] Toggle switcher"),
  );
}
