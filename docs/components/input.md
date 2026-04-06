# Input Components

User input controls, forms, and selection widgets.

## Input

### TextInput

Single-line text input with cursor movement, undo/redo (Ctrl+Z/Y), command history (Up/Down arrows), and paste support.

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string` | -- | Current input value (required, controlled) |
| `onChange` | `(value: string) => void` | -- | Called on every keystroke (required) |
| `onSubmit` | `(value: string) => void` | -- | Called on Enter key |
| `placeholder` | `string` | -- | Placeholder text when empty |
| `focus` | `boolean` | `true` | Whether input captures keyboard |
| `color` | `string \| number` | -- | Text color |
| `placeholderColor` | `string \| number` | -- | Placeholder text color |
| `history` | `string[]` | `[]` | Previous inputs for Up/Down navigation |
| `width` | `number \| \`${number}%\`` | -- | Input width |
| `height` | `number` | `1` | Input height |
| `flex` | `number` | -- | Flex grow |
| `aria-label` | `string` | -- | Accessibility label |

**Basic: Simple input**

```tsx
import { TextInput } from "@orchetron/storm";
import { useState } from "react";

function NameInput() {
  const [name, setName] = useState("");
  return (
    <TextInput
      value={name}
      onChange={setName}
      onSubmit={(v) => console.log("Name:", v)}
      placeholder="Enter your name..."
    />
  );
}
```

**Advanced: Command prompt with history**

```tsx
function CommandPrompt({ history, onCommand }: { history: string[]; onCommand: (cmd: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <Box flexDirection="row" gap={1}>
      <Text color="#82AAFF" bold>{">"}</Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={(cmd) => {
          onCommand(cmd);
          setValue("");
        }}
        placeholder="Type a command..."
        history={history}
        color="#D4D4D4"
        placeholderColor="#505050"
        flex={1}
      />
    </Box>
  );
}
```

---

> **Note:** For multi-line text input, use `ChatInput` which supports multi-line editing with Enter for newlines and configurable submit behavior.

---

### ChatInput

Auto-wrapping, auto-expanding chat prompt input. Grows from 1 row to maxRows, then scrolls. Supports undo/redo, selection, history, and multiline mode.

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string` | -- | Current input value |
| `onChange` | `(value: string) => void` | -- | Value change callback |
| `onSubmit` | `(value: string) => void` | -- | Submit callback (Enter key) |
| `placeholder` | `string` | -- | Placeholder text |
| `maxRows` | `number` | `4` | Max rows before scrolling |
| `maxLength` | `number` | -- | Maximum character count |
| `focus` | `boolean` | `true` | Whether input is focused |
| `color` | `string \| number` | -- | Text color |
| `history` | `string[]` | `[]` | Command history (up/down arrows) |
| `multiline` | `boolean` | `false` | Enter inserts newline; Ctrl+Enter sends |
| `disabled` | `boolean` | `false` | Non-interactive mode |
| `promptChar` | `string` | personality default | Override prompt character |
| `cursorStyle` | `"block" \| "underline" \| "bar"` | personality default | Cursor display style |

```tsx
<ChatInput value={text} onChange={setText} onSubmit={send} placeholder="Type a message..." />
```

---

### Button

Pressable button rendered as `[ Label ]`. Enter or Space triggers the `onPress` callback. Supports focus state, disabled state, and a loading spinner.

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | -- | Button label text (required) |
| `onPress` | `() => void` | -- | Called on Enter/Space |
| `isFocused` | `boolean` | `true` | Whether button shows focused style and accepts input |
| `disabled` | `boolean` | `false` | Disable interaction and dim the label |
| `loading` | `boolean` | `false` | Show spinner animation beside label |
| `color` | `string \| number` | `colors.brand.primary` | Button color |
| `bold` | `boolean` | -- | Override bold style |
| `dim` | `boolean` | -- | Override dim style |
| `aria-label` | `string` | -- | Accessibility label |
| _Plus layout props_ | | | `width`, `height`, `margin*`, `minWidth`, `maxWidth` |

**Basic: Submit button**

```tsx
import { Button } from "@orchetron/storm";

