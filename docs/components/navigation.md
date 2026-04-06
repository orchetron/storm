# Navigation Components

Navigation patterns including breadcrumbs, menus, and step indicators.

## Navigation

### Breadcrumb

Navigation breadcrumb trail with separator, keyboard navigation, and collapsible middle items.

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `string[]` | -- | Path segments (required) |
| `separator` | `string` | `" › "` | Separator between items |
| `activeColor` | `string \| number` | `colors.brand.primary` | Color for the last (active) item |
| `onNavigate` | `(index: number) => void` | -- | Called when a breadcrumb item is activated |
| `isFocused` | `boolean` | `false` | Enable keyboard navigation (Left/Right + Enter) |
| `maxItems` | `number` | -- | Max visible items (middle items collapse to "...") |
| `itemsBefore` | `number` | `1` | Items to show at the start when collapsing |
| `itemsAfter` | `number` | `1` | Items to show at the end when collapsing |
| `renderItem` | `(item, state) => ReactNode` | -- | Custom item renderer |
| _Plus layout props_ | | | `width`, `height`, `margin*`, `minWidth`, `maxWidth` |

Compound API: `Breadcrumb.Root`, `Breadcrumb.Item`, `Breadcrumb.Separator`.

```tsx
<Breadcrumb items={["Home", "Projects", "storm", "src"]} onNavigate={goTo} isFocused />
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

### HelpPanel

Full-screen or overlay help panel showing categorized keybindings and descriptions. Toggled with `?` by default.

| Prop | Type | Default | Description |
|---|---|---|---|
| `sections` | `Array<{ title: string; bindings: Array<{ key: string; label: string }> }>` | -- | Help sections |
| `visible` | `boolean` | -- | Show/hide the panel |
| `onClose` | `() => void` | -- | Called on Escape |

```tsx
<HelpPanel visible={showHelp} onClose={() => setShowHelp(false)} sections={helpSections} />
```

---

### CommandPalette

Fuzzy-search command palette overlay with keyboard navigation. Built on `useCommandPalette`.

| Prop | Type | Default | Description |
|---|---|---|---|
| `commands` | `Array<{ name: string; description?: string; category?: string }>` | -- | Available commands |
| `visible` | `boolean` | -- | Show/hide the palette |
| `onExecute` | `(command: Command) => void` | -- | Called when a command is selected |
| `onClose` | `() => void` | -- | Called on Escape |

```tsx
<CommandPalette visible={open} commands={commands} onExecute={run} onClose={() => setOpen(false)} />
```

---
[Back to Components](README.md)
