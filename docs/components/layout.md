# Layout Components

Structure, containers, and layout management components.

## Layout

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
import { Modal, Text, Button } from "@orchetron/storm";

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
      { key: "model", label: "Model", placeholder: "demo-model" },
      { key: "maxTokens", label: "Max Tokens", type: "number", placeholder: "4096" },
    ]}
    onSubmit={(values) => { saveSettings(values); setShowSettings(false); }}
    submitLabel="Save"
  />
</Modal>
```

Modal automatically traps focus. See [Common Pitfalls](../pitfalls.md#7-focus-management-basics) for focus management details.

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
import { Tabs } from "@orchetron/storm";

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
import { TabbedContent, Text } from "@orchetron/storm";

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
import { Accordion, Text } from "@orchetron/storm";

<Accordion
  sections={[
    { key: "install", title: "Installation", content: <Text>npm install @orchetron/storm</Text> },
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

### Welcome

First-run welcome screen with app name, version, and getting-started hints.

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | -- | App name |
| `version` | `string` | -- | Version string |
| `hints` | `string[]` | -- | Getting-started tips |

```tsx
<Welcome title="My App" version="1.0.0" hints={["Press ? for help", "Ctrl+C to quit"]} />
```

---
[Back to Components](README.md)