<Button label="Submit" onPress={() => handleSubmit()} />
```

**Advanced: Button row with states**

```tsx
<Box flexDirection="row" gap={2}>
  <Button
    label="Save"
    onPress={handleSave}
    isFocused={activeButton === "save"}
    loading={isSaving}
  />
  <Button
    label="Cancel"
    onPress={handleCancel}
    isFocused={activeButton === "cancel"}
    color="#F87171"
  />
  <Button
    label="Delete"
    onPress={handleDelete}
    disabled={!canDelete}
    isFocused={activeButton === "delete"}
  />
</Box>
```

---

### Checkbox

Toggleable checkbox rendered as `[✓]` or `[ ]` with an optional label. Space or Enter toggles the checked state.

| Prop | Type | Default | Description |
|---|---|---|---|
| `checked` | `boolean` | -- | Whether checked (required, controlled) |
| `onChange` | `(checked: boolean) => void` | -- | Called on toggle |
| `label` | `string` | -- | Label text shown after checkbox |
| `disabled` | `boolean` | `false` | Disable interaction |
| `color` | `string \| number` | `colors.brand.primary` | Check mark color |
| `bold` | `boolean` | -- | Override bold |
| `dim` | `boolean` | -- | Override dim |
| `aria-label` | `string` | -- | Accessibility label |
| _Plus layout props_ | | | `width`, `height`, `margin*`, `minWidth`, `maxWidth` |

**Basic: Single checkbox**

```tsx
import { Checkbox } from "@orchetron/storm";

<Checkbox checked={agreed} onChange={setAgreed} label="I agree to the terms" />
```

**Advanced: Feature toggles**

```tsx
<Box flexDirection="column" gap={0}>
  <Checkbox checked={features.logging} onChange={(v) => setFeature("logging", v)} label="Enable logging" />
  <Checkbox checked={features.metrics} onChange={(v) => setFeature("metrics", v)} label="Collect metrics" />
  <Checkbox checked={features.debug} onChange={(v) => setFeature("debug", v)} label="Debug mode" disabled={isProduction} />
</Box>
```

---

### Switch

On/off toggle switch with a visual track indicator. Space or Enter toggles the state. Shows ON/OFF labels by default.

| Prop | Type | Default | Description |
|---|---|---|---|
| `checked` | `boolean` | -- | Whether switch is on (required, controlled) |
| `onChange` | `(checked: boolean) => void` | -- | Called on toggle |
| `label` | `string` | -- | Label text shown after status |
| `onLabel` | `string` | `"ON"` | Text when checked |
| `offLabel` | `string` | `"OFF"` | Text when unchecked |
| `isFocused` | `boolean` | `true` | Whether switch captures input |
| `color` | `string \| number` | `colors.success` | Active color |
| `bold` | `boolean` | -- | Override bold |
| `dim` | `boolean` | -- | Override dim |
| `aria-label` | `string` | -- | Accessibility label |
| _Plus layout props_ | | | `width`, `height`, `margin*`, `minWidth`, `maxWidth` |

**Basic: Simple toggle**

```tsx
import { Switch } from "@orchetron/storm";

<Switch checked={darkMode} onChange={setDarkMode} label="Dark mode" />
```

**Advanced: Custom labels with multiple switches**

```tsx
<Box flexDirection="column" gap={1}>
  <Switch checked={autoSave} onChange={setAutoSave} label="Auto-save" onLabel="Enabled" offLabel="Disabled" />
  <Switch checked={notifications} onChange={setNotifications} label="Notifications" color="#82AAFF" />
  <Switch checked={experimental} onChange={setExperimental} label="Experimental features" isFocused={false} />
</Box>
```

---

### RadioGroup

Single-selection radio button list. Renders filled/empty circle indicators. Up/Down arrows navigate, Enter/Space selects.

| Prop | Type | Default | Description |
|---|---|---|---|
| `options` | `readonly RadioOption[]` | -- | Array of `{ value, label }` (required) |
| `value` | `string` | -- | Currently selected value (required, controlled) |
| `onChange` | `(value: string) => void` | -- | Called on selection |
| `direction` | `"column" \| "row"` | `"column"` | Layout direction |
| `isFocused` | `boolean` | `true` | Whether group captures input |
| `color` | `string \| number` | `colors.brand.primary` | Selected indicator color |
| `aria-label` | `string` | -- | Accessibility label |
| _Plus layout props_ | | | `width`, `height`, `margin*`, `minWidth`, `maxWidth` |

**Basic: Vertical radio group**

```tsx
import { RadioGroup } from "@orchetron/storm";

