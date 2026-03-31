# Component Reference

Storm ships 92 built-in components. This reference covers the top 30 general-purpose components organized by category, with full props tables and usage examples.

All components import from `@orchetron/storm-tui`.

---

## Quick Decision Guide

| I want to... | Use |
|---|---|
| Show a list of items | `<ListView>` (simple) or `<VirtualList>` (1000+ items) |
| Show a scrollable area | `<ScrollView height={N}>` or `<ScrollView flex={1}>` |
| Get text input | `<TextInput>` (single line) or `<ChatInput>` (multi-line) |
| Show a dropdown | `<Select>` |
| Show a data table | `<Table>` (simple) or `<DataGrid>` (sortable, selectable, editable) |
| Show a progress bar | `<ProgressBar>` (block fill) or `<GradientProgress>` (gradient) |
| Show a modal/dialog | `<Modal.Root>` (custom) or `<ConfirmDialog>` (yes/no) |
| Show tabs | `<TabbedContent>` (tabs + content) or `<Tabs>` (tab bar only) |
| Show a tree | `<Tree>` (data) or `<DirectoryTree>` (filesystem) |
| Show a chart | `<LineChart>` (lines) / `<BarChart>` (bars) / `<Sparkline>` (inline) |
| Show AI agent output | `<MessageBubble>` + `<StreamingText>` + `<OperationTree>` |
| Show a code block | `<SyntaxHighlight language="typescript">` |
| Show a diff | `<DiffView diff={unifiedDiff}>` |

---

## Core

### Box

Flexbox container -- the primary layout primitive. Arranges children vertically (default) or horizontally with full flexbox semantics, CSS Grid support, borders, padding, margin, and background color.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Child elements |
| `flexDirection` | `"column" \| "row" \| "column-reverse" \| "row-reverse"` | `"column"` | Primary axis direction |
| `flex` | `number` | -- | Shorthand for flex-grow |
| `flexGrow` | `number` | -- | How much to grow relative to siblings |
| `flexShrink` | `number` | -- | How much to shrink relative to siblings |
| `flexBasis` | `number` | -- | Initial size before grow/shrink |
| `flexWrap` | `"nowrap" \| "wrap" \| "wrap-reverse"` | `"nowrap"` | Whether children wrap |
| `gap` | `number` | -- | Space between children (both axes) |
| `columnGap` | `number` | -- | Horizontal gap between children |
| `rowGap` | `number` | -- | Vertical gap between children |
| `alignItems` | `"flex-start" \| "center" \| "flex-end" \| "stretch"` | `"stretch"` | Cross-axis alignment |
| `alignSelf` | `"auto" \| "flex-start" \| "center" \| "flex-end" \| "stretch"` | `"auto"` | Override parent alignItems |
| `justifyContent` | `"flex-start" \| "center" \| "flex-end" \| "space-between" \| "space-around" \| "space-evenly"` | `"flex-start"` | Main-axis alignment |
| `width` | `number \| \`${number}%\`` | -- | Explicit width |
| `height` | `number \| \`${number}%\`` | -- | Explicit height |
| `minWidth` | `number` | -- | Minimum width |
| `maxWidth` | `number` | -- | Maximum width |
| `minHeight` | `number` | -- | Minimum height |
| `maxHeight` | `number` | -- | Maximum height |
| `overflow` | `"visible" \| "hidden" \| "scroll"` | `"visible"` | Content overflow behavior |
| `overflowX` | `"visible" \| "hidden" \| "scroll"` | -- | Horizontal overflow |
| `overflowY` | `"visible" \| "hidden" \| "scroll"` | -- | Vertical overflow |
| `display` | `"flex" \| "grid" \| "none"` | `"flex"` | Display mode |
| `position` | `"relative" \| "absolute"` | `"relative"` | Positioning mode |
| `top` | `number` | -- | Offset from top (absolute positioning) |
| `left` | `number` | -- | Offset from left (absolute positioning) |
| `right` | `number` | -- | Offset from right (absolute positioning) |
| `bottom` | `number` | -- | Offset from bottom (absolute positioning) |
| `padding` | `number` | -- | Padding on all sides |
| `paddingX` | `number` | -- | Horizontal padding |
| `paddingY` | `number` | -- | Vertical padding |
| `paddingTop` | `number` | -- | Top padding |
| `paddingBottom` | `number` | -- | Bottom padding |
| `paddingLeft` | `number` | -- | Left padding |
| `paddingRight` | `number` | -- | Right padding |
| `margin` | `number` | -- | Margin on all sides |
| `marginX` | `number` | -- | Horizontal margin |
| `marginY` | `number` | -- | Vertical margin |
| `marginTop` | `number` | -- | Top margin |
| `marginBottom` | `number` | -- | Bottom margin |
| `marginLeft` | `number` | -- | Left margin |
| `marginRight` | `number` | -- | Right margin |
| `borderStyle` | `"single" \| "double" \| "round" \| "bold" \| "classic"` | -- | Border style |
| `borderColor` | `string \| number` | -- | Border color |
| `borderTop` | `boolean` | `true` | Show top border |
| `borderBottom` | `boolean` | `true` | Show bottom border |
| `borderLeft` | `boolean` | `true` | Show left border |
| `borderRight` | `boolean` | `true` | Show right border |
| `borderDimColor` | `boolean` | -- | Dim all borders |
| `backgroundColor` | `string \| number` | -- | Background color |
| `opaque` | `boolean` | -- | Fill background even in empty cells |
| `sticky` | `boolean` | -- | Stick to top of ScrollView |
| `stickyChildren` | `boolean` | -- | Enable sticky for children |
| `userSelect` | `boolean` | -- | Allow text selection |
| `aria-label` | `string` | -- | Accessibility label |
| `aria-hidden` | `boolean` | -- | Hide from accessibility tree |

**Basic: Two-column layout**

```tsx
import { Box, Text } from "@orchetron/storm-tui";

<Box flexDirection="row" gap={2} padding={1} borderStyle="round" borderColor="#82AAFF">
  <Box width={20}>
    <Text bold>Sidebar</Text>
  </Box>
  <Box flex={1}>
    <Text>Main content</Text>
  </Box>
</Box>
```

**Advanced: Grid layout with nested containers**

```tsx
<Box display="flex" flexDirection="column" height="100%">
  <Box borderStyle="double" borderColor="#82AAFF" padding={1}>
    <Text bold color="#82AAFF">Header</Text>
  </Box>
  <Box flexDirection="row" flex={1} gap={1}>
    <Box width={30} borderStyle="single" borderColor="#505050" paddingX={1}>
      <Text bold>Navigation</Text>
    </Box>
    <Box flex={1} padding={1}>
      <Text>Content area with flex grow</Text>
    </Box>
    <Box width={25} borderStyle="single" borderColor="#505050" paddingX={1}>
      <Text bold>Details</Text>
    </Box>
  </Box>
  <Box borderStyle="single" borderColor="#505050" paddingX={1}>
    <Text dim>Status bar</Text>
  </Box>
</Box>
```

---

### Text

Styled text with color, weight, and formatting. Supports inline nesting for mixed styles within a line. Text wraps by default.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Text content or nested Text elements |
| `color` | `string \| number` | -- | Foreground color (hex, named, or 256-color index) |
| `bgColor` | `string \| number` | -- | Background color |
| `backgroundColor` | `string \| number` | -- | Alias for `bgColor` |
| `bold` | `boolean` | `false` | Bold weight |
| `dim` | `boolean` | `false` | Dim/faint rendering |
| `dimColor` | `boolean` | `false` | Alias for `dim` |
| `italic` | `boolean` | `false` | Italic style |
| `underline` | `boolean` | `false` | Underline decoration |
| `strikethrough` | `boolean` | `false` | Strikethrough decoration |
| `inverse` | `boolean` | `false` | Swap foreground and background |
| `wrap` | `"wrap" \| "truncate" \| "truncate-start" \| "truncate-end" \| "truncate-middle"` | `"wrap"` | Text overflow behavior |
| `align` | `"left" \| "center" \| "right"` | `"left"` | Text alignment (adds a wrapper Box) |
| `aria-label` | `string` | -- | Accessibility label |
| `aria-hidden` | `boolean` | -- | Hide from accessibility tree |

**Basic: Styled inline text**

```tsx
import { Text } from "@orchetron/storm-tui";

<Text color="#82AAFF" bold>
  Hello <Text underline>world</Text>
</Text>
```

**Advanced: Mixed formatting with truncation**

```tsx
<Text>
  <Text color="#34D399" bold>SUCCESS</Text>
  <Text dim> | </Text>
  <Text color="#D4D4D4">Operation completed in </Text>
  <Text color="#FBBF24" bold>42ms</Text>
</Text>

<Text wrap="truncate-middle" color="#808080">
  /very/long/path/to/some/deeply/nested/file/in/project/src/components/Widget.tsx
</Text>
```

---

### ScrollView

Scrollable container with hit-tested mouse scroll, keyboard navigation, optional scrollbar, stick-to-bottom, and automatic windowing for large child counts.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Scrollable content |
| `stickToBottom` | `boolean` | `false` | Auto-scroll when new content is added at bottom |
| `scrollSpeed` | `number` | `3` | Lines per mouse scroll tick |
| `scrollStateRef` | `MutableRefObject<ScrollState>` | -- | Ref to access scroll state imperatively |
| `onScroll` | `(scrollTop: number) => void` | -- | Called on scroll position change |
| `scrollbarThumbColor` | `string \| number` | -- | Scrollbar thumb color |
| `scrollbarTrackColor` | `string \| number` | -- | Scrollbar track color |
| `scrollbarChar` | `string` | -- | Custom scrollbar thumb character |
| `scrollbarTrackChar` | `string` | -- | Custom scrollbar track character |
| `maxRenderChildren` | `number` | `500` | Max children before windowing activates |
| `itemHeight` | `number` | `1` | Estimated child height for windowing calculations |
| `sticky` | `boolean` | -- | Enable sticky positioning |
| `stickyChildren` | `boolean` | -- | Enable sticky for children |
| _Plus all Box layout props_ | | | `width`, `height`, `flex`, `padding*`, `margin*`, `borderStyle`, etc. |

**Basic: Chat log with stick-to-bottom**

```tsx
import { ScrollView, Text } from "@orchetron/storm-tui";

<ScrollView flex={1} stickToBottom scrollbarThumbColor="#82AAFF">
  {messages.map((msg) => (
    <Text key={msg.id}>{msg.text}</Text>
  ))}
</ScrollView>
```

