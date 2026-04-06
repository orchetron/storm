# Content Components

Content display including cards, headings, images, gradients, lists, and utility elements.

## Content

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
import { Card, Text } from "@orchetron/storm";

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
import { Heading } from "@orchetron/storm";

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
import { Paragraph } from "@orchetron/storm";

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

### DefinitionList

Term and definition pairs with stacked or inline layout.

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `DefinitionListItem[]` | -- | Array of `{ term, definition }` (required) |
| `termColor` | `string \| number` | `colors.brand.primary` | Term text color |
| `layout` | `"stacked" \| "inline"` | `"stacked"` | Stacked (term above) or inline (same line with auto-aligned widths) |
| `separator` | `"line"` | -- | Show a dim horizontal line between items |
| `renderTerm` | `(term: string) => ReactNode` | -- | Custom term renderer |

```tsx
<DefinitionList
  items={[
    { term: "Name", definition: "Storm TUI" },
    { term: "Version", definition: "2.1.0" },
    { term: "License", definition: "MIT" },
  ]}
  layout="inline"
/>
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

### Markdown

Renders a markdown string as styled terminal output with headings, bold, italic, code blocks, and lists.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `string` | -- | Markdown source text |
| `width` | `number` | -- | Wrap width |

```tsx
<Markdown>{`# Title\nSome **bold** and *italic* text.`}</Markdown>
```

---

### MarkdownViewer

Scrollable markdown viewer with syntax-highlighted code blocks. Wraps `Markdown` in a `ScrollView`.

| Prop | Type | Default | Description |
|---|---|---|---|
| `content` | `string` | -- | Markdown source text |
| `height` | `number` | -- | Viewport height |
| `isFocused` | `boolean` | `true` | Accept scroll input |

```tsx
<MarkdownViewer content={readmeText} height={20} />
```

---
[Back to Components](README.md)