<RadioGroup
  options={[
    { value: "small", label: "Small" },
    { value: "medium", label: "Medium" },
    { value: "large", label: "Large" },
  ]}
  value={size}
  onChange={setSize}
/>
```

**Advanced: Horizontal layout with custom color**

```tsx
<Box flexDirection="column" gap={1}>
  <Text bold>Select region:</Text>
  <RadioGroup
    options={[
      { value: "us-east", label: "US East" },
      { value: "us-west", label: "US West" },
      { value: "eu-west", label: "EU West" },
      { value: "ap-south", label: "Asia Pacific" },
    ]}
    value={region}
    onChange={setRegion}
    direction="row"
    color="#82AAFF"
  />
</Box>
```

---

### Select

Dropdown select with inline search filtering. When closed, shows selected label. When open, renders a bordered dropdown navigable with Up/Down/Enter/Escape. Type to filter.

| Prop | Type | Default | Description |
|---|---|---|---|
| `options` | `Array<{ label: string; value: string }>` | -- | Selectable options (required) |
| `value` | `string` | -- | Currently selected value |
| `onChange` | `(value: string) => void` | -- | Called on selection |
| `placeholder` | `string` | `"Select..."` | Placeholder when nothing selected |
| `isOpen` | `boolean` | `false` | Whether dropdown is open (controlled) |
| `onOpenChange` | `(open: boolean) => void` | -- | Called when dropdown opens/closes |
| `isFocused` | `boolean` | `true` | Whether select captures input |
| `color` | `string \| number` | `colors.brand.primary` | Accent color |
| `aria-label` | `string` | -- | Accessibility label |
| _Plus layout props_ | | | `width`, `height`, `margin*`, `minWidth`, `maxWidth` |

**Basic: Simple dropdown**

```tsx
import { Select } from "@orchetron/storm";

<Select
  options={[
    { label: "Node.js", value: "node" },
    { label: "Python", value: "python" },
    { label: "Rust", value: "rust" },
  ]}
  value={language}
  onChange={setLanguage}
  isOpen={isOpen}
  onOpenChange={setIsOpen}
/>
```

**Advanced: Controlled dropdown with label**

```tsx
function LanguagePicker() {
  const [lang, setLang] = useState("node");
  const [open, setOpen] = useState(false);

  return (
    <Box flexDirection="column">
      <Text bold marginBottom={1}>Runtime:</Text>
      <Select
        options={[
          { label: "Node.js 20 LTS", value: "node20" },
          { label: "Node.js 22 Current", value: "node22" },
          { label: "Deno 2.0", value: "deno2" },
          { label: "Bun 1.1", value: "bun" },
        ]}
        value={lang}
        onChange={(v) => { setLang(v); setOpen(false); }}
        isOpen={open}
        onOpenChange={setOpen}
        placeholder="Choose runtime..."
        color="#82AAFF"
        width={30}
      />
    </Box>
  );
}
```

---

### SearchInput

Text input with a magnifying glass icon prefix. Wraps TextInput with search-oriented defaults.

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string` | -- | Current search value (required, controlled) |
| `onChange` | `(value: string) => void` | -- | Called on every keystroke (required) |
| `onSubmit` | `(value: string) => void` | -- | Called on Enter |
| `placeholder` | `string` | `"Search..."` | Placeholder text |
| `focus` | `boolean` | `true` | Whether input captures keyboard |
| `color` | `string \| number` | -- | Text color |
| `aria-label` | `string` | -- | Accessibility label |
| _Plus layout props_ | | | `width`, `height`, `margin*`, `minWidth`, `maxWidth` |

**Basic: Search field**

