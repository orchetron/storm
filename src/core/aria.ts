export type AriaRole =
  | "button" | "textbox" | "checkbox" | "radio" | "switch"
  | "listbox" | "option" | "menu" | "menuitem" | "tab" | "tabpanel"
  | "dialog" | "alert" | "alertdialog" | "status" | "progressbar"
  | "tree" | "treeitem" | "grid" | "gridcell" | "row" | "columnheader"
  | "form" | "search" | "navigation" | "banner" | "contentinfo"
  | "complementary" | "main" | "region" | "separator" | "toolbar"
  | "spinbutton" | "slider" | "scrollbar" | "tooltip" | "timer"
  | "log" | "marquee" | "img" | "link" | "heading" | "group";

export type AriaLive = "off" | "polite" | "assertive";

export interface AriaProps {
  role?: AriaRole;
  "aria-label"?: string;
  "aria-description"?: string;
  "aria-live"?: AriaLive;
  "aria-expanded"?: boolean;
  "aria-selected"?: boolean;
  "aria-checked"?: boolean | "mixed";
  "aria-disabled"?: boolean;
  "aria-hidden"?: boolean;
  "aria-pressed"?: boolean;
  "aria-valuenow"?: number;
  "aria-valuemin"?: number;
  "aria-valuemax"?: number;
  "aria-valuetext"?: string;
  "aria-level"?: number;
  "aria-setsize"?: number;
  "aria-posinset"?: number;
  "aria-multiselectable"?: boolean;
  "aria-required"?: boolean;
  "aria-invalid"?: boolean;
  "aria-errormessage"?: string;
  "aria-placeholder"?: string;
  "aria-roledescription"?: string;
  "aria-keyshortcuts"?: string;
  "aria-sort"?: "none" | "ascending" | "descending";
  "aria-colcount"?: number;
  "aria-colindex"?: number;
  "aria-colspan"?: number;
  "aria-rowcount"?: number;
  "aria-rowindex"?: number;
  "aria-rowspan"?: number;
}

const ROLE_NAMES: Partial<Record<AriaRole, string>> = {
  button: "button",
  textbox: "text input",
  checkbox: "checkbox",
  radio: "radio button",
  switch: "switch",
  listbox: "list",
  option: "option",
  menu: "menu",
  menuitem: "menu item",
  tab: "tab",
  tabpanel: "tab panel",
  dialog: "dialog",
  alert: "alert",
  alertdialog: "alert dialog",
  status: "status",
  progressbar: "progress bar",
  tree: "tree",
  treeitem: "tree item",
  grid: "grid",
  gridcell: "cell",
  row: "row",
  columnheader: "column header",
  form: "form",
  search: "search",
  navigation: "navigation",
  banner: "banner",
  contentinfo: "content info",
  complementary: "complementary",
  main: "main",
  region: "region",
  separator: "separator",
  toolbar: "toolbar",
  spinbutton: "spin button",
  slider: "slider",
  scrollbar: "scroll bar",
  tooltip: "tooltip",
  timer: "timer",
  log: "log",
  marquee: "marquee",
  img: "image",
  link: "link",
  heading: "heading",
  group: "group",
};

