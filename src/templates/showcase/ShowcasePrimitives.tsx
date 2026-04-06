import React from "react";
import { useColors } from "../../hooks/useColors.js";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { ScrollView } from "../../components/core/ScrollView.js";
import { Text } from "../../components/core/Text.js";
import { Divider } from "../../components/core/Divider.js";
import { Divider as Separator } from "../../components/core/Divider.js";
import { Link } from "../../components/extras/Link.js";
import { Kbd } from "../../components/extras/Kbd.js";
import { Badge } from "../../components/extras/Badge.js";
import { Tag } from "../../components/extras/Tag.js";
import { Avatar } from "../../components/extras/Avatar.js";
import { Breadcrumb } from "../../components/extras/Breadcrumb.js";
import { heading, blank } from "./helpers.js";

export interface ShowcasePrimitivesProps {
  title?: string;
}

export function ShowcasePrimitives(props: ShowcasePrimitivesProps): React.ReactElement {
  const colors = useColors();
  const { title = "Core Primitives" } = props;
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

    // 1. Text
    heading("Text", "h-text"),
    blank("b1a"),
    React.createElement("tui-box", { key: "d-text", marginLeft: 2 },
      React.createElement(Text, { bold: true, color: colors.brand.primary }, "Hello Storm!"),
    ),
    blank("b1b"),

    // 2. Divider
    heading("Divider", "h-div"),
    blank("b2a"),
    React.createElement("tui-box", { key: "d-div", marginLeft: 2 },
      React.createElement(Divider, { style: "solid" }),
    ),
    blank("b2b"),

    // 3. Separator
    heading("Separator", "h-sep"),
    blank("b3a"),
    React.createElement("tui-box", { key: "d-sep", marginLeft: 2 },
      React.createElement(Separator, { style: "storm", label: "Section" }),
    ),
    blank("b3b"),

    // 4. Link
    heading("Link", "h-link"),
    blank("b4a"),
    React.createElement("tui-box", { key: "d-link", marginLeft: 2 },
      React.createElement(Link, { url: "https://storm.dev", color: colors.info, children: "https://storm.dev" }),
    ),
    blank("b4b"),

    // 5. Kbd
    heading("Kbd", "h-kbd"),
    blank("b5a"),
    React.createElement("tui-box", { key: "d-kbd", flexDirection: "row", marginLeft: 2, gap: 2 },
      React.createElement(Kbd, null, "Ctrl+C"),
      React.createElement(Kbd, null, "Enter"),
      React.createElement(Kbd, null, "Esc"),
    ),
    blank("b5b"),

    // 6. Badge
    heading("Badge", "h-badge"),
    blank("b6a"),
    React.createElement("tui-box", { key: "d-badge", flexDirection: "row", marginLeft: 2, gap: 1 },
      React.createElement(Badge, { label: "default", variant: "default" }),
      React.createElement(Badge, { label: "success", variant: "success" }),
      React.createElement(Badge, { label: "warning", variant: "warning" }),
      React.createElement(Badge, { label: "error", variant: "error" }),
      React.createElement(Badge, { label: "info", variant: "info" }),
    ),
    blank("b6b"),

    // 7. Tag
    heading("Tag", "h-tag"),
    blank("b7a"),
    React.createElement("tui-box", { key: "d-tag", flexDirection: "row", marginLeft: 2, gap: 2 },
      React.createElement(Tag, { label: "TypeScript", variant: "filled", color: colors.info }),
      React.createElement(Tag, { label: "React", variant: "outlined", color: colors.brand.primary }),
      React.createElement(Tag, { label: "TUI", variant: "filled", color: colors.success }),
    ),
    blank("b7b"),

    // 8. Avatar
    heading("Avatar", "h-avatar"),
    blank("b8a"),
    React.createElement("tui-box", { key: "d-avatar", flexDirection: "row", marginLeft: 2, gap: 2 },
      React.createElement(Avatar, { name: "JS", size: "small" }),
      React.createElement(Avatar, { name: "TS", size: "large" }),
    ),
    blank("b8b"),

    // 9. Breadcrumb
    heading("Breadcrumb", "h-bread"),
    blank("b9a"),
    React.createElement("tui-box", { key: "d-bread", marginLeft: 2 },
      React.createElement(Breadcrumb, { items: ["Home", "Components", "Primitives"] }),
    ),
    blank("b9b"),

    // Footer
    React.createElement("tui-text", { key: "footer", dim: true },
      "  [q] Quit"),
  );
}