```tsx
import { SearchInput } from "@orchetron/storm";

<SearchInput value={query} onChange={setQuery} onSubmit={runSearch} />
```

**Advanced: Search with results count**

```tsx
<Box flexDirection="column" gap={1}>
  <SearchInput
    value={query}
    onChange={setQuery}
    placeholder="Filter components..."
    width={40}
  />
  <Text dim>{filteredItems.length} results</Text>
</Box>
```

---

### Form

Multi-field form container with Tab/Enter navigation, built-in validation, and a submit button. Supports text, password, and number field types.

| Prop | Type | Default | Description |
|---|---|---|---|
| `fields` | `FormField[]` | -- | Array of field definitions (required) |
| `onSubmit` | `(values: Record<string, string>) => void` | -- | Called with all field values on submit |
| `isFocused` | `boolean` | `true` | Whether form captures input |
| `submitLabel` | `string` | `"Submit"` | Label for the submit button |
| `color` | `string \| number` | `colors.brand.primary` | Accent color |
| `aria-label` | `string` | -- | Accessibility label |
| _Plus container props_ | | | `padding*`, `borderStyle`, `borderColor`, `backgroundColor`, `width`, `margin*` |

**FormField type:**

| Property | Type | Default | Description |
|---|---|---|---|
| `key` | `string` | -- | Unique field identifier |
| `label` | `string` | -- | Display label |
| `type` | `"text" \| "password" \| "number"` | `"text"` | Input type |
| `placeholder` | `string` | -- | Placeholder text |
| `required` | `boolean` | -- | Marks field as required |
| `validate` | `(value: string) => string \| null` | -- | Custom validation returning error or null |
| `pattern` | `RegExp` | -- | Regex pattern validation |
| `minLength` | `number` | -- | Minimum input length |
| `maxLength` | `number` | -- | Maximum input length |

**Basic: Login form**

```tsx
import { Form } from "@orchetron/storm";

<Form
  fields={[
    { key: "username", label: "Username", required: true },
    { key: "password", label: "Password", type: "password", required: true },
  ]}
  onSubmit={(values) => login(values.username, values.password)}
/>
```

**Advanced: Validated registration form**

```tsx
<Form
  fields={[
    { key: "email", label: "Email", required: true, pattern: /^[^@]+@[^@]+\.[^@]+$/ },
    { key: "password", label: "Password", type: "password", required: true, minLength: 8 },
    { key: "port", label: "Port", type: "number", placeholder: "8080" },
    {
      key: "name",
      label: "Display Name",
      maxLength: 32,
      validate: (v) => v.includes(" ") ? null : "Must include first and last name",
    },
  ]}
  onSubmit={handleRegistration}
  submitLabel="Create Account"
  borderStyle="round"
  borderColor="#82AAFF"
  padding={1}
/>
```

---

### MaskedInput

Formatted text input with a mask pattern where `#` = digit, `A` = letter, `*` = any character. Literal characters in the mask are auto-advanced.

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string` | -- | Current raw input value |
| `onChange` | `(value: string) => void` | -- | Called when value changes |
| `onSubmit` | `(value: string) => void` | -- | Called on Enter |
| `mask` | `string` | -- | Mask pattern (`#`=digit, `A`=letter, `*`=any) |
| `placeholder` | `string` | -- | Placeholder text when empty |
| `color` | `string \| number` | `colors.text.primary` | Text color |
| `focus` | `boolean` | `true` | Whether the input is focused |
| `disabled` | `boolean` | `false` | Disable input |
| `width` | `number \| \`${number}%\`` | -- | Explicit width |
| `height` | `number \| \`${number}%\`` | -- | Explicit height |
| `flex` | `number` | -- | Flex grow shorthand |
| `renderDisplay` | `(formatted: string, cursor: number) => ReactNode` | -- | Custom display renderer |
| `aria-label` | `string` | -- | Accessibility label |

```tsx
const [phone, setPhone] = useState("");
<MaskedInput value={phone} onChange={setPhone} mask="(###) ###-####" placeholder="Phone" />
```

---

### FilePicker

File/directory tree navigator with fuzzy type-to-search, extension filtering, and file metadata display.