**Advanced: Controlled scroll with imperative access**

```tsx
import { ScrollView, Box, Text, Button } from "@orchetron/storm-tui";
import { useRef } from "react";
import type { ScrollState } from "@orchetron/storm-tui";

function LogViewer({ entries }: { entries: string[] }) {
  const scrollState = useRef<ScrollState | null>(null);

  return (
    <Box flexDirection="column" height={20}>
      <ScrollView
        flex={1}
        scrollStateRef={scrollState}
        stickToBottom={false}
        scrollbarThumbColor="#82AAFF"
        scrollbarTrackColor="#1E1E1E"
        borderStyle="single"
        borderColor="#505050"
        onScroll={(top) => console.log("scroll:", top)}
        maxRenderChildren={200}
        itemHeight={1}
      >
        {entries.map((entry, i) => (
          <Text key={i} color={entry.startsWith("ERROR") ? "#F87171" : "#D4D4D4"}>
            {entry}
          </Text>
        ))}
      </ScrollView>
      <Button label="Jump to bottom" onPress={() => scrollState.current?.scrollToBottom()} />
    </Box>
  );
}
```

See [Common Pitfalls](pitfalls.md#scrollview) for height constraint requirements.

---

### Overlay

Positioned overlay rendered on top of all other content. Overlays are painted in a second pass, overwriting cells from the normal element tree.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Overlay content |
| `visible` | `boolean` | `true` | Whether overlay is shown |
| `position` | `"center" \| "bottom" \| "top" \| "center-left" \| "center-right"` | `"center"` | Screen position |
| `width` | `number \| \`${number}%\`` | -- | Overlay width |
| `height` | `number` | -- | Overlay height |
| `minWidth` | `number` | -- | Minimum width |
| `maxWidth` | `number` | -- | Maximum width |
| `minHeight` | `number` | -- | Minimum height |
| `maxHeight` | `number` | -- | Maximum height |
| `borderStyle` | `"single" \| "double" \| "round" \| "bold" \| "classic"` | -- | Border style |
| `borderColor` | `string \| number` | -- | Border color |
| `padding` | `number` | -- | Padding on all sides |
| `paddingX` | `number` | -- | Horizontal padding |
| `paddingY` | `number` | -- | Vertical padding |

**Basic: Centered notification**

```tsx
import { Overlay, Text } from "@orchetron/storm-tui";

<Overlay visible={showNotification} position="center" borderStyle="round" borderColor="#82AAFF" padding={2}>
  <Text bold>Operation complete!</Text>
</Overlay>
```

**Advanced: Bottom-positioned status overlay**

```tsx
<Overlay visible={true} position="bottom" width={60} borderStyle="single" borderColor="#FBBF24" paddingX={2}>
  <Text color="#FBBF24" bold>WARNING</Text>
  <Text> Connection unstable. Retrying in {countdown}s...</Text>
</Overlay>
```

---

### Spacer

Flexible space that expands to fill available room. Equivalent to a Box with `flex={1}`. Takes no props and no children.

| Prop | Type | Default | Description |
|---|---|---|---|
| _(none)_ | | | Spacer takes no props |

**Basic: Push items apart**

```tsx
import { Box, Text, Spacer } from "@orchetron/storm-tui";

<Box flexDirection="row">
  <Text bold>Left</Text>
  <Spacer />
  <Text dim>Right</Text>
</Box>
```

**Advanced: Header with centered title**

```tsx
<Box flexDirection="row" paddingX={1}>
  <Text color="#82AAFF">storm v2.1</Text>
  <Spacer />
  <Text bold>Dashboard</Text>
  <Spacer />
  <Text dim>Ctrl+Q quit</Text>
</Box>
```

---

## Typography

### Heading

Semantic heading with four visual hierarchy levels using weight, color, and decoration to differentiate in a monospace terminal where font sizes are fixed.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `string` | -- | Heading text (required) |
| `level` | `1 \| 2 \| 3 \| 4` | `2` | Hierarchy level |
| `color` | `string \| number` | Per-level default | Override text color |
| `bold` | `boolean` | Per-level default | Override bold |
| `dim` | `boolean` | Per-level default | Override dim |
| _Plus layout props_ | | | `width`, `margin*`, `minWidth`, `maxWidth` |

Level styles: **H1** = BOLD UPPERCASE + brand color + underline decoration. **H2** = Bold + primary text. **H3** = Bold + secondary text. **H4** = Dim + secondary text.

**Basic: Page title**

```tsx
import { Heading } from "@orchetron/storm-tui";

<Heading level={1}>Server Status</Heading>
```

**Advanced: Section hierarchy**

```tsx
<Heading level={1}>System Overview</Heading>
<Heading level={2}>Active Services</Heading>
<Heading level={3}>Database cluster</Heading>
<Heading level={4}>Last checked 5 minutes ago</Heading>
```

---

### Paragraph

Block of wrapped text with consistent bottom spacing for readable document-like layouts.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Paragraph content (required) |
| `marginBottom` | `number` | `1` | Bottom margin for spacing |
| `color` | `string \| number` | -- | Text color |
| `bold` | `boolean` | -- | Bold weight |
| `dim` | `boolean` | -- | Dim rendering |

**Basic: Simple paragraph**

```tsx
import { Paragraph } from "@orchetron/storm-tui";

<Paragraph>
  Storm is a high-performance terminal UI framework built on a custom React reconciler.
</Paragraph>
```

**Advanced: Multi-paragraph document**

```tsx
<Paragraph bold color="#82AAFF">
  Welcome to the configuration wizard. This tool will guide you through initial setup.
</Paragraph>
<Paragraph>
  Each step validates your input before proceeding. Use Tab to move between fields
  and Enter to confirm selections.
</Paragraph>
<Paragraph dim marginBottom={2}>
  Press Ctrl+C at any time to cancel without saving.
</Paragraph>
```

---

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
import { TextInput } from "@orchetron/storm-tui";
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
import { Button } from "@orchetron/storm-tui";

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
import { Checkbox } from "@orchetron/storm-tui";

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
import { Switch } from "@orchetron/storm-tui";

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
import { RadioGroup } from "@orchetron/storm-tui";

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
import { Select } from "@orchetron/storm-tui";

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
import { SearchInput } from "@orchetron/storm-tui";

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
import { Form } from "@orchetron/storm-tui";

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

## Data

### Table

Bordered table with headers, auto-sized columns, optional zebra striping, and row virtualization for large datasets.

| Prop | Type | Default | Description |
|---|---|---|---|
| `columns` | `TableColumn[]` | -- | Column definitions (required) |
| `data` | `Record<string, string \| number>[]` | -- | Row data (required) |
| `headerColor` | `string \| number` | `colors.brand.primary` | Header text color |
| `stripe` | `boolean` | `false` | Alternate row background |
| `maxVisibleRows` | `number` | `100` | Max rows before virtualization |
| `scrollOffset` | `number` | `0` | Current scroll position |
| `onScrollChange` | `(offset: number) => void` | -- | Called when scroll offset changes |
| _Plus container props_ | | | `borderStyle`, `borderColor`, `padding*`, `width`, `margin*` |

**TableColumn type:**

| Property | Type | Default | Description |
|---|---|---|---|
| `key` | `string` | -- | Data field key |
| `header` | `string` | -- | Column header text |
| `width` | `number` | Auto | Fixed column width |
| `align` | `"left" \| "center" \| "right"` | `"left"` | Cell alignment |

**Basic: Simple data table**

```tsx
import { Table } from "@orchetron/storm-tui";

<Table
  columns={[
    { key: "name", header: "Name", width: 20 },
    { key: "status", header: "Status", width: 10, align: "center" },
    { key: "count", header: "Count", width: 8, align: "right" },
  ]}
  data={[
    { name: "Alpha", status: "Active", count: 42 },
    { name: "Beta", status: "Paused", count: 7 },
  ]}
/>
```

**Advanced: Striped table with custom styling**

```tsx
<Table
  columns={[
    { key: "id", header: "ID", width: 6, align: "right" },
    { key: "endpoint", header: "Endpoint", width: 30 },
    { key: "method", header: "Method", width: 8 },
    { key: "latency", header: "Latency", width: 10, align: "right" },
    { key: "status", header: "Status", width: 8, align: "center" },
  ]}
  data={apiRequests}
  stripe
  headerColor="#82AAFF"
  borderStyle="round"
  borderColor="#505050"
  maxVisibleRows={20}
  scrollOffset={scrollPos}
  onScrollChange={setScrollPos}
/>
```

---

### DataGrid

Interactive data grid with keyboard navigation, sorting, row selection, and virtualization. Up/Down navigate rows, Left/Right navigate columns, Enter on header sorts, Enter on row selects.

| Prop | Type | Default | Description |
|---|---|---|---|
| `columns` | `DataGridColumn[]` | -- | Column definitions (required) |
| `rows` | `Array<Record<string, string \| number>>` | -- | Row data (required) |
| `selectedRow` | `number` | -- | Index of selected row |
| `onSelect` | `(rowIndex: number) => void` | -- | Called on row selection |
| `sortColumn` | `string` | -- | Currently sorted column key |
| `sortDirection` | `"asc" \| "desc"` | -- | Current sort direction |
| `onSort` | `(column: string) => void` | -- | Called when header is activated |
| `isFocused` | `boolean` | `true` | Whether grid captures input |
| `headerColor` | `string \| number` | `colors.brand.primary` | Header text color |
| `selectedColor` | `string \| number` | `colors.brand.light` | Selected row color |
| `maxVisibleRows` | `number` | `100` | Max rows before virtualization |
| `onScrollChange` | `(offset: number) => void` | -- | Called when scroll offset changes |
| `aria-label` | `string` | -- | Accessibility label |
| _Plus container props_ | | | `borderStyle`, `borderColor`, `padding*`, `width`, `margin*` |

**Basic: Sortable grid**

```tsx
import { DataGrid } from "@orchetron/storm-tui";

<DataGrid
  columns={[
    { key: "name", label: "Name", width: 20 },
    { key: "size", label: "Size", width: 10, align: "right" },
  ]}
  rows={files}
  sortColumn={sortCol}
  sortDirection={sortDir}
  onSort={handleSort}
/>
```

**Advanced: Interactive file browser**

```tsx
<DataGrid
  columns={[
    { key: "icon", label: "", width: 2 },
    { key: "name", label: "Name", width: 30 },
    { key: "size", label: "Size", width: 12, align: "right" },
    { key: "modified", label: "Modified", width: 20 },
    { key: "perms", label: "Permissions", width: 12, align: "center" },
  ]}
  rows={directoryContents}
  selectedRow={selectedIdx}
  onSelect={(idx) => openFile(directoryContents[idx])}
  sortColumn={sortCol}
  sortDirection={sortDir}
  onSort={toggleSort}
  headerColor="#82AAFF"
  selectedColor="#22D3EE"
  borderStyle="single"
  borderColor="#505050"
  maxVisibleRows={25}
/>
```

---

### Tree

Hierarchical tree with expand/collapse indicators. Renders nodes with indentation and triangular markers.

| Prop | Type | Default | Description |
|---|---|---|---|
| `nodes` | `TreeNode[]` | -- | Tree node array (required) |
| `onToggle` | `(key: string) => void` | -- | Called when a node is toggled |
| `color` | `string \| number` | -- | Indicator color |

**TreeNode type:**

| Property | Type | Default | Description |
|---|---|---|---|
| `key` | `string` | -- | Unique node identifier |
| `label` | `string` | -- | Display label |
| `children` | `TreeNode[]` | -- | Child nodes |
| `expanded` | `boolean` | -- | Whether children are visible |

**Basic: Simple tree**

```tsx
import { Tree } from "@orchetron/storm-tui";

<Tree
  nodes={[
    { key: "src", label: "src/", expanded: true, children: [
      { key: "index", label: "index.ts" },
      { key: "utils", label: "utils.ts" },
    ]},
    { key: "pkg", label: "package.json" },
  ]}
  onToggle={handleToggle}
/>
```

**Advanced: Dynamic tree with toggle state**

```tsx
function FileTree({ rootNodes }: { rootNodes: TreeNode[] }) {
  const [nodes, setNodes] = useState(rootNodes);

  const handleToggle = (key: string) => {
    setNodes(toggleNode(nodes, key)); // Your toggle helper
  };

  return (
    <Box borderStyle="single" borderColor="#505050" padding={1}>
      <Tree nodes={nodes} onToggle={handleToggle} color="#82AAFF" />
    </Box>
  );
}
```

---

### ListView

Scrollable list with highlight cursor, selectable items, virtual scrolling, and overflow indicators.

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `readonly ListViewItem[]` | -- | List items (required) |
| `selectedKey` | `string` | -- | Currently selected item key |
| `onSelect` | `(key: string) => void` | -- | Called on Enter |
| `onHighlight` | `(key: string) => void` | -- | Called when highlight moves |
| `maxVisible` | `number` | `10` | Max visible items before scrolling |
| `highlightColor` | `string \| number` | `colors.brand.primary` | Highlight indicator color |
| `isFocused` | `boolean` | `true` | Whether list captures input |
| `emptyMessage` | `string` | `"No items"` | Text shown when items is empty |
| _Plus container props_ | | | `borderStyle`, `borderColor`, `padding*`, `width`, `margin*` |

**ListViewItem type:**

| Property | Type | Description |
|---|---|---|
| `key` | `string` | Unique identifier |
| `label` | `string` | Display text |
| `description` | `string` | Optional secondary text |
| `icon` | `string` | Optional icon prefix |

**Basic: Simple selectable list**

```tsx
import { ListView } from "@orchetron/storm-tui";

<ListView
  items={[
    { key: "1", label: "Create new project" },
    { key: "2", label: "Open existing project" },
    { key: "3", label: "Import from Git" },
  ]}
  onSelect={handleAction}
/>
```

**Advanced: List with descriptions and icons**

```tsx
<ListView
  items={[
    { key: "ts", label: "TypeScript", description: "Strict typed JavaScript", icon: "TS" },
    { key: "rs", label: "Rust", description: "Systems programming", icon: "RS" },
    { key: "py", label: "Python", description: "General purpose scripting", icon: "PY" },
    { key: "go", label: "Go", description: "Concurrent systems language", icon: "GO" },
  ]}
  selectedKey={selected}
  onSelect={setSelected}
  onHighlight={(key) => showPreview(key)}
  maxVisible={8}
  highlightColor="#82AAFF"
  borderStyle="round"
  borderColor="#505050"
/>
```

---

### Sparkline

Inline data visualization using Unicode block characters. Supports single-row or multi-row modes with optional labels.

| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `readonly number[]` | -- | Numeric data points (required) |
| `width` | `number` | `data.length` | Chart width in columns (max 80) |
| `height` | `number` | `1` | Chart height in rows (max 4) |
| `min` | `number` | Auto | Y-axis minimum |
| `max` | `number` | Auto | Y-axis maximum |
| `color` | `string \| number` | `colors.brand.primary` | Bar color |
| `fillColor` | `string \| number` | -- | Empty space color in multi-row mode |
| `label` | `string` | -- | Label text centered below chart |
| _Plus layout props_ | | | `margin*`, `minWidth`, `maxWidth` |

**Basic: Inline sparkline**

```tsx
import { Sparkline } from "@orchetron/storm-tui";

<Sparkline data={[4, 8, 15, 16, 23, 42, 38, 30, 25, 20]} color="#82AAFF" />
```

**Advanced: Multi-row sparkline with label**

```tsx
<Box flexDirection="row" gap={4}>
  <Box flexDirection="column">
    <Text bold>CPU Usage</Text>
    <Sparkline data={cpuHistory} width={30} height={3} color="#34D399" label="Last 30s" />
  </Box>
  <Box flexDirection="column">
    <Text bold>Memory</Text>
    <Sparkline data={memHistory} width={30} height={3} color="#FBBF24" min={0} max={100} label="% used" />
  </Box>
</Box>
```

---

### LineChart

Multi-series line chart rendered with Unicode braille characters for 2x4 sub-pixel resolution. Supports auto-scaling Y-axis, axes, legends, and multiple colored series.

| Prop | Type | Default | Description |
|---|---|---|---|
| `series` | `LineChartSeries[]` | -- | Array of data series (required) |
| `width` | `number` | -- | Chart width in columns |
| `height` | `number` | -- | Chart height in rows |
| `yMin` | `number` | Auto | Y-axis minimum |
| `yMax` | `number` | Auto | Y-axis maximum |
| `showAxes` | `boolean` | `true` | Show X and Y axes |
| `showLegend` | `boolean` | Auto (true if >1 series) | Show color legend |
| `axisColor` | `string \| number` | -- | Axis line color |
| `title` | `string` | -- | Chart title |
| _Plus layout props_ | | | `color`, `margin*`, `minWidth`, `maxWidth` |

**LineChartSeries type:**

| Property | Type | Default | Description |
|---|---|---|---|
| `data` | `number[]` | -- | Y-values |
| `color` | `string \| number` | Auto from palette | Series color |
| `name` | `string` | -- | Legend label |

**Basic: Single series**

```tsx
import { LineChart } from "@orchetron/storm-tui";

<LineChart
  series={[{ data: [10, 25, 18, 40, 35, 50, 45], name: "Requests" }]}
  width={40}
  height={10}
/>
```

**Advanced: Multi-series comparison**

```tsx
<LineChart
  series={[
    { data: latencyP50, name: "p50", color: "#34D399" },
    { data: latencyP95, name: "p95", color: "#FBBF24" },
    { data: latencyP99, name: "p99", color: "#F87171" },
  ]}
  width={60}
  height={15}
  yMin={0}
  yMax={500}
  title="Request Latency (ms)"
  axisColor="#505050"
  showLegend
  showAxes
/>
```

---

## Feedback

### Spinner

Animated loading indicator with 6 built-in styles. Uses imperative mutation and `requestRender()` for zero GC pressure animation.

| Prop | Type | Default | Description |
|---|---|---|---|
| `type` | `"dots" \| "line" \| "arc" \| "bounce" \| "braille" \| "storm"` | `"dots"` | Animation style |
| `interval` | `number` | `80` | Frame interval in milliseconds |
| `label` | `string` | -- | Text shown after spinner |
| `labelColor` | `string \| number` | -- | Label color |
| `color` | `string \| number` | `colors.brand.primary` | Spinner color |
| `bold` | `boolean` | -- | Bold spinner |
| `dim` | `boolean` | -- | Dim spinner |

**Basic: Loading spinner**

```tsx
import { Spinner } from "@orchetron/storm-tui";

<Spinner type="dots" label="Loading..." color="#82AAFF" />
```

**Advanced: Multiple spinner styles**

```tsx
<Box flexDirection="column" gap={1}>
  <Spinner type="storm" label="Analyzing codebase..." color="#82AAFF" />
  <Spinner type="braille" label="Building index..." color="#34D399" />
  <Spinner type="dots" label="Connecting..." labelColor="#808080" />
</Box>
```

---

### ProgressBar

Horizontal progress bar with block fill characters, track color, optional percentage display, and label.

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `number` | -- | Progress percentage 0-100 (required) |
| `width` | `number` | Default from theme | Bar width in columns |
| `color` | `string \| number` | `colors.brand.primary` | Filled bar color |
| `trackColor` | `string \| number` | `colors.text.dim` | Empty track color |
| `showPercent` | `boolean` | `false` | Show percentage after bar |
| `label` | `string` | -- | Label shown before bar |
| _Plus layout props_ | | | `height`, `margin*`, `minWidth`, `maxWidth` |

**Basic: Simple progress**

```tsx
import { ProgressBar } from "@orchetron/storm-tui";

<ProgressBar value={65} width={30} showPercent />
```

**Advanced: Multiple progress bars with labels**

```tsx
<Box flexDirection="column" gap={1}>
  <ProgressBar value={100} width={25} color="#34D399" label="Download " showPercent />
  <ProgressBar value={72} width={25} color="#82AAFF" label="Install  " showPercent />
  <ProgressBar value={15} width={25} color="#FBBF24" label="Configure" showPercent />
</Box>
```

---

### Badge

Colored status label rendered as `[label]`. Color is determined by variant or explicit color prop.

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | -- | Badge text (required) |
| `variant` | `"default" \| "success" \| "warning" \| "error" \| "info"` | `"default"` | Color variant |
| `color` | `string \| number` | Per-variant | Override color |
| `bold` | `boolean` | Auto (true for non-default) | Bold text |
| `dim` | `boolean` | -- | Dim text |

**Basic: Status badges**

```tsx
import { Badge } from "@orchetron/storm-tui";

<Badge label="OK" variant="success" />
<Badge label="FAIL" variant="error" />
<Badge label="v2.1" />
```

**Advanced: Status row**

```tsx
<Box flexDirection="row" gap={2}>
  <Badge label="HEALTHY" variant="success" />
  <Badge label="3 warnings" variant="warning" />
  <Badge label="prod" color="#82AAFF" bold />
  <Badge label="us-east-1" dim />
</Box>
```

---

### Toast

Temporary notification message with type-based icon and color. Supports auto-hide after a duration.

| Prop | Type | Default | Description |
|---|---|---|---|
| `message` | `string` | -- | Notification text (required) |
| `type` | `"info" \| "success" \| "warning" \| "error"` | `"info"` | Notification type (determines icon and color) |
| `visible` | `boolean` | `true` | Whether toast is shown |
| `durationMs` | `number` | `0` | Auto-hide after this many ms (0 = stay forever) |
| _Plus container props_ | | | `borderStyle`, `borderColor`, `padding*`, `width`, `margin*` |

**Basic: Success toast**

```tsx
import { Toast } from "@orchetron/storm-tui";

<Toast message="File saved successfully" type="success" />
```

**Advanced: Auto-hiding notification**

```tsx
<Box flexDirection="column">
  <Toast message="Connection lost. Retrying..." type="warning" durationMs={5000} />
  <Toast message="Build completed in 3.2s" type="success" visible={showBuildToast} durationMs={3000} />
</Box>
```

---

### Alert

Bordered attention box with type-based border coloring and optional title. Suitable for persistent messages.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Alert content (required) |
| `type` | `"success" \| "warning" \| "error" \| "info"` | `"info"` | Alert type (determines border color) |
| `title` | `string` | -- | Bold title above content |
| _Plus container props_ | | | `borderStyle`, `borderColor`, `padding*`, `width`, `margin*`, `backgroundColor` |

**Basic: Info alert**

```tsx
import { Alert, Text } from "@orchetron/storm-tui";

<Alert type="info" title="Note">
  <Text>Configuration will take effect after restart.</Text>
</Alert>
```

**Advanced: Error alert with details**

```tsx
<Alert type="error" title="Build Failed" borderStyle="round" padding={1}>
  <Text>TypeScript compilation failed with 3 errors:</Text>
  <Text color="#F87171">  src/index.ts:42 - TS2345: Argument type mismatch</Text>
  <Text color="#F87171">  src/utils.ts:18 - TS2304: Cannot find name 'foo'</Text>
  <Text color="#F87171">  src/utils.ts:25 - TS7006: Parameter implicitly has 'any' type</Text>
</Alert>
```

---

## Layout

### Card

Content container with rounded border, optional title, icon, and variant coloring. Focused state brightens the border.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Card content (required) |
| `title` | `string` | -- | Card title |
| `icon` | `string` | -- | Icon before title |
| `variant` | `"default" \| "storm" \| "success" \| "error" \| "warning"` | `"default"` | Border color variant |
| `focused` | `boolean` | `false` | Brighten border when focused |
| _Plus container props_ | | | `borderStyle`, `borderColor`, `padding*`, `width`, `margin*`, `backgroundColor` |

**Basic: Simple card**

```tsx
import { Card, Text } from "@orchetron/storm-tui";

<Card title="Server Status" variant="success">
  <Text>All systems operational</Text>
</Card>
```

**Advanced: Dashboard cards**

```tsx
<Box flexDirection="row" gap={2}>
  <Card title="CPU" icon="*" variant="storm" focused={activePanel === "cpu"}>
    <Text bold>42%</Text>
    <Text dim>8 cores active</Text>
  </Card>
  <Card title="Memory" icon="*" variant={memUsage > 80 ? "warning" : "default"}>
    <Text bold>{memUsage}%</Text>
    <Text dim>12.4 / 16 GB</Text>
  </Card>
  <Card title="Disk" icon="*" variant={diskFull ? "error" : "default"}>
    <Text bold>87%</Text>
    <Text dim>438 / 500 GB</Text>
  </Card>
</Box>
```

---

### Modal

Centered dialog overlay with title bar, divider, and Escape-to-close. Renders inside a `tui-overlay` at the center of the screen.

| Prop | Type | Default | Description |
|---|---|---|---|
| `visible` | `boolean` | -- | Whether modal is shown (required) |
| `title` | `string` | -- | Title bar text |
| `children` | `ReactNode` | -- | Modal content (required) |
| `onClose` | `() => void` | -- | Called on Escape key |
| _Plus container props_ | | | `borderStyle`, `borderColor`, `padding*`, `width`, `margin*`, `backgroundColor` |

**Basic: Confirmation dialog**

```tsx
import { Modal, Text, Button } from "@orchetron/storm-tui";

<Modal visible={showModal} title="Confirm" onClose={() => setShowModal(false)}>
  <Text>Are you sure you want to delete this item?</Text>
  <Box flexDirection="row" gap={2} marginTop={1}>
    <Button label="Yes" onPress={handleDelete} />
    <Button label="No" onPress={() => setShowModal(false)} />
  </Box>
</Modal>
```

**Advanced: Settings modal**

```tsx
<Modal
  visible={showSettings}
  title="Settings"
  onClose={() => setShowSettings(false)}
  width={60}
  borderStyle="round"
  borderColor="#82AAFF"
  padding={1}
>
  <Form
    fields={[
      { key: "apiKey", label: "API Key", type: "password", required: true },
      { key: "model", label: "Model", placeholder: "llama-3.1-70b" },
      { key: "maxTokens", label: "Max Tokens", type: "number", placeholder: "4096" },
    ]}
    onSubmit={(values) => { saveSettings(values); setShowSettings(false); }}
    submitLabel="Save"
  />
</Modal>
```

Modal automatically traps focus. See [Common Pitfalls](pitfalls.md#focus) for focus management details.

---

### Tabs

Horizontal tab bar with keyboard navigation. Active tab is bold and colored, others are dim. Left/Right arrows and number keys navigate.

| Prop | Type | Default | Description |
|---|---|---|---|
| `tabs` | `Tab[]` | -- | Array of `{ key, label }` (required) |
| `activeKey` | `string` | -- | Currently active tab key (required) |
| `onChange` | `(key: string) => void` | -- | Called on tab switch |
| `isFocused` | `boolean` | `true` | Whether tabs capture input |
| `color` | `string \| number` | `colors.brand.primary` | Active tab color |
| `aria-label` | `string` | -- | Accessibility label |
| _Plus layout props_ | | | `width`, `height`, `margin*`, `minWidth`, `maxWidth` |

**Basic: Simple tab bar**

```tsx
import { Tabs } from "@orchetron/storm-tui";

<Tabs
  tabs={[
    { key: "overview", label: "Overview" },
    { key: "logs", label: "Logs" },
    { key: "config", label: "Config" },
  ]}
  activeKey={activeTab}
  onChange={setActiveTab}
/>
```

**Advanced: Tab bar with content switching**

```tsx
function Dashboard() {
  const [tab, setTab] = useState("overview");

  return (
    <Box flexDirection="column">
      <Tabs
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "metrics", label: "Metrics" },
          { key: "alerts", label: "Alerts" },
        ]}
        activeKey={tab}
        onChange={setTab}
        color="#82AAFF"
      />
      <Box flex={1} marginTop={1}>
        {tab === "overview" && <OverviewPanel />}
        {tab === "metrics" && <MetricsPanel />}
        {tab === "alerts" && <AlertsPanel />}
      </Box>
    </Box>
  );
}
```

---

### TabbedContent

Combined tab bar and content panels. Renders tabs at the top with automatic content switching based on the active key.

| Prop | Type | Default | Description |
|---|---|---|---|
| `tabs` | `Array<{ label: string; key: string }>` | -- | Tab definitions (required) |
| `activeKey` | `string` | -- | Currently active tab key (required) |
| `onTabChange` | `(key: string) => void` | -- | Called on tab switch |
| `children` | `ReactNode` | -- | Content panels (matched by key) |
| `tabColor` | `string \| number` | `colors.text.dim` | Inactive tab color |
| `activeTabColor` | `string \| number` | `colors.brand.primary` | Active tab color |
| _Plus container props_ | | | `borderStyle`, `borderColor`, `padding*`, `width`, `margin*` |

**Basic: Tabbed panels**

```tsx
import { TabbedContent, Text } from "@orchetron/storm-tui";

<TabbedContent
  tabs={[
    { key: "code", label: "Code" },
    { key: "tests", label: "Tests" },
  ]}
  activeKey={activeTab}
  onTabChange={setActiveTab}
>
  {activeTab === "code" && <Text>Source code viewer</Text>}
  {activeTab === "tests" && <Text>Test runner output</Text>}
</TabbedContent>
```

**Advanced: Styled tabbed content**

```tsx
<TabbedContent
  tabs={[
    { key: "request", label: "Request" },
    { key: "response", label: "Response" },
    { key: "headers", label: "Headers" },
  ]}
  activeKey={activeTab}
  onTabChange={setActiveTab}
  activeTabColor="#82AAFF"
  tabColor="#505050"
  borderStyle="round"
  borderColor="#505050"
  padding={1}
>
  {activeTab === "request" && <RequestEditor />}
  {activeTab === "response" && <ResponseViewer />}
  {activeTab === "headers" && <HeadersTable />}
</TabbedContent>
```

---

### Accordion

Collapsible sections with keyboard navigation. Up/Down arrows navigate between headers, Enter/Space toggles. Supports exclusive mode where only one section is open at a time.

| Prop | Type | Default | Description |
|---|---|---|---|
| `sections` | `AccordionSection[]` | -- | Section definitions (required) |
| `activeKeys` | `string[]` | `[]` | Keys of currently open sections |
| `onToggle` | `(key: string) => void` | -- | Called when a section is toggled |
| `exclusive` | `boolean` | -- | Only allow one section open at a time |
| `color` | `string \| number` | `colors.brand.primary` | Indicator color |
| _Plus container props_ | | | `borderStyle`, `borderColor`, `padding*`, `width`, `margin*` |

**AccordionSection type:**

| Property | Type | Description |
|---|---|---|
| `key` | `string` | Unique section identifier |
| `title` | `string` | Section header text |
| `content` | `ReactNode` | Section body content |

**Basic: FAQ accordion**

```tsx
import { Accordion, Text } from "@orchetron/storm-tui";

<Accordion
  sections={[
    { key: "install", title: "Installation", content: <Text>npm install @orchetron/storm-tui</Text> },
    { key: "usage", title: "Basic Usage", content: <Text>Import components and render with storm.</Text> },
  ]}
  activeKeys={openSections}
  onToggle={handleToggle}
/>
```

**Advanced: Exclusive accordion with styling**

```tsx
function SettingsAccordion() {
  const [open, setOpen] = useState<string[]>(["general"]);

  const handleToggle = (key: string) => {
    setOpen(open.includes(key) ? [] : [key]); // Exclusive: one at a time
  };

  return (
    <Accordion
      sections={[
        { key: "general", title: "General", content: <GeneralSettings /> },
        { key: "editor", title: "Editor", content: <EditorSettings /> },
        { key: "terminal", title: "Terminal", content: <TerminalSettings /> },
        { key: "advanced", title: "Advanced", content: <AdvancedSettings /> },
      ]}
      activeKeys={open}
      onToggle={handleToggle}
      exclusive
      color="#82AAFF"
      borderStyle="round"
      borderColor="#505050"
      padding={1}
    />
  );
}
```

---

## Testing Utilities

Import from `@orchetron/storm-tui/testing`:

| Export | Description |
|---|---|
| `renderForTest(element)` | Render to a virtual buffer without a real terminal |
| `expectOutput(result)` | Assertion helper for rendered output |
| `createSnapshot(result)` | Create a text snapshot of the buffer |
| `compareSnapshot(a, b)` | Compare two snapshots |
| `renderToSvg(element, options?)` | Render to SVG for visual regression testing |
| `TestInputManager` | Simulated input for testing |
| `MockInputManager` | Mock input manager |
| `createStormMatchers()` | Custom vitest/jest matchers |

---

## Showcase Templates

Import from `@orchetron/storm-tui/templates`:

| Template | Category |
|---|---|
| `ShowcasePrimitives` | Text, Badge, Tag, Avatar, Gradient |
| `ShowcaseInput` | TextInput, Form, Calendar, FilePicker |
| `ShowcaseSelection` | Select, Checkbox, Radio, Switch |
| `ShowcaseData` | Table, DataGrid, Tree, Sparkline |
| `ShowcaseFeedback` | Spinner, ProgressBar, Gauge, Toast |
| `ShowcaseLayout` | ScrollView, Modal, Tabs, Accordion |
| `ShowcaseVisual` | Card, Shadow, GradientBorder, Image |
| `ShowcaseAdvanced` | VirtualList, KeyboardHelp, Form |
| `ShowcaseAI` | TokenStream, CostTracker, ContextWindow |
| `ShowcaseChat` | MessageBubble, StreamingText, CommandBlock |

Run showcases:

```bash
npx tsx examples/run-showcase.ts primitives
npx tsx examples/run-showcase.ts input
npx tsx examples/run-showcase.ts data
npx tsx examples/run-showcase.ts feedback
npx tsx examples/run-showcase.ts layout
npx tsx examples/run-showcase.ts ai
```

---

## Additional Components (A-L)

### AnimatePresence

Manages mount/unmount animations for children. Keeps removed children rendered long enough for the exit animation to play.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Child elements (must have unique `key` props) |
| `exitType` | `"fade" \| "slide-up" \| "collapse"` | `"fade"` | Animation type for exiting children |
| `exitDuration` | `number` | personality default | Duration of exit animation in ms |

```tsx
<AnimatePresence exitType="fade" exitDuration={200}>
  {items.map(item => (
    <Box key={item.id}><Text>{item.label}</Text></Box>
  ))}
</AnimatePresence>
```

---

### AreaChart

Braille-based area chart that fills below each line. Supports multiple series, stacked mode, axes, and legend.

| Prop | Type | Default | Description |
|---|---|---|---|
| `series` | `ChartSeries[]` | -- | Data series to plot |
| `width` | `number` | `60` | Chart width in cells |
| `height` | `number` | `10` | Chart height in rows |
| `yMin` | `number` | auto | Minimum Y value |
| `yMax` | `number` | auto | Maximum Y value |
| `showAxes` | `boolean` | `true` | Show Y-axis labels and X-axis line |
| `showLegend` | `boolean` | auto | Show series legend (auto if >1 series) |
| `axisColor` | `string \| number` | dim | Axis color |
| `title` | `string` | -- | Chart title |
| `xLabels` | `string[]` | -- | X-axis labels |
| `fillDensity` | `"full" \| "sparse"` | `"full"` | Fill density below lines |
| `stacked` | `boolean` | `false` | Stack series cumulatively |

```tsx
<AreaChart
  series={[{ name: "Revenue", data: [10, 20, 35, 28, 42], color: "#4ade80" }]}
  width={50} height={8} title="Revenue"
/>
```

---

### Avatar

User avatar/initials display. Small renders `(JD)`, large renders a 3-line bordered box.

| Prop | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | -- | User name (initials extracted automatically) |
| `size` | `"small" \| "large"` | `"small"` | Display size |
| `color` | `string \| number` | brand primary | Text/border color |
| `renderInitials` | `(initials, size) => ReactNode` | -- | Custom initials renderer |

```tsx
<Avatar name="Jane Doe" size="large" />
```

---

### BarChart

Vertical and horizontal bar charts with stacking, grouping, and interactive selection.

| Prop | Type | Default | Description |
|---|---|---|---|
| `bars` | `BarData[]` | -- | Simple bars: `[{label, value, color?}]` |
| `stacked` | `StackedBarData[]` | -- | Stacked bars with segments |
| `grouped` | `{series, labels}` | -- | Grouped bars (side by side) |
| `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | Bar orientation |
| `showValues` | `boolean` | -- | Show value labels on bars |
| `width` | `number` | -- | Chart width |
| `height` | `number` | -- | Chart height |
| `color` | `string \| number` | -- | Default bar color |
| `barGap` | `number` | -- | Gap between bars |
| `barWidth` | `number` | -- | Bar width in characters |
| `title` | `string` | -- | Chart title |
| `showAxes` | `boolean` | -- | Show axes |
| `interactive` | `boolean` | -- | Enable arrow key selection |
| `isFocused` | `boolean` | -- | Whether chart has focus |
| `animated` | `boolean` | -- | Animate bar height transitions |

```tsx
<BarChart
  bars={[
    { label: "Mon", value: 12 },
    { label: "Tue", value: 28 },
    { label: "Wed", value: 19 },
  ]}
  width={40} height={10} showValues
/>
```

---

### Calendar

Month calendar view with keyboard navigation, date range highlighting, and disabled dates.

| Prop | Type | Default | Description |
|---|---|---|---|
| `year` | `number` | -- | Year to display |
| `month` | `number` | -- | Month (1-12) |
| `selectedDay` | `number` | -- | Currently selected day |
| `onSelect` | `(day: number) => void` | -- | Day selection callback |
| `onMonthChange` | `(year, month) => void` | -- | Month navigation callback |
| `selectedColor` | `string \| number` | brand primary | Selected day color |
| `today` | `Date` | auto | Override today highlight |
| `isFocused` | `boolean` | `true` | Enable keyboard navigation |
| `rangeStart` | `Date` | -- | Start of highlight range |
| `rangeEnd` | `Date` | -- | End of highlight range |
| `disabledDates` | `(date: Date) => boolean` | -- | Predicate for disabled dates |
| `weekStartsOn` | `0 \| 1` | `0` | Week start: 0=Sunday, 1=Monday |

```tsx
<Calendar year={2026} month={3} selectedDay={15} onSelect={setDay} />
```

---

### Canvas

Declarative visualization component for AI-generated diagrams. Takes a JSON-serializable tree of nodes and edges.

| Prop | Type | Default | Description |
|---|---|---|---|
| `nodes` | `CanvasNode[]` | -- | Tree of nodes to render |
| `edges` | `CanvasEdge[]` | `[]` | Connections between nodes |
| `title` | `string` | -- | Canvas title |
| `direction` | `"horizontal" \| "vertical"` | `"vertical"` | Layout direction |
| `width` | `number` | -- | Canvas width |
| `borderStyle` | `"round" \| "single" \| "double" \| "heavy" \| "none"` | -- | Outer border style |
| `borderColor` | `string \| number` | -- | Outer border color |
| `padding` | `number` | -- | Inner padding |

```tsx
<Canvas
  title="Architecture"
  nodes={[
    { id: "api", type: "box", label: "API Gateway" },
    { id: "svc", type: "box", label: "Service" },
  ]}
  edges={[{ from: "api", to: "svc" }]}
/>
```

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

### Collapsible

Expand/collapse section with title. Supports controlled and uncontrolled modes with optional animation.

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | -- | Section title |
| `expanded` | `boolean` | -- | Controlled expanded state |
| `onToggle` | `(expanded: boolean) => void` | -- | Toggle callback |
| `children` | `ReactNode` | -- | Collapsible content |
| `animated` | `boolean` | `false` | Animate expand/collapse transitions |
| `collapseHint` | `string` | personality default | Hint text when collapsed |
| `renderHeader` | `(props) => ReactNode` | -- | Custom header renderer |

```tsx
<Collapsible title="Details" expanded={open} onToggle={setOpen}>
  <Text>Hidden content here</Text>
</Collapsible>
```

---

### ConfirmDialog

Confirmation dialog overlay with yes/no or multi-action buttons. Focus-trapped with optional auto-timeout.

| Prop | Type | Default | Description |
|---|---|---|---|
| `visible` | `boolean` | -- | Show/hide the dialog |
| `message` | `string` | -- | Dialog message |
| `onConfirm` | `() => void` | -- | Confirm callback (Y key) |
| `onCancel` | `() => void` | -- | Cancel callback (N/Esc key) |
| `confirmLabel` | `string` | `"Yes"` | Confirm button label |
| `cancelLabel` | `string` | `"No"` | Cancel button label |
| `type` | `"info" \| "warning" \| "danger"` | `"info"` | Border color variant |
| `timeoutMs` | `number` | -- | Auto-fire after N ms |
| `timeoutAction` | `"confirm" \| "cancel"` | `"cancel"` | Action on timeout |
| `actions` | `ConfirmDialogAction[]` | -- | Multi-action buttons (overrides confirm/cancel) |

```tsx
<ConfirmDialog
  visible={showDialog}
  message="Delete this file?"
  type="danger"
  onConfirm={handleDelete}
  onCancel={() => setShowDialog(false)}
/>
```

---

### ContentSwitcher

Shows one child at a time by index. Supports fade and slide transitions.

| Prop | Type | Default | Description |
|---|---|---|---|
| `activeIndex` | `number` | -- | Index of the visible child |
| `children` | `ReactNode` | -- | Child elements to switch between |
| `transition` | `"none" \| "fade" \| "slide"` | `"none"` | Transition effect when switching |

```tsx
<ContentSwitcher activeIndex={tab}>
  <Text>Tab A content</Text>
  <Text>Tab B content</Text>
  <Text>Tab C content</Text>
</ContentSwitcher>
```

---

### DiffView

Inline unified diff viewer with colored lines, gutter line numbers, hunk navigation (n/N), word-level highlighting, and collapsible context.

| Prop | Type | Default | Description |
|---|---|---|---|
| `diff` | `string` | -- | Raw unified diff string |
| `lines` | `DiffLine[]` | -- | Pre-parsed diff lines |
| `showLineNumbers` | `boolean` | `true` | Show gutter line numbers |
| `contextLines` | `number` | all | Lines of context around changes |
| `addedColor` | `string` | green | Color for added lines |
| `removedColor` | `string` | red | Color for removed lines |
| `isFocused` | `boolean` | `false` | Enable keyboard navigation |
| `filePath` | `string` | -- | File path header |
| `wordDiff` | `boolean` | `false` | Word-level diff highlighting |

```tsx
<DiffView diff={gitDiffOutput} isFocused wordDiff contextLines={3} />
```

---

### Diagram

Renders flowcharts and architecture diagrams using box-drawing characters and ANSI colors. Supports DAGs with fan-out and merge.

| Prop | Type | Default | Description |
|---|---|---|---|
| `nodes` | `DiagramNode[]` | -- | Nodes with id, label, optional sublabel/color/width |
| `edges` | `DiagramEdge[]` | -- | Edges with from/to ids and optional label |
| `direction` | `"horizontal" \| "vertical"` | `"horizontal"` | Flow direction |
| `nodeStyle` | `"round" \| "single" \| "double" \| "heavy"` | -- | Node border style |
| `arrowChar` | `string` | auto | Arrow character |
| `gapX` | `number` | `4` | Horizontal gap between nodes |
| `gapY` | `number` | `2` | Vertical gap between rows |
| `color` | `string \| number` | -- | Default node color |
| `edgeColor` | `string \| number` | -- | Arrow/line color |

```tsx
<Diagram
  nodes={[
    { id: "a", label: "Start" },
    { id: "b", label: "Process" },
    { id: "c", label: "End" },
  ]}
  edges={[{ from: "a", to: "b" }, { from: "b", to: "c" }]}
/>
```

---

### Digits

Large styled number and letter display using 3x5 block characters. Renders digits, colons, periods, dashes, spaces, and A-Z.

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string` | -- | Characters to display (digits, letters, punctuation) |
| `color` | `string \| number` | -- | Text color |
| `bold` | `boolean` | -- | Bold rendering |
| `dim` | `boolean` | -- | Dim rendering |

```tsx
<Digits value="12:34" color="#82AAFF" />
```

---

### DirectoryTree

Filesystem tree browser with expand/collapse, tree connectors, and keyboard navigation.

| Prop | Type | Default | Description |
|---|---|---|---|
| `rootPath` | `string` | -- | Root directory path |
| `onSelect` | `(path: string) => void` | -- | File/dir selection callback |
| `showHidden` | `boolean` | -- | Show hidden files (dotfiles) |
| `showFiles` | `boolean` | -- | Show files (not just directories) |
| `fileColor` | `string \| number` | -- | File name color |
| `dirColor` | `string \| number` | -- | Directory name color |
| `isFocused` | `boolean` | -- | Enable keyboard navigation |
| `renderEntry` | `(entry, state) => ReactNode` | -- | Custom entry renderer |

```tsx
<DirectoryTree rootPath="/src" onSelect={openFile} showFiles isFocused />
```

---

### Divider

Horizontal line that fills available width with configurable style.

| Prop | Type | Default | Description |
|---|---|---|---|
| `style` | `"solid" \| "dotted" \| "dashed"` | `"solid"` | Line style |
| `color` | `string` | divider color | Line color |
| `width` | `number` | `200` | Line width in characters |

```tsx
<Divider style="dashed" />
```

---

### ErrorBoundary

React Error Boundary that catches render errors in the child tree and shows fallback UI.

| Prop | Type | Default | Description |
|---|---|---|---|
| `fallback` | `ReactNode \| (error, reset) => ReactNode` | error message | Fallback UI or render function |
| `onError` | `(error, errorInfo) => void` | -- | Error callback |
| `children` | `ReactNode` | -- | Child elements |

```tsx
<ErrorBoundary fallback={(err, reset) => <Text color="red">{err.message}</Text>}>
  <MyComponent />
</ErrorBoundary>
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

### FocusGroup

Groups focusable children and manages arrow-key or tab navigation within the group. Supports focus trapping for modals.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Child elements |
| `id` | `string` | auto | Unique group ID |
| `trap` | `boolean` | `false` | Trap Tab cycling within group |
| `direction` | `"vertical" \| "horizontal"` | -- | Arrow key navigation direction |
| `onFocusChange` | `(index: number) => void` | -- | Focus change callback |
| `isActive` | `boolean` | `true` | Whether the group is interactive |

```tsx
<FocusGroup direction="vertical" trap>
  <Button>Option A</Button>
  <Button>Option B</Button>
</FocusGroup>
```

---

### Footer

Full-width footer bar with a top border. Supports key bindings display and left/right content slots.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Footer content |
| `borderStyle` | `"single" \| "double" \| "none"` | -- | Top border style |
| `width` | `number` | -- | Footer width |
| `bindings` | `FooterBinding[]` | -- | Key bindings `[{key, label}]` |
| `left` | `string \| ReactNode` | -- | Left-aligned content |
| `right` | `string \| ReactNode` | -- | Right-aligned content |

```tsx
<Footer bindings={[{ key: "q", label: "Quit" }, { key: "?", label: "Help" }]} />
```

---

### Gauge

Visual gauge display using graduated block characters (bar mode) or braille semi-circular arc (arc mode). Supports thresholds.

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `number` | -- | Gauge value (0-100) |
| `label` | `string` | -- | Label text |
| `color` | `string \| number` | -- | Bar/arc color |
| `width` | `number` | -- | Gauge width |
| `thresholds` | `GaugeThreshold[]` | -- | Color breakpoints `[{value, color}]` |
| `showValue` | `boolean` | -- | Show numeric percentage |
| `variant` | `"bar" \| "arc"` | `"bar"` | Display variant |
| `renderValue` | `(value, label?) => ReactNode` | -- | Custom value renderer |

```tsx
<Gauge value={72} label="CPU" width={30} showValue thresholds={[{ value: 80, color: "red" }]} />
```

---

### GlowText

Text with glow effect. Three intensity levels with optional pulse animation.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `string` | -- | Text content |
| `intensity` | `"low" \| "medium" \| "high"` | `"medium"` | Glow intensity |
| `color` | `string \| number` | `"#7B5EFF"` | Glow color |
| `animate` | `boolean` | `false` | Pulse animation |
| `animateInterval` | `number` | `400` | Pulse interval in ms |

```tsx
<GlowText intensity="high" color="#82AAFF">Storm TUI</GlowText>
```

---

### Gradient

Text with color gradient. Interpolates between an array of hex colors across characters or lines.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `string` | -- | Text content |
| `colors` | `string[]` | -- | Array of hex color stops |
| `direction` | `"horizontal" \| "vertical"` | `"horizontal"` | Gradient direction |

```tsx
<Gradient colors={["#D4A053", "#6DBF8B", "#82AAFF"]}>Storm Gradient Text</Gradient>
```

---

### GradientBorder

Box with gradient-colored border characters transitioning from top-left to bottom-right.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Box content |
| `colors` | `[string, string]` | `["#7B5EFF", "#6DBF8B"]` | Gradient from/to colors |
| `width` | `number \| string` | `40` | Box width |
| `padding` | `number` | `1` | Inner padding |

```tsx
<GradientBorder colors={["#FF6B6B", "#4ECDC4"]} width={50}>
  <Text>Fancy border</Text>
</GradientBorder>
```

---

### GradientProgress

Progress bar with multi-stop color gradient on the filled portion and soft falloff edge.

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `number` | -- | Progress value (0-100) |
| `width` | `number` | -- | Bar width |
| `colors` | `string[]` | violet to mint | Multi-stop gradient colors |
| `fromColor` | `string` | -- | (deprecated) Start color |
| `toColor` | `string` | -- | (deprecated) End color |
| `showPercentage` | `boolean` | -- | Show percentage label |
| `label` | `string` | -- | Label text |

```tsx
<GradientProgress value={65} width={40} colors={["#9B7DFF", "#6DFFC1"]} showPercentage />
```

---

### Header

Full-width header bar with title, optional subtitle, and thick border lines.

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | -- | Header title |
| `subtitle` | `string` | -- | Subtitle (dim, after separator) |
| `borderStyle` | `"single" \| "double" \| "none"` | personality default | Border line style |
| `width` | `number` | -- | Header width |
| `right` | `string \| ReactNode` | -- | Right-aligned content |
| `showBorder` | `boolean` | `true` | Show border lines |

```tsx
<Header title="Dashboard" subtitle="v2.1" right="10:30 AM" />
```

---

### Heatmap

Colored grid for 2D data visualization with interpolated background colors. Supports interactive cell cursor and tooltips.

| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `number[][]` | -- | 2D data: `data[row][col]` |
| `rowLabels` | `string[]` | -- | Row labels (left side) |
| `colLabels` | `string[]` | -- | Column labels (bottom) |
| `colorStops` | `string[]` | -- | Multi-stop color gradient |
| `colors` | `[string, string]` | -- | (deprecated) Two-color ramp |
| `showValues` | `boolean` | -- | Show numeric values in cells |
| `cellWidth` | `number` | `3` | Cell width in characters |
| `title` | `string` | -- | Chart title |
| `interactive` | `boolean` | -- | Enable arrow key cursor |
| `isFocused` | `boolean` | -- | Whether chart has focus |

```tsx
<Heatmap
  data={[[1, 3, 5], [2, 4, 6], [7, 8, 9]]}
  rowLabels={["A", "B", "C"]}
  colorStops={["#1a1a2e", "#82AAFF", "#4ade80"]}
  showValues
/>
```

---

### Histogram

Distribution visualization from raw data. Automatically bins and renders as vertical bar chart with optional mean/median markers.

| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `number[]` | -- | Raw data values to bin |
| `bins` | `number` | auto | Number of bins |
| `color` | `string \| number` | -- | Bar color |
| `showCounts` | `boolean` | -- | Show bin count above each bar |
| `title` | `string` | -- | Chart title |
| `width` | `number` | -- | Chart width |
| `height` | `number` | -- | Chart height |
| `showMean` | `boolean` | -- | Show vertical mean line |
| `showMedian` | `boolean` | -- | Show vertical median line |
| `cumulative` | `boolean` | -- | Cumulative distribution mode |

```tsx
<Histogram data={[1, 2, 2, 3, 3, 3, 4, 5]} bins={5} width={40} height={8} showMean />
```

---

### Image

Multi-protocol inline image component. Supports Kitty Graphics, iTerm2, and a built-in Unicode block renderer with optional chafa-wasm acceleration.

| Prop | Type | Default | Description |
|---|---|---|---|
| `src` | `string` | -- | Image file path |
| `width` | `number` | -- | Display width in cells |
| `height` | `number` | -- | Display height in rows |
| `protocol` | `"kitty" \| "iterm2" \| "sixel" \| "block" \| "auto"` | `"auto"` | Rendering protocol |
| `alt` | `string` | -- | Alt text |
| `preserveAspectRatio` | `boolean` | -- | Maintain aspect ratio |
| `basePath` | `string` | -- | Base path for relative src |

```tsx
<Image src="./logo.png" width={40} height={20} protocol="auto" alt="Logo" />
```

---

### InlineDiff

Side-by-side single-line diff display. Shows removed characters in red strikethrough and added characters in green bold.

| Prop | Type | Default | Description |
|---|---|---|---|
| `before` | `string` | -- | Original text |
| `after` | `string` | -- | Changed text |
| `color` | `string` | -- | Base text color |

```tsx
<InlineDiff before="hello world" after="hello there" />
```

---

### Kbd

Keyboard key display. Renders a key label in brackets with bold text, e.g. `[Ctrl+C]`.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `string` | -- | Key label (e.g. `"Ctrl+C"`) |
| `color` | `string \| number` | secondary | Text color |
| `bold` | `boolean` | `true` | Bold key label |
| `dim` | `boolean` | -- | Dim rendering |

```tsx
<Kbd>Ctrl+C</Kbd>
```

---

### KeyboardHelp

Horizontal keybinding help bar. Displays key-label pairs with configurable separator, optional context header, and multi-column layout.

| Prop | Type | Default | Description |
|---|---|---|---|
| `bindings` | `Array<{key, label}>` | -- | Key bindings to display |
| `separator` | `string` | `" · "` | Separator between bindings |
| `keyColor` | `string \| number` | brand primary | Key text color |
| `context` | `string` | -- | Context header label |
| `columns` | `number` | `0` | Column count (0 = single row) |

```tsx
<KeyboardHelp bindings={[
  { key: "↑↓", label: "Navigate" },
  { key: "Enter", label: "Select" },
  { key: "q", label: "Quit" },
]} />
```

---

### LightningPulse

Storm's signature gesture. A full-width amber line that flashes briefly then fades to dim.

| Prop | Type | Default | Description |
|---|---|---|---|
| `active` | `boolean` | -- | Trigger a flash-then-fade cycle |
| `color` | `string` | personality brand primary | Pulse color |
| `width` | `number` | screen width | Width in columns |

```tsx
<LightningPulse active={showPulse} />
```

---

### Link

Terminal hyperlink using OSC 8 escape sequences. Clickable in supporting terminals.

| Prop | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | -- | Link URL |
| `children` | `ReactNode` | -- | Link text |
| `color` | `string \| number` | personality link color | Text color |
| `bold` | `boolean` | -- | Bold text |
| `dim` | `boolean` | -- | Dim text |

```tsx
<Link url="https://example.com">Visit Example</Link>
```

---

## Additional Components (M-Z)

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

### Menu

Vertical menu with keyboard navigation, shortcuts, separators, disabled items, icons, and nested submenus.

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `MenuItem[]` | -- | Menu items (label, value, shortcut, disabled, separator, icon, children) |
| `onSelect` | `(value: string) => void` | -- | Called when an item is selected |
| `isFocused` | `boolean` | `true` | Whether the menu accepts input |
| `activeColor` | `string \| number` | `colors.brand.primary` | Color of the active item |
| `maxVisible` | `number` | -- | Max visible items before scrolling |
| `renderItem` | `(item, state) => ReactNode` | -- | Custom item renderer |
| `aria-label` | `string` | -- | Accessibility label |

Compound API: `Menu.Root`, `Menu.Item`, `Menu.Separator`, `Menu.Submenu`.

```tsx
<Menu
  items={[
    { label: "New File", value: "new", shortcut: "n", icon: "+" },
    { label: "Open", value: "open", shortcut: "o" },
    { separator: true, label: "", value: "" },
    { label: "Quit", value: "quit", shortcut: "q" },
  ]}
  onSelect={(val) => handleAction(val)}
/>
```

---

### Newline

Renders empty lines for spacing.

| Prop | Type | Default | Description |
|---|---|---|---|
| `count` | `number` | `1` | Number of empty lines to render |

```tsx
<Text>First paragraph</Text>
<Newline count={2} />
<Text>Second paragraph</Text>
```

---

### OrderedList

Numbered list with multiple numbering styles and nested item support.

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `ListItem[]` | -- | List items (string, ReactNode, or `{ content, children }`) |
| `start` | `number` | `1` | Starting number |
| `color` | `string \| number` | `colors.text.primary` | Item text color |
| `numberColor` | `string \| number` | `colors.text.secondary` | Number color |
| `style` | `"decimal" \| "alpha" \| "Alpha" \| "roman" \| "Roman"` | `"decimal"` | Numbering style |
| `reversed` | `boolean` | `false` | Count down instead of up |
| `renderItem` | `(item, index, numbering) => ReactNode` | -- | Custom item renderer |

```tsx
<OrderedList
  items={["First step", "Second step", "Third step"]}
  style="roman"
/>
```

---

### Paginator

Page indicator with dots, numbers, or fraction display and keyboard navigation.

| Prop | Type | Default | Description |
|---|---|---|---|
| `total` | `number` | -- | Total number of pages |
| `current` | `number` | -- | Current page (0-based) |
| `style` | `"dots" \| "numbers" \| "fraction"` | `"dots"` | Display style |
| `onPageChange` | `(page: number) => void` | -- | Called on page change |
| `isFocused` | `boolean` | `false` | Enable keyboard navigation |
| `renderPage` | `(page, state) => ReactNode` | -- | Custom page indicator renderer |
| `aria-label` | `string` | -- | Accessibility label |

```tsx
<Paginator total={5} current={currentPage} onPageChange={setPage} style="dots" isFocused />
```

---

### Placeholder

Filler widget for prototyping layouts. Shows its dimensions with dim dots and optional label. Supports shimmer animation and multiple shapes.

| Prop | Type | Default | Description |
|---|---|---|---|
| `width` | `number` | `20` | Width in characters |
| `height` | `number` | `3` | Height in rows |
| `label` | `string` | -- | Centered label text |
| `color` | `string \| number` | `colors.text.dim` | Dot/text color |
| `loading` | `boolean` | `false` | Enable shimmer animation |
| `shape` | `"rectangle" \| "text" \| "circle" \| "card"` | `"rectangle"` | Placeholder shape |

```tsx
<Placeholder width={30} height={5} label="Sidebar" loading shape="card" />
```

---

### Pretty

JSON/object pretty-printer with syntax coloring and collapsible nodes.

| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | `unknown` | -- | Data to display |
| `indent` | `number` | `2` | Indentation width |
| `color` | `boolean` | `true` | Enable syntax coloring |
| `maxDepth` | `number` | `5` | Maximum nesting depth |
| `interactive` | `boolean` | `false` | Enable collapse/expand with Enter/Space |
| `isFocused` | `boolean` | `false` | Whether focused for keyboard navigation |
| `searchQuery` | `string` | -- | Highlight matching text (case-insensitive) |
| `renderValue` | `(value, path, depth) => ReactNode \| null` | -- | Custom value renderer |

Compound API: `Pretty.Root`, `Pretty.Node`.

```tsx
<Pretty data={{ name: "Storm", version: 1, features: ["fast", "reactive"] }} interactive isFocused />
```

---

### RevealTransition

Animates children appearing with fade or charge effect.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Content to reveal |
| `visible` | `boolean` | -- | Whether content is visible |
| `type` | `"fade" \| "charge"` | `"fade"` | Animation type |
| `durationMs` | `number` | personality default | Animation duration |

```tsx
<RevealTransition visible={isReady} type="charge" durationMs={300}>
  <Text>Content loaded!</Text>
</RevealTransition>
```

---

### RichLog

Scrollable log viewer with styled entries, level filtering, and text search with match highlighting.

| Prop | Type | Default | Description |
|---|---|---|---|
| `entries` | `readonly LogEntry[]` | -- | Log entries (`{ text, color?, dim?, bold?, timestamp?, level? }`) |
| `maxVisible` | `number` | `10` | Max visible rows |
| `autoScroll` | `boolean` | `true` | Auto-scroll on new entries |
| `showTimestamp` | `boolean` | `false` | Show timestamp column |
| `timestampColor` | `string \| number` | `colors.text.dim` | Timestamp color |
| `isFocused` | `boolean` | `true` | Enable keyboard scrolling |
| `filterLevel` | `"debug" \| "info" \| "warn" \| "error"` | -- | Minimum log level filter |
| `searchQuery` | `string` | -- | Highlight and navigate matches (Ctrl+N/Ctrl+P) |
| `renderEntry` | `(entry, state) => ReactNode` | -- | Custom entry renderer |

Compound API: `RichLog.Root`, `RichLog.Entry`.

```tsx
<RichLog
  entries={[
    { text: "Server started", level: "info", timestamp: "12:00:01" },
    { text: "Connection failed", level: "error", timestamp: "12:00:05" },
  ]}
  showTimestamp
  filterLevel="info"
/>
```

---

### ScatterPlot

Braille-based scatter plot with multiple series, trend lines, and interactive zoom/pan.

| Prop | Type | Default | Description |
|---|---|---|---|
| `series` | `ScatterPlotSeries[]` | -- | Data series (`{ data: [x,y][], name?, color? }`) |
| `width` | `number` | `60` | Chart width in columns |
| `height` | `number` | `10` | Chart height in rows |
| `xMin` / `xMax` | `number` | auto | X-axis range overrides |
| `yMin` / `yMax` | `number` | auto | Y-axis range overrides |
| `showAxes` | `boolean` | `true` | Show axis labels |
| `showLegend` | `boolean` | auto | Show series legend |
| `title` | `string` | -- | Chart title |
| `dotSize` | `1 \| 2` | `1` | Dot size (1=single, 2=2x2 cluster) |
| `showTrend` | `boolean` | `false` | Show linear regression trend line with R-squared |
| `interactive` | `boolean` | `false` | Enable interactive mode |
| `isFocused` | `boolean` | `false` | Whether chart is focused |
| `zoomable` | `boolean` | `false` | Enable zoom (+/-) and pan (arrows) |
| `renderTooltip` | `(point, seriesIndex) => ReactNode` | -- | Custom tooltip renderer |

```tsx
<ScatterPlot
  series={[{ data: [[1,2],[3,5],[5,4],[7,8]], name: "Samples" }]}
  width={40}
  height={10}
  showTrend
/>
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

### Separator

Horizontal section separator with optional centered label.

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | -- | Centered label text |
| `style` | `"line" \| "dashed" \| "dotted" \| "storm"` | `"line"` | Line style |
| `color` | `string \| number` | `colors.divider` | Line color |
| `width` | `number` | `200` | Width (clipped by parent) |

```tsx
<Separator label="Settings" style="dashed" />
```

---

### Shadow

Drop shadow wrapper that adds visual depth with shadow characters on edges.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | -- | Content to shadow |
| `offset` | `number` | `1` | Shadow thickness in characters |
| `char` | `string` | `"░"` | Shadow character |
| `color` | `string \| number` | `"#1A2030"` | Shadow color |
| `direction` | `"bottom-right" \| "bottom" \| "right"` | `"bottom-right"` | Shadow direction |
| `width` | `number` | `20` | Bottom shadow width |
| `contentWidth` | `number` | -- | Override width for bottom shadow to match content |

```tsx
<Shadow direction="bottom-right" offset={1}>
  <Box borderStyle="single" padding={1}><Text>Elevated card</Text></Box>
</Shadow>
```

---

### Static

Renders a list of items where previously rendered items are never re-rendered. Ideal for append-only output like build logs.

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `T[]` | -- | Items to render |
| `children` | `(item: T, index: number) => ReactNode` | -- | Render function for each item |

```tsx
<Static items={completedTasks}>
  {(task, i) => <Text key={i}>{task.name} completed</Text>}
</Static>
```

---

### StatusMessage

Inline status message with type-appropriate icon and optional collapsible detail section.

| Prop | Type | Default | Description |
|---|---|---|---|
| `message` | `string` | -- | Message text |
| `type` | `"success" \| "warning" \| "error" \| "info"` | `"info"` | Status type (sets icon and color) |
| `title` | `string` | -- | Optional bold title before message |
| `detail` | `string` | -- | Collapsible detail text (toggle with Enter) |
| `isFocused` | `boolean` | `false` | Enable detail toggle |
| `renderIcon` | `(type, icon) => ReactNode` | -- | Custom icon renderer |

```tsx
<StatusMessage type="success" title="Build" message="Completed in 2.3s" />
<StatusMessage type="error" message="Connection refused" detail="ECONNREFUSED 127.0.0.1:5432" isFocused />
```

---

### Stepper

Step-by-step wizard progress indicator with horizontal and vertical orientations.

| Prop | Type | Default | Description |
|---|---|---|---|
| `steps` | `StepDef[]` | -- | Step definitions (`{ label, description? }`) |
| `activeStep` | `number` | -- | Current active step index |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Layout direction |
| `completedColor` | `string \| number` | `colors.success` | Color for completed steps |
| `activeColor` | `string \| number` | `colors.brand.primary` | Color for active step |
| `pendingColor` | `string \| number` | `colors.text.dim` | Color for pending steps |
| `renderStep` | `(step, state) => ReactNode` | -- | Custom step renderer |

Compound API: `Stepper.Root`, `Stepper.Step`.

```tsx
<Stepper
  steps={[{ label: "Install" }, { label: "Configure" }, { label: "Deploy" }]}
  activeStep={1}
  orientation="vertical"
/>
```

---

### Stopwatch

Count-up timer with configurable display format.

| Prop | Type | Default | Description |
|---|---|---|---|
| `running` | `boolean` | `true` | Whether the stopwatch is running |
| `onTick` | `(elapsedMs: number) => void` | -- | Called each tick with elapsed time |
| `format` | `"mm:ss" \| "hh:mm:ss" \| "ss.ms"` | `"mm:ss"` | Display format |
| `color` | `string \| number` | `colors.text.primary` | Text color |

```tsx
<Stopwatch running={isRunning} format="hh:mm:ss" />
```

---

### Tag

Colored label chip with filled or outlined variant and optional dismiss.

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | -- | Tag text |
| `variant` | `"filled" \| "outlined"` | `"filled"` | Visual variant |
| `color` | `string \| number` | `colors.brand.primary` | Tag color |
| `onRemove` | `() => void` | -- | Remove handler (shows dismiss indicator, fires on x/backspace) |
| `isFocused` | `boolean` | `false` | Enable keyboard dismiss |
| `renderLabel` | `(label, variant) => ReactNode` | -- | Custom label renderer |

```tsx
<Box flexDirection="row" gap={1}>
  <Tag label="typescript" color="#3178C6" />
  <Tag label="removable" onRemove={() => remove()} isFocused variant="outlined" />
</Box>
```

---

### Timer

Live elapsed time or countdown display using `useAnimation` for periodic ticks.

| Prop | Type | Default | Description |
|---|---|---|---|
| `startTime` | `number` | -- | Start timestamp (ms). Shows elapsed time. |
| `duration` | `number` | -- | Target duration (ms). With startTime, shows countdown. |
| `value` | `string` | -- | Manual value override (e.g. "01:23") |
| `interval` | `number` | `1000` | Update interval in ms |
| `color` | `string \| number` | `colors.text.primary` | Text color |
| `running` | `boolean` | `true` | Whether timer updates |
| `prefix` | `string` | -- | Text before the time display |

```tsx
<Timer startTime={Date.now()} prefix="Elapsed: " />
<Timer startTime={Date.now()} duration={60000} color="yellow" />
```

---

### Tooltip

Overlay tooltip with configurable position, auto-flip, delay, and arrow indicator.

| Prop | Type | Default | Description |
|---|---|---|---|
| `content` | `string` | -- | Tooltip text |
| `children` | `ReactNode` | -- | Target element |
| `visible` | `boolean` | `false` | Whether tooltip is shown |
| `position` | `"top" \| "bottom" \| "right" \| "left"` | `"top"` | Tooltip position |
| `color` | `string \| number` | `colors.text.secondary` | Tooltip text color |
| `maxWidth` | `number` | -- | Max tooltip width (truncates with ellipsis) |
| `delay` | `number` | `0` | Show delay in ms |
| `arrow` | `boolean` | `false` | Show arrow pointing to target |
| `targetRow` | `number` | -- | Row position for auto-flip |
| `targetCol` | `number` | -- | Column position for auto-flip |
| `renderContent` | `(content: string) => ReactNode` | -- | Custom content renderer |

```tsx
<Tooltip content="Press Enter to submit" visible={isFocused} position="bottom" arrow>
  <Button label="Submit" />
</Tooltip>
```

---

### Transition

Declarative enter/exit animation wrapper with multiple transition types.

| Prop | Type | Default | Description |
|---|---|---|---|
| `show` | `boolean` | -- | Whether children are visible |
| `type` | `"fade" \| "slide-down" \| "slide-up" \| "slide-right" \| "collapse"` | `"fade"` | Animation type |
| `enter` | `{ duration?, easing? }` | personality defaults | Enter timing config |
| `exit` | `{ duration?, easing? }` | personality defaults | Exit timing config |
| `children` | `ReactNode` | -- | Content to animate |

Easing options: `"linear"`, `"easeIn"`, `"easeOut"`, `"easeInOut"`.

```tsx
<Transition show={isOpen} type="slide-down" enter={{ duration: 200, easing: "easeOut" }}>
  <Box><Text>Animated panel</Text></Box>
</Transition>
```

---

### UnorderedList

Bulleted list with per-level markers, custom icons, and status indicators.

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `ListItem[]` | -- | Items (string, ReactNode, or `{ content, children?, icon?, status? }`) |
| `marker` | `string` | level-based | Custom bullet marker |
| `color` | `string \| number` | `colors.text.primary` | Item text color |
| `markerColor` | `string \| number` | `colors.text.secondary` | Marker color |
| `icon` | `string` | -- | Global icon for all items |
| `renderItem` | `(item, index, marker) => ReactNode` | -- | Custom item renderer |

Status values: `"success"` (green check), `"error"` (red x), `"pending"` (dim circle), `"running"` (spinner).

```tsx
<UnorderedList
  items={[
    { content: "Install deps", status: "success" },
    { content: "Build project", status: "running" },
    { content: "Deploy", status: "pending" },
  ]}
/>
```

---

### VirtualList

Efficiently renders large lists by only materializing visible items plus an overscan buffer. Supports keyboard and mouse scroll navigation.

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `readonly T[]` | -- | All list items |
| `renderItem` | `(item: T, index: number) => ReactNode` | -- | Render function per item |
| `itemHeight` | `number` | `1` | Row height per item |
| `height` | `number` | -- | Viewport height in rows |
| `width` | `number \| string` | -- | Viewport width |
| `keyExtractor` | `(item, index) => string` | -- | Unique key function |
| `onSelect` | `(item, index) => void` | -- | Called on Enter |
| `isFocused` | `boolean` | `true` | Enable keyboard/mouse input |
| `selectedIndex` | `number` | -- | Controlled selected index |
| `emptyMessage` | `string` | `"No items"` | Text shown when list is empty |

Compound API: `VirtualList.Root`, `VirtualList.Item`.

```tsx
<VirtualList
  items={Array.from({ length: 10000 }, (_, i) => `Item ${i}`)}
  renderItem={(item) => <Text>{item}</Text>}
  height={20}
  onSelect={(item) => console.log(item)}
/>
```
