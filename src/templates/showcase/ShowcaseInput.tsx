import React, { useState } from "react";
import { useColors } from "../../hooks/useColors.js";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { ScrollView } from "../../components/core/ScrollView.js";
import { TextInput } from "../../components/core/TextInput.js";
import { ChatInput } from "../../components/extras/ChatInput.js";
import { Button } from "../../components/core/Button.js";
import { Checkbox } from "../../components/core/Checkbox.js";
import { Switch } from "../../components/core/Switch.js";
import { RadioGroup } from "../../components/core/RadioGroup.js";
import { SearchInput } from "../../components/extras/SearchInput.js";
import { MaskedInput } from "../../components/extras/MaskedInput.js";
import { Form } from "../../components/extras/Form.js";
import type { FormField } from "../../components/extras/Form.js";
import { heading, blank } from "./helpers.js";

export interface ShowcaseInputProps {
  title?: string;
}

const RADIO_OPTIONS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
] as const;

const FORM_FIELDS: FormField[] = [
  { key: "name", label: "Name", required: true, placeholder: "Enter name" },
  { key: "email", label: "Email", placeholder: "user@example.com", pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
];

export function ShowcaseInput(props: ShowcaseInputProps): React.ReactElement {
  const colors = useColors();
  const { title = "Input Controls" } = props;
  const { flushSync, exit } = useTui();

  const [textVal, setTextVal] = useState("");
  const [areaVal, setAreaVal] = useState("");
  const [checked, setChecked] = useState(false);
  const [switchOn, setSwitchOn] = useState(false);
  const [radio, setRadio] = useState("medium");
  const [searchVal, setSearchVal] = useState("");
  const [maskedVal, setMaskedVal] = useState("");

  useInput((event) => {
    if (event.key === "q" && event.ctrl) exit();
  });

  return React.createElement(ScrollView, { flex: 1 },
    // Title
    React.createElement("tui-text", {
      key: "title", bold: true, color: colors.brand.light,
    }, `  === ${title} ===`),
    blank("b0"),

    // 1. TextInput
    heading("TextInput", "h-text"),
    blank("b1a"),
    React.createElement("tui-box", { key: "d-text", marginLeft: 2 },
      React.createElement(TextInput, {
        value: textVal,
        onChange: (v: string) => { flushSync(() => setTextVal(v)); },
        placeholder: "Type here...",
        focus: false,
      }),
    ),
    blank("b1b"),

    // 2. ChatInput
    heading("ChatInput", "h-area"),
    blank("b2a"),
    React.createElement("tui-box", { key: "d-area", marginLeft: 2 },
      React.createElement(ChatInput, {
        value: areaVal,
        onChange: (v: string) => { flushSync(() => setAreaVal(v)); },
        placeholder: "Auto-wrapping input...",
        maxRows: 3,
        focus: false,
        width: 40,
      }),
    ),
    blank("b2b"),

    // 3. Button
    heading("Button", "h-btn"),
    blank("b3a"),
    React.createElement("tui-box", { key: "d-btn", flexDirection: "row", marginLeft: 2, gap: 2 },
      React.createElement(Button, { label: "Submit", isFocused: false }),
      React.createElement(Button, { label: "Loading...", loading: true, isFocused: false }),
    ),
    blank("b3b"),

    // 4. Checkbox
    heading("Checkbox", "h-chk"),
    blank("b4a"),
    React.createElement("tui-box", { key: "d-chk", marginLeft: 2 },
      React.createElement(Checkbox, {
        checked,
        onChange: (v: boolean) => { flushSync(() => setChecked(v)); },
        label: "Enable notifications",
      }),
    ),
    blank("b4b"),

    // 5. Switch
    heading("Switch", "h-sw"),
    blank("b5a"),
    React.createElement("tui-box", { key: "d-sw", marginLeft: 2 },
      React.createElement(Switch, {
        checked: switchOn,
        onChange: (v: boolean) => { flushSync(() => setSwitchOn(v)); },
        label: "Dark mode",
        isFocused: false,
      }),
    ),
    blank("b5b"),

    // 6. RadioGroup
    heading("RadioGroup", "h-radio"),
    blank("b6a"),
    React.createElement("tui-box", { key: "d-radio", marginLeft: 2 },
      React.createElement(RadioGroup, {
        options: RADIO_OPTIONS,
        value: radio,
        onChange: (v: string) => { flushSync(() => setRadio(v)); },
        isFocused: false,
      }),
    ),
    blank("b6b"),

    // 7. SearchInput
    heading("SearchInput", "h-search"),
    blank("b7a"),
    React.createElement("tui-box", { key: "d-search", marginLeft: 2 },
      React.createElement(SearchInput, {
        value: searchVal,
        onChange: (v: string) => { flushSync(() => setSearchVal(v)); },
        placeholder: "Search components...",
        focus: false,
      }),
    ),
    blank("b7b"),

    // 8. MaskedInput
    heading("MaskedInput", "h-mask"),
    blank("b8a"),
    React.createElement("tui-box", { key: "d-mask", marginLeft: 2 },
      React.createElement(MaskedInput, {
        value: maskedVal,
        onChange: (v: string) => { flushSync(() => setMaskedVal(v)); },
        mask: "###-###-####",
        focus: false,
      }),
    ),
    blank("b8b"),

    // 9. Form
    heading("Form", "h-form"),
    blank("b9a"),
    React.createElement("tui-box", { key: "d-form", marginLeft: 2 },
      React.createElement(Form, {
        fields: FORM_FIELDS,
        isFocused: false,
      }),
    ),
    blank("b9b"),

    // Footer
    React.createElement("tui-text", { key: "footer", dim: true },
      "  [Ctrl+Q] Quit"),
  );
}