export function ariaToAnnouncement(props: AriaProps): string {
  const parts: string[] = [];

  // Label first — the primary identifier
  if (props["aria-label"] !== undefined) {
    parts.push(props["aria-label"]);
  }

  // Role name
  if (props.role !== undefined) {
    const roleName = ROLE_NAMES[props.role] ?? props.role;
    if (props["aria-roledescription"] !== undefined) {
      parts.push(props["aria-roledescription"]);
    } else {
      parts.push(roleName);
    }
  }

  // Heading level
  if (props["aria-level"] !== undefined && props.role === "heading") {
    parts.push(`level ${props["aria-level"]}`);
  }

  // Checked / pressed / selected / expanded states
  if (props["aria-checked"] !== undefined) {
    if (props["aria-checked"] === "mixed") {
      parts.push("mixed");
    } else {
      parts.push(props["aria-checked"] ? "checked" : "not checked");
    }
  }

  if (props["aria-pressed"] !== undefined) {
    parts.push(props["aria-pressed"] ? "pressed" : "not pressed");
  }

  if (props["aria-selected"] !== undefined) {
    parts.push(props["aria-selected"] ? "selected" : "not selected");
  }

  if (props["aria-expanded"] !== undefined) {
    parts.push(props["aria-expanded"] ? "expanded" : "collapsed");
  }

  // Value
  if (props["aria-valuetext"] !== undefined) {
    parts.push(props["aria-valuetext"]);
  } else if (props["aria-valuenow"] !== undefined) {
    if (props["aria-valuemin"] !== undefined && props["aria-valuemax"] !== undefined) {
      parts.push(`${props["aria-valuenow"]} of ${props["aria-valuemax"]}`);
    } else {
      parts.push(String(props["aria-valuenow"]));
    }
  }

  // Position in set
  if (props["aria-posinset"] !== undefined && props["aria-setsize"] !== undefined) {
    parts.push(`${props["aria-posinset"]} of ${props["aria-setsize"]}`);
  }

  // States
  if (props["aria-disabled"] === true) {
    parts.push("disabled");
  }

  if (props["aria-required"] === true) {
    parts.push("required");
  }

  if (props["aria-invalid"] === true) {
    parts.push("invalid");
    if (props["aria-errormessage"] !== undefined) {
      parts.push(props["aria-errormessage"]);
    }
  }

  if (props["aria-sort"] !== undefined && props["aria-sort"] !== "none") {
    parts.push(`sorted ${props["aria-sort"]}`);
  }

  // Keyboard shortcut
  if (props["aria-keyshortcuts"] !== undefined) {
    parts.push(`shortcut ${props["aria-keyshortcuts"]}`);
  }

  // Description last — supplementary info
  if (props["aria-description"] !== undefined) {
    parts.push(props["aria-description"]);
  }

  return parts.join(", ");
}

export function describeButton(label: string, disabled?: boolean, pressed?: boolean): AriaProps {
  const props: AriaProps = {
    role: "button",
    "aria-label": label,
  };
  if (disabled === true) {
    props["aria-disabled"] = true;
  }
  if (pressed !== undefined) {
    props["aria-pressed"] = pressed;
  }
  return props;
}

export function describeCheckbox(label: string, checked: boolean, disabled?: boolean): AriaProps {
  const props: AriaProps = {
    role: "checkbox",
    "aria-label": label,
    "aria-checked": checked,
  };
  if (disabled === true) {
    props["aria-disabled"] = true;
  }
  return props;
}

export function describeTextInput(label: string, value: string, placeholder?: string): AriaProps {
  const props: AriaProps = {
    role: "textbox",
    "aria-label": label,
  };
  if (value.length > 0) {
    props["aria-description"] = value;
  }
  if (placeholder !== undefined) {
    props["aria-placeholder"] = placeholder;
  }
  return props;
}

export function describeProgressBar(value: number, max: number, label?: string): AriaProps {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const props: AriaProps = {
    role: "progressbar",
    "aria-valuenow": value,
    "aria-valuemin": 0,
    "aria-valuemax": max,
    "aria-valuetext": `${pct}%`,
  };
  if (label !== undefined) {
    props["aria-label"] = label;
  }
  return props;
}

export function describeTab(label: string, selected: boolean, index: number, total: number): AriaProps {
  return {
    role: "tab",
    "aria-label": label,
    "aria-selected": selected,
    "aria-posinset": index + 1,
    "aria-setsize": total,
  };
}

export function describeMenuItem(label: string, disabled?: boolean, shortcut?: string): AriaProps {
  const props: AriaProps = {
    role: "menuitem",
    "aria-label": label,
  };
  if (disabled === true) {
    props["aria-disabled"] = true;
  }
  if (shortcut !== undefined) {
    props["aria-keyshortcuts"] = shortcut;
  }
  return props;
}

export function describeTreeItem(label: string, expanded: boolean, level: number): AriaProps {
  return {
    role: "treeitem",
    "aria-label": label,
    "aria-expanded": expanded,
    "aria-level": level,
  };
}

export function describeListItem(label: string, selected: boolean, index: number, total: number): AriaProps {
  return {
    role: "option",
    "aria-label": label,
    "aria-selected": selected,
    "aria-posinset": index + 1,
    "aria-setsize": total,
  };
}

export function describeDialog(title: string): AriaProps {
  return {
    role: "dialog",
    "aria-label": title,
  };
}

export function describeAlert(message: string, type: string): AriaProps {
  return {
    role: "alert",
    "aria-label": message,
    "aria-live": "assertive",
    "aria-roledescription": type,
  };
}