| Prop | Type | Default | Description |
|---|---|---|---|
| `files` | `FileNode[]` | -- | File tree to display |
| `onSelect` | `(path: string) => void` | -- | File selection callback |
| `selectedPath` | `string` | -- | Currently selected path |
| `maxVisible` | `number` | -- | Max visible entries |
| `isFocused` | `boolean` | -- | Enable keyboard navigation |
| `color` | `string \| number` | -- | Text color |
| `extensions` | `string[]` | -- | Filter by extensions (e.g. `[".ts"]`) |
| `showSize` | `boolean` | -- | Show file sizes |
| `showModified` | `boolean` | -- | Show last modified date |
| `renderEntry` | `(file, state) => ReactNode` | -- | Custom entry renderer |

```tsx
<FilePicker files={fileTree} onSelect={openFile} extensions={[".ts", ".tsx"]} isFocused />
```

---

### SelectInput

Arrow-key navigable single-select list with type-to-filter.

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `SelectInputItem[]` | -- | Items (`{ label, value }`) |
| `onSelect` | `(item: SelectInputItem) => void` | -- | Called on Enter |
| `onHighlight` | `(item: SelectInputItem) => void` | -- | Called when highlight changes |
| `initialIndex` | `number` | `0` | Initially highlighted index |
| `isFocused` | `boolean` | `true` | Accept keyboard input |
| `maxVisible` | `number` | -- | Max visible items before scrolling |
| `renderItem` | `(item, state) => ReactNode` | -- | Custom item renderer |
| `aria-label` | `string` | -- | Accessibility label |

```tsx
<SelectInput
  items={[
    { label: "TypeScript", value: "ts" },
    { label: "Rust", value: "rs" },
    { label: "Go", value: "go" },
  ]}
  onSelect={(item) => console.log(item.value)}
/>
```

---

### SelectionList

Multi-select checklist with keyboard navigation, range selection (Shift+Up/Down), and type-to-filter.

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `Array<{ label, value }>` | -- | Selectable items |
| `selectedValues` | `string[]` | -- | Currently selected values |
| `onChange` | `(values: string[]) => void` | -- | Called when selection changes |
| `checkColor` | `string \| number` | `colors.success` | Checkbox color |
| `highlightColor` | `string \| number` | `colors.brand.primary` | Highlighted item color |
| `isFocused` | `boolean` | `true` | Accept keyboard input |
| `renderItem` | `(item, state) => ReactNode` | -- | Custom item renderer |
| `aria-label` | `string` | -- | Accessibility label |

Keys: Space=toggle, A=select all, N=deselect all, Shift+Up/Down=range select.

```tsx
<SelectionList
  items={[{ label: "Apple", value: "apple" }, { label: "Banana", value: "banana" }]}
  selectedValues={selected}
  onChange={setSelected}
/>
```


---

### OptionList

Scrollable list of options with keyboard navigation and type-to-filter. Lightweight alternative to `Select` for flat option lists.

| Prop | Type | Default | Description |
|---|---|---|---|
| `options` | `Array<{ label: string; value: string }>` | -- | Options to display |
| `onSelect` | `(value: string) => void` | -- | Called on Enter |
| `isFocused` | `boolean` | `true` | Accept keyboard input |

```tsx
<OptionList options={[{ label: "Yes", value: "y" }, { label: "No", value: "n" }]} onSelect={handle} />
```

---

### TextArea

Multi-line text editor with line numbers, word wrap, and scroll support.

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string` | -- | Current text content |
| `onChange` | `(value: string) => void` | -- | Called on change |
| `height` | `number` | `10` | Visible rows |
| `placeholder` | `string` | -- | Placeholder text |

```tsx
<TextArea value={text} onChange={setText} height={8} placeholder="Enter description..." />
```

---

### DatePicker

Calendar-based date selector with keyboard navigation. Built on `useCalendarBehavior`.

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `Date` | -- | Selected date |
| `onChange` | `(date: Date) => void` | -- | Called on selection |
| `isFocused` | `boolean` | `true` | Accept keyboard input |

```tsx
<DatePicker value={date} onChange={setDate} />
```

---
[Back to Components](README.md)
