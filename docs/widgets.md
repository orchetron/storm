# Storm AI Widgets

19 purpose-built widgets for AI agent terminal interfaces. These are Storm's key differentiators -- components designed specifically for LLM-powered applications, covering everything from token streaming to approval workflows, cost tracking, and live performance profiling.

All widgets use Storm's imperative rendering pattern (`requestRender()` + ref mutation) for animations, avoiding React state updates that don't flush in Storm's custom reconciler. Every widget accepts a `usePluginProps` hook for plugin-level prop overrides.

---

## Table of Contents

1. [AnimatedLogo](#1-animatedlogo)
2. [ApprovalPrompt](#2-approvalprompt)
3. [BlinkDot](#3-blinkdot)
4. [CommandBlock](#4-commandblock)
5. [CommandDropdown](#5-commanddropdown)
6. [ComponentGallery](#6-componentgallery)
7. [ContextWindow](#7-contextwindow)
8. [CostTracker](#8-costtracker)
9. [MarkdownText](#9-markdowntext)
10. [MessageBubble](#10-messagebubble)
11. [ModelBadge](#11-modelbadge)
12. [OperationTree](#12-operationtree)
13. [PerformanceHUD](#13-performancehud)
14. [ShimmerText](#14-shimmertext)
15. [StatusLine](#15-statusline)
16. [StreamingText](#16-streamingtext)
17. [SyntaxHighlight](#17-syntaxhighlight)
18. [TokenStream](#18-tokenstream)
19. [WelcomeBanner](#19-welcomebanner)

---

## 1. AnimatedLogo

3D rotating shield logo animation using block-density character shading.

Renders an 8-frame rotation of Storm's angular shield with a lightning bolt, simulating 3D depth using Unicode block characters (`██ ▓▓ ▒▒ ░░`). Uses imperative mutation + `requestRender()` for zero-overhead animation.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `animate` | `boolean` | `true` | Whether the rotation animation is active. |
| `interval` | `number` | `personality.animation.durationFast` | Milliseconds between animation frames. |
| `color` | `string` | `colors.brand.primary` | Color applied to the logo text. |
| `renderFrame` | `(frame: string, index: number) => ReactNode` | -- | Custom render function for each animation frame. Receives the frame string and its 0-based index. |

### Usage

```tsx
import { AnimatedLogo } from "@orchetron/storm-tui";

// Basic animated logo
<AnimatedLogo />

// Static logo (no animation)
<AnimatedLogo animate={false} />

// Custom speed and color
<AnimatedLogo interval={200} color="#FFD700" />

// Custom frame renderer
<AnimatedLogo renderFrame={(frame, idx) => (
  <Text color={idx % 2 === 0 ? "cyan" : "yellow"}>{frame}</Text>
)} />
```

### When to use

Display during app startup, loading screens, or as a branding element. The 3D rotation effect catches the eye without being distracting. Set `animate={false}` for a static shield icon in headers or about screens.

---

## 2. ApprovalPrompt

Tool execution approval dialog with risk levels, keyboard selection, and auto-deny timeout.

Renders a bordered prompt showing a tool name, risk level badge (colored by severity), optional parameter display, and a row of keyboard-selectable options. Supports countdown auto-deny when a timeout is set. Uses `useInput` for key handling.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `tool` | `string` | **required** | Tool name displayed in the header. |
| `risk` | `string` | -- | Risk level string (e.g. `"high"`, `"medium"`, `"low"`). Colors the border: red for high, amber for medium. |
| `params` | `Record<string, unknown>` | -- | Tool parameters to display. Values are truncated at 60 characters. |
| `options` | `ApprovalOption[]` | `[{key:"y", label:"approve"}, {key:"n", label:"deny"}, {key:"a", label:"always approve"}]` | Approval options with key, label, and color. |
| `onSelect` | `(key: string) => void` | **required** | Called when the user presses an option key. |
| `width` | `number` | -- | Terminal width hint (unused -- Divider auto-fills). |
| `visible` | `boolean` | `true` | Whether the prompt captures keyboard input. |
| `timeout` | `number` | -- | Auto-deny timeout in milliseconds. Displays a countdown and calls `onSelect("n")` when expired. |
| `renderOption` | `(option: ApprovalOption, index: number) => ReactNode` | -- | Custom render for each approval option. |
| `timeoutMessage` | `(seconds: number) => string` | `` (s) => `Auto-deny in ${s}s` `` | Custom countdown message formatter. |

#### ApprovalOption

| Name | Type | Description |
|------|------|-------------|
| `key` | `string` | Keyboard key to press. |
| `label` | `string` | Display text next to the key. |
| `color` | `string` | Color for the key character. |

### Usage

```tsx
import { ApprovalPrompt } from "@orchetron/storm-tui";

// Basic approval prompt
<ApprovalPrompt
  tool="execute_shell"
  risk="high"
  params={{ command: "rm -rf /tmp/cache", cwd: "/home/user" }}
  onSelect={(key) => {
    if (key === "y") runTool();
    else if (key === "a") alwaysApprove("execute_shell");
    else deny();
  }}
/>

// With auto-deny timeout
<ApprovalPrompt
  tool="file_write"
  risk="medium"
  timeout={30000}
  onSelect={handleApproval}
/>

// Custom options
<ApprovalPrompt
  tool="deploy"
  risk="high"
  options={[
    { key: "y", label: "deploy now", color: "#00FF00" },
    { key: "s", label: "stage first", color: "#FFAA00" },
    { key: "n", label: "cancel", color: "#FF0000" },
  ]}
  onSelect={handleDeploy}
/>
```

### When to use

Any time an AI agent needs human confirmation before executing a tool -- file writes, shell commands, API calls, deployments. The risk level coloring provides instant visual severity assessment. The timeout auto-deny prevents blocking when running unattended.

---

## 3. BlinkDot

Status indicator dot that blinks based on operation state.

Renders a colored dot (`●`) whose behavior changes by state: blinks when `running`, stays solid for `pending`/`streaming`/`completed`/`failed`/`cancelled`. Uses imperative animation -- timer stops automatically for terminal states to avoid wasting CPU.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `state` | `DotState` | **required** | Current state. One of: `"pending"`, `"running"`, `"streaming"`, `"completed"`, `"failed"`, `"cancelled"`. |
| `interval` | `number` | `personality.animation.durationSlow` | Blink interval in milliseconds. |
| `dotCharacter` | `string` | `"●"` | Character displayed when the dot is visible. |
| `offCharacter` | `string` | `" "` (space) | Character displayed when the dot is hidden during blink. |
| `renderDot` | `(char: string, state: DotState) => ReactNode` | -- | Custom render for the dot. |

### State Colors

| State | Color |
|-------|-------|
| `pending` | `colors.tool.pending` |
| `running` | `colors.tool.running` |
| `streaming` | `colors.tool.pending` |
| `completed` | `colors.tool.completed` |
| `failed` | `colors.tool.failed` |
| `cancelled` | `colors.tool.cancelled` |

### Usage

```tsx
import { BlinkDot } from "@orchetron/storm-tui";

// Running operation -- dot blinks
<BlinkDot state="running" />

// Completed -- solid green dot
<BlinkDot state="completed" />

// Custom character and speed
<BlinkDot state="running" dotCharacter="*" interval={300} />
```

### When to use

Compact status indicator for individual operations, tool calls, or list items. Pairs well with `OperationTree` nodes or `MessageBubble` metadata. The automatic CPU optimization (timer stops for terminal states) makes it safe to render hundreds of these.

---

## 4. CommandBlock

Collapsible command output display with exit code badge and duration.

Renders a bordered block showing a command string (bold, with collapse toggle indicator), expandable output content, a colored exit code badge, and duration. Supports keyboard toggle (Enter/Space) and copy (c key) when focused.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `command` | `string` | **required** | The command that was run. |
| `output` | `ReactNode` | -- | Command output content. |
| `exitCode` | `number` | -- | Exit code. `0` shows green checkmark, non-zero shows red X with code. |
| `duration` | `number` | -- | Duration in milliseconds, displayed formatted (e.g. "1.2s"). |
| `collapsed` | `boolean` | `false` | Whether the output is collapsed. |
| `onToggle` | `() => void` | -- | Toggle callback for collapse/expand. |
| `isFocused` | `boolean` | -- | Whether this block receives keyboard input. Shows hint text when true. |
| `onCopy` | `(text: string) => void` | -- | Called when user presses "c" while focused. Receives the output text. |
| `ansiOutput` | `boolean` | -- | When true, passes output through without stripping ANSI codes. |
| `renderHeader` | `(command: string, exitCode?: number) => ReactNode` | -- | Custom render for the command header row. |
| `toggleIndicators` | `{ collapsed?: string; expanded?: string }` | `{ collapsed: "▸", expanded: "▾" }` | Override collapse/expand toggle characters. |
| `exitCodeSymbols` | `{ success?: string; failure?: string }` | `{ success: "✓", failure: "✗" }` | Override exit code symbols. |

### Usage

```tsx
import { CommandBlock } from "@orchetron/storm-tui";

// Basic command block
<CommandBlock
  command="npm test"
  output="PASS src/index.test.ts\n42 tests passed"
  exitCode={0}
  duration={1234}
/>

// Collapsible with toggle
<CommandBlock
  command="git diff"
  output={diffOutput}
  collapsed={isCollapsed}
  onToggle={() => setCollapsed(!isCollapsed)}
  isFocused={true}
/>

// With ANSI color output
<CommandBlock
  command="ls --color"
  output={ansiColoredOutput}
  ansiOutput={true}
  exitCode={0}
/>
```

### When to use

Displaying tool execution results in an AI chat interface. Each tool call that runs a command should wrap its output in a `CommandBlock`. The collapse feature keeps long outputs manageable, and the exit code badge provides instant pass/fail visibility.

---

## 5. CommandDropdown

Fuzzy-searchable command palette dropdown with keyboard navigation.

Renders a vertical list of items with a highlighted selection indicator. Features type-to-filter fuzzy matching (matched characters shown bold), scrollable window with overflow indicators, and full keyboard navigation (up/down/enter/escape/backspace).

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `readonly CommandItem[]` | **required** | Items to display. Each has `name` and `description`. |
| `selectedIndex` | `number` | `0` | Currently selected index. |
| `maxVisible` | `number` | `6` | Maximum visible items before scrolling. Shows `...` overflow indicators. |
| `highlightColor` | `string` | `colors.brand.primary` | Color for the selected item. |
| `isFocused` | `boolean` | -- | Whether the dropdown captures keyboard input. |
| `onSelect` | `(item: CommandItem) => void` | -- | Called when the user presses Enter on an item. |
| `onSelectionChange` | `(index: number) => void` | -- | Called when keyboard navigation changes the selected index. |
| `onClose` | `() => void` | -- | Called on second Escape press (first Escape clears filter). |
| `selectionIndicator` | `string` | `"▸ "` | Override the selection indicator string. |
| `renderItem` | `(item: CommandItem, isSelected: boolean) => ReactNode` | -- | Custom render for each dropdown item. |

#### CommandItem

| Name | Type | Description |
|------|------|-------------|
| `name` | `string` | Item name (searchable). |
| `description` | `string` | Description shown dim after the name. |

### Usage

```tsx
import { CommandDropdown } from "@orchetron/storm-tui";

const commands = [
  { name: "/help", description: "Show available commands" },
  { name: "/model", description: "Switch AI model" },
  { name: "/clear", description: "Clear conversation" },
  { name: "/export", description: "Export chat to file" },
];

<CommandDropdown
  items={commands}
  selectedIndex={selectedIdx}
  isFocused={true}
  onSelect={(item) => executeCommand(item.name)}
  onSelectionChange={(idx) => setSelectedIdx(idx)}
  onClose={() => hideDropdown()}
/>
```

### When to use

Slash command palettes, autocomplete menus, or any searchable item picker in an AI agent interface. The fuzzy matching makes it fast to find commands without exact typing. Escape behavior (clear filter first, then close) follows standard UI conventions.

---

## 6. ComponentGallery

Interactive split-pane component showcase browser.

A full-screen widget that catalogs every Storm component organized by category (Core, Input, Display, Data, Feedback, Layout, Navigation, AI-Native). Left sidebar shows a scrollable categorized list with keyboard navigation; right panel shows a live description and ASCII preview of the selected component.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `categories` | `string[]` | -- | Filter to show only specific categories. When empty/undefined, shows all. |
| `width` | `number` | `80` | Total width of the gallery. |
| `height` | `number` | `30` | Total height of the gallery. |
| `isFocused` | `boolean` | `true` | Whether the gallery captures keyboard input. |
| `renderCategory` | `(name: string, isSelected: boolean) => ReactNode` | -- | Custom render for category headers. |
| `renderItem` | `(name: string, isSelected: boolean) => ReactNode` | -- | Custom render for gallery items. |
| `selectionIndicator` | `string` | `"▸ "` | Selection indicator character. |

### Keyboard Controls

| Key | Action |
|-----|--------|
| `Up/Down` | Navigate items in sidebar |
| `Tab` | Switch focus between sidebar and preview pane |

### Usage

```tsx
import { ComponentGallery } from "@orchetron/storm-tui";

// Full gallery
<ComponentGallery width={100} height={40} />

// Filtered to AI-Native widgets only
<ComponentGallery categories={["AI-Native"]} width={80} height={30} />

// Embedded with custom focus
<ComponentGallery isFocused={isPanelActive} width={termWidth} height={termHeight - 2} />
```

### When to use

Developer tooling, demo applications, or documentation browsers. Ideal for showcasing Storm's component library in an interactive terminal experience. Contains built-in ASCII previews for 70+ components across 7 categories.

---

## 7. ContextWindow

Token/context usage visualization with segmented bar and optional sparkline history.

Renders a progress bar showing LLM context window usage. Supports a simple filled/empty bar or a segmented bar where each segment (system, user, tools, assistant) gets its own color. Includes percentage, token counts, remaining tokens, and an optional sparkline showing historical usage.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `used` | `number` | **required** | Tokens currently used. |
| `limit` | `number` | **required** | Maximum context window size. |
| `breakdown` | `Array<{ label: string; tokens: number; color?: string }>` | -- | Segment breakdown for multi-color bar. Each segment gets its own color. |
| `compact` | `boolean` | -- | When `true`, renders single-line bar only. When `false` with breakdown, shows bar + legend list. |
| `barWidth` | `number` | `24` | Width of the bar in characters. |
| `history` | `number[]` | -- | Historical token usage values. Renders a sparkline below the bar when provided. |
| `renderBar` | `(used: number, limit: number) => ReactNode` | -- | Custom render for the entire context bar. |
| `sparklineChars` | `string[]` | `["▁","▂","▃","▄","▅","▆","▇","█"]` | Override sparkline block characters. |

### Color Behavior

The bar color changes based on fill level:
- Green: usage <= 70%
- Amber: usage 70-90%
- Red: usage > 90%

### Usage

```tsx
import { ContextWindow } from "@orchetron/storm-tui";

// Simple usage bar
<ContextWindow used={6000} limit={8192} />

// Segmented breakdown with legend
<ContextWindow
  used={6700}
  limit={8192}
  breakdown={[
    { label: "System", tokens: 1200 },
    { label: "User", tokens: 3400, color: "#4CAF50" },
    { label: "Assistant", tokens: 2100 },
  ]}
/>

// Compact with history sparkline
<ContextWindow
  used={4096}
  limit={8192}
  compact
  history={[1000, 2000, 3500, 4096, 3800, 4096]}
/>
```

### When to use

Any AI chat interface where context window management matters. Shows users how much of the model's context is consumed, broken down by role. The sparkline history helps identify context growth patterns. Critical for long conversations approaching the token limit.

---

## 8. CostTracker

API cost tracking display with per-token pricing and color-coded spend levels.

Calculates and displays running cost based on input/output token counts and per-million pricing. Supports compact (single line) and expanded (breakdown table) modes. Cost color shifts from green to amber to red as spend increases.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `inputTokens` | `number` | **required** | Number of input/prompt tokens consumed. |
| `outputTokens` | `number` | **required** | Number of output/completion tokens consumed. |
| `inputCostPer1M` | `number` | `3` | Cost per 1 million input tokens. |
| `outputCostPer1M` | `number` | `15` | Cost per 1 million output tokens. |
| `currency` | `string` | `"$"` | Currency symbol. |
| `sessionTotal` | `number` | `0` | Pre-existing session cost to add to the running total. |
| `compact` | `boolean` | `false` | Single line (`true`) vs expanded breakdown table (`false`). |
| `renderCost` | `(cost: number, currency: string) => ReactNode` | -- | Custom render for the cost display. |

### Color Thresholds

| Total Cost | Color |
|-----------|-------|
| < $0.10 | Green |
| $0.10 - $0.99 | Amber |
| >= $1.00 | Red |

### Usage

```tsx
import { CostTracker } from "@orchetron/storm-tui";

// Expanded breakdown
<CostTracker inputTokens={50000} outputTokens={12000} />
// Renders:
//   Total: $0.33
//     Input:  50K tokens x $3/M = $0.15
//     Output: 12K tokens x $15/M = $0.18

// Compact single-line
<CostTracker inputTokens={50000} outputTokens={12000} compact />
// Renders: $0.33 (50K in x $3/M + 12K out x $15/M)

// Custom pricing (e.g. Qwen-2.5)
<CostTracker
  inputTokens={100000}
  outputTokens={25000}
  inputCostPer1M={2.5}
  outputCostPer1M={10}
  sessionTotal={5.50}
/>
```

### When to use

Status bars, session summaries, or cost dashboards in AI agent interfaces. Helps users stay aware of API spend in real time. The color-coded thresholds provide instant visual feedback when costs are climbing. Pair with `StatusLine` or `TokenStream` for a complete metrics bar.

---

## 9. MarkdownText

Full markdown renderer for terminal UI -- headings, code blocks, tables, lists, links, and inline formatting.

Pure regex-based parser with zero external dependencies. Renders markdown content as styled TUI elements with syntax-highlighted code blocks (via `SyntaxHighlight`), properly formatted tables with alignment, task lists, blockquotes, and full inline formatting (bold, italic, code, links, strikethrough).

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `string` | **required** | Markdown source text to render. |
| `width` | `number` | -- | Width constraint for code blocks and horizontal rules. |

### Supported Markdown Features

**Block-level:**
- Headings (`# H1` through `###### H6`) -- H1 uses brand primary color, H2+ uses brand light
- Fenced code blocks (` ```language `) with syntax highlighting
- Blockquotes (`> text`) with dim pipe indicators
- Unordered lists (`- item` or `* item`) with bullet characters
- Ordered lists (`1. item`)
- Task lists (`- [ ] unchecked` / `- [x] checked`) with checkbox characters
- Tables with pipe syntax and column alignment (`:---`, `:---:`, `---:`)
- Horizontal rules (`---`, `***`, `___`)

**Inline:**
- **Bold** (`**text**` or `__text__`)
- *Italic* (`*text*` or `_text_`)
- ***Bold italic*** (`***text***` or `___text___`)
- `Inline code` (`` `code` ``)
- [Links]() (`[text](url)`) -- rendered underlined in info color
- ~~Strikethrough~~ (`~~text~~`) -- rendered dim

### Usage

```tsx
import { MarkdownText } from "@orchetron/storm-tui";

<MarkdownText width={80}>{`
# Welcome

Here is some **bold** and *italic* text with \`inline code\`.

## Code Example

\`\`\`typescript
const greeting = "Hello, Storm!";
console.log(greeting);
\`\`\`

| Feature | Status |
|---------|--------|
| Tables  | Done   |
| Lists   | Done   |

- [x] Task lists work too
- [ ] Still more to do
`}</MarkdownText>
```

### When to use

Rendering AI assistant responses that contain markdown. The `MessageBubble` widget integrates this via its `markdown` prop. Also useful for help text, documentation viewers, or any content that originates as markdown.

---

## 10. MessageBubble

Chat message display with role-based icons, markdown rendering, timestamps, and action buttons.

Renders a message with a role-appropriate symbol on the left (auto-resolved from role or manually overridden), content area, optional metadata line, optional timestamp, and action hints with keyboard shortcuts. When `markdown` is `true` and children is a string, content is rendered through `MarkdownText`.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `symbol` | `string` | Role-based default | Symbol displayed on the left. Overrides role default. |
| `symbolColor` | `string` | Role-based default | Color for the symbol. Overrides role default. |
| `role` | `"user" \| "assistant" \| "system" \| "tool"` | -- | Message role. Auto-sets symbol and color (see table below). |
| `children` | `ReactNode` | **required** | Message content. Strings are wrapped in `<Text>`. |
| `meta` | `string` | -- | Metadata line rendered dim and italic below the message (e.g. timing, token counts). |
| `timestamp` | `string` | -- | Timestamp rendered dim on the right side of the message. |
| `markdown` | `boolean` | -- | When `true` and children is a string, renders through `MarkdownText`. |
| `actions` | `MessageAction[]` | -- | Action hints displayed below the message with keyboard shortcuts. |
| `isFocused` | `boolean` | `true` | Whether the bubble captures keyboard input for actions. |
| `renderSymbol` | `(symbol: string, color: string) => ReactNode` | -- | Custom renderer for the role symbol. |

#### Role Defaults

| Role | Symbol | Color |
|------|--------|-------|
| `user` | `>` | Brand primary |
| `assistant` | `✦` | Brand primary |
| `system` | `●` | Warning |
| `tool` | `⚙` | Info |

#### MessageAction

| Name | Type | Description |
|------|------|-------------|
| `label` | `string` | Display label for the action. |
| `key` | `string` | Key the user presses to trigger. |
| `onAction` | `() => void` | Callback when the action key is pressed. |

### Usage

```tsx
import { MessageBubble } from "@orchetron/storm-tui";

// User message
<MessageBubble role="user">What files changed?</MessageBubble>

// Assistant message with markdown
<MessageBubble role="assistant" markdown>
  {"Here are the changes:\n\n```diff\n+ added line\n- removed line\n```"}
</MessageBubble>

// Tool result with metadata and actions
<MessageBubble
  role="tool"
  meta="12 tokens, 0.3s"
  timestamp="14:32"
  actions={[
    { key: "r", label: "retry", onAction: () => retryTool() },
    { key: "c", label: "copy", onAction: () => copyResult() },
  ]}
>
  File written successfully.
</MessageBubble>

// Custom symbol
<MessageBubble symbol="!" symbolColor="#FF0000">
  Warning: approaching token limit.
</MessageBubble>
```

### When to use

The primary building block for AI chat interfaces. Every message in a conversation should be wrapped in a `MessageBubble`. The role system provides instant visual distinction between user input, AI responses, system messages, and tool outputs. Actions enable inline interactions without leaving the chat flow.

---

## 11. ModelBadge

AI model name and provider badge with capability indicators and context size.

Renders a diamond icon colored by provider, the model name in bold, optional capability tags (e.g. `[vision]`, `[tools]`, `[code]`), and max context window size. Provider colors are built-in with support for custom overrides.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `model` | `string` | **required** | Model name (e.g. `"my-model-v2"`). |
| `provider` | `string` | -- | Provider name: `"cloud"`, `"local"`, `"enterprise"`, `"research"`, `"community"`, `"custom"`. Determines diamond color. |
| `capabilities` | `string[]` | -- | Capability tags rendered as dim badges (e.g. `["vision", "tools", "code"]`). |
| `maxTokens` | `number` | -- | Max context window tokens. Formatted as K/M (e.g. 128000 -> "128K"). |
| `color` | `string \| number` | Provider-based | Override color for the badge diamond. |
| `renderModel` | `(model: string, provider?: string) => ReactNode` | -- | Custom render for the model display. |
| `providerColors` | `Record<string, string>` | -- | Override or extend the built-in provider color map. Merged with defaults. |

#### Built-in Provider Colors

| Provider | Color |
|----------|-------|
| `cloud` | Brand primary (amber) |
| `enterprise` | Green |
| `research` | Blue |
| `community` | Purple (`#D18EE2`) |
| `custom` | Orange (`#FF7000`) |
| `local` | Gray (`#888888`) |
| `default` | Light gray (`#AAAAAA`) |

### Usage

```tsx
import { ModelBadge } from "@orchetron/storm-tui";

// Basic badge
<ModelBadge model="qwen-2.5-72b" />
// Renders: ◆ qwen-2.5-72b

// Full badge with all features
<ModelBadge
  model="qwen-2.5-72b"
  provider="cloud"
  capabilities={["vision", "tools", "code"]}
  maxTokens={200000}
/>
// Renders: ◆ qwen-2.5-72b [vision] [tools] [code] 200K

// Local model
<ModelBadge model="llama-3.1-70b" provider="local" maxTokens={128000} />

// Custom provider colors
<ModelBadge
  model="my-model"
  provider="internal"
  providerColors={{ internal: "#FF5500" }}
/>
```

### When to use

Status bars, message headers, model selectors, or anywhere the current model identity needs to be displayed. Pair with `StatusLine` for a persistent model indicator. The capability badges help users understand what the active model can do.

---

## 12. OperationTree

Hierarchical operation progress display with animated spinners and tree connectors.

Renders a tree of operations where each node has a status icon, label, optional detail text, and duration. Running nodes animate with a braille spinner using imperative `requestRender()`. Timer automatically starts/stops based on whether any nodes are in the `running` state. Supports arbitrary nesting depth with configurable tree connector characters.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `nodes` | `OpNode[]` | **required** | Array of operation nodes (can be nested via `children`). |
| `maxDepth` | `number` | -- | Maximum tree depth to render. Omit for unlimited. |
| `showDuration` | `boolean` | `true` | Whether to show duration for nodes that have `durationMs`. |
| `renderNode` | `(node: OpNode, state: { depth: number }) => ReactNode` | -- | Custom render for each operation node. |
| `spinnerFrames` | `string[]` | `["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"]` | Custom spinner animation frames. |
| `spinnerInterval` | `number` | `80` | Spinner animation interval in milliseconds. |
| `statusIcons` | `Partial<Record<string, string>>` | `{ pending:"○", completed:"✓", failed:"✗", cancelled:"⊘" }` | Override status icons by status key. Running nodes use the spinner instead. |
| `treeConnectors` | `{ branch?: string; last?: string; pipe?: string; space?: string }` | `{ branch:"├─", last:"└─", pipe:"│  ", space:"   " }` | Override tree connector characters. |

#### OpNode

| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | Unique identifier for the node. |
| `label` | `string` | Display label. |
| `status` | `"pending" \| "running" \| "completed" \| "failed" \| "cancelled"` | Current operation status. |
| `children` | `OpNode[]` | Nested child operations. |
| `detail` | `string` | Optional detail text shown dim after the label. |
| `durationMs` | `number` | Operation duration in milliseconds. |

### Usage

```tsx
import { OperationTree } from "@orchetron/storm-tui";

<OperationTree
  nodes={[
    {
      id: "plan",
      label: "Planning",
      status: "completed",
      durationMs: 450,
      children: [
        { id: "analyze", label: "Analyze request", status: "completed", durationMs: 200 },
        { id: "strategy", label: "Select strategy", status: "completed", durationMs: 250 },
      ],
    },
    {
      id: "execute",
      label: "Executing",
      status: "running",
      children: [
        { id: "read", label: "Read file", status: "completed", detail: "src/index.ts", durationMs: 50 },
        { id: "edit", label: "Apply edit", status: "running", detail: "line 42" },
        { id: "test", label: "Run tests", status: "pending" },
      ],
    },
  ]}
/>
// Renders:
// ├─ ✓ Planning (450ms)
// │  ├─ ✓ Analyze request (200ms)
// │  └─ ✓ Select strategy (250ms)
// └─ ⠋ Executing
//    ├─ ✓ Read file src/index.ts (50ms)
//    ├─ ⠙ Apply edit line 42
//    └─ ○ Run tests
```

### When to use

Displaying multi-step AI agent workflows -- plan-and-execute patterns, tool chains, parallel operations. The animated spinners on running nodes give immediate visual feedback about what the agent is doing. Stale refs are automatically cleaned up when nodes leave the tree.

---

## 13. PerformanceHUD

Live FPS, render time, cell diff, and memory overlay for development profiling.

Developer tool that renders a compact bordered box showing real-time rendering metrics. Tracks FPS and render time history as mini sparklines. All metrics are color-coded: FPS green >30 / amber 15-30 / red <15; render time green <8ms / amber 8-16ms / red >16ms. Uses dim styling to minimize visual interference.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `visible` | `boolean` | `true` | Whether the HUD is rendered. |
| `renderTimeMs` | `number` | `0` | Render time of last frame in milliseconds. |
| `fps` | `number` | `0` | Current frames per second. |
| `componentCount` | `number` | -- | Number of components rendered. |
| `cellsChanged` | `number` | `0` | Number of cells changed in last frame. |
| `totalCells` | `number` | `0` | Total cells in buffer. |
| `memoryMB` | `number` | -- | Memory usage in megabytes. |
| `position` | `"top-right" \| "bottom-right" \| "top-left" \| "bottom-left"` | `"top-right"` | Position hint (sets `alignSelf` for flex layout). |
| `renderMetric` | `(label: string, value: string, sparkline: string) => ReactNode` | -- | Custom render for each metric row. |
| `historySize` | `number` | `20` | Number of history samples to keep for sparklines. |
| `title` | `string` | `"Storm HUD"` | HUD title text. |

### Usage

```tsx
import { PerformanceHUD } from "@orchetron/storm-tui";

<PerformanceHUD
  fps={58}
  renderTimeMs={2.3}
  cellsChanged={120}
  totalCells={4800}
  memoryMB={24.3}
  componentCount={42}
/>
// Renders:
// ╭─────────────────────╮
// │ Storm HUD           │
// │ FPS: 58 ▅▆▇█▇▆  RT: 2.3ms ▁▁▂▁▁ │
// │ Cells: 120/4.8K     │
// │ Mem: 24.3 MB        │
// │ Components: 42      │
// ╰─────────────────────╯

// Toggle visibility with a keyboard shortcut
<PerformanceHUD visible={showHud} fps={metrics.fps} renderTimeMs={metrics.rt} />
```

### When to use

Development and debugging only. Add to your app's root layout to monitor rendering performance. The sparklines show trends over the last 20 frames. Useful for identifying slow renders, excessive cell diffs, or memory leaks during widget development.

---

## 14. ShimmerText

Loading shimmer animation -- a bright highlight window sweeps across text.

Renders text with a 3-character bright shimmer window that continuously sweeps from left to right. Uses imperative mutation for each of three text segments (before/shimmer/after) with `requestRender()`. Stops cleanly when `active` is set to `false`.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | **required** | The text to display with shimmer effect. |
| `baseColor` | `string` | `colors.thinking.symbol` | Color of the non-shimmer text. |
| `shimmerColor` | `string` | `colors.thinking.shimmer` | Color of the bright shimmer highlight. |
| `interval` | `number` | `personality.animation.durationFast` | Speed of the shimmer sweep in milliseconds per step. |
| `bold` | `boolean` | -- | Whether the entire text is bold. |
| `active` | `boolean` | `true` | When `false`, stops the animation and shows static text. |
| `shimmerWidth` | `number` | `3` | Width of the shimmer highlight window in characters. |
| `renderSegment` | `(text: string, isShimmer: boolean) => ReactNode` | -- | Custom render for each text segment (before, shimmer, after). |

### Usage

```tsx
import { ShimmerText } from "@orchetron/storm-tui";

// Basic thinking indicator
<ShimmerText text="Thinking..." />

// Custom colors and speed
<ShimmerText
  text="Analyzing codebase..."
  baseColor="#666666"
  shimmerColor="#FFFFFF"
  interval={100}
  bold
/>

// Wider shimmer window
<ShimmerText text="Processing request" shimmerWidth={5} />

// Stop animation when done
<ShimmerText text="Analysis complete" active={isProcessing} />
```

### When to use

"Thinking" indicators while waiting for AI responses. More visually engaging than a static "Loading..." message. The sweeping shimmer implies ongoing processing. Pair with `BlinkDot` for a combined status indicator, or use inside `MessageBubble` as the content while streaming hasn't started yet.

---

## 15. StatusLine

Bottom status bar with three layout modes: custom, built-in, and powerline segments.

Supports three modes: (1) **Custom layout** with arbitrary `left`/`right` React nodes, (2) **Built-in layout** with `brand`, `model`, `tokens`, `turns`, and `extra` key-value pairs, and (3) **Powerline segments** with colored segments and triangle separators. All text renders dim by default.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `left` | `ReactNode` | -- | Left-side content (custom layout mode). |
| `right` | `ReactNode` | -- | Right-side content (custom layout mode). |
| `brand` | `string` | -- | Brand name shown with lightning prefix (built-in layout). |
| `model` | `string` | -- | Model display name (built-in layout). |
| `tokens` | `number` | -- | Token count, formatted with K/M suffixes (built-in layout). |
| `turns` | `number` | -- | Turn count (built-in layout). |
| `extra` | `Record<string, string \| number>` | -- | Arbitrary key-value pairs rendered on the right (built-in layout). |
| `backgroundColor` | `string` | `colors.surface.raised` | Background color for the status line. |
| `segments` | `StatusLineSegment[]` | -- | Powerline-style segments with per-segment colors. Overrides all other layout modes. |
| `renderSegment` | `(segment: StatusLineSegment, index: number) => ReactNode` | -- | Custom render for each powerline segment. |
| `powerlineSeparator` | `string` | `"▶"` | Override the powerline separator character. |

#### StatusLineSegment

| Name | Type | Description |
|------|------|-------------|
| `text` | `string` | Text content of the segment. |
| `color` | `string` | Foreground color. |
| `bg` | `string` | Background color. |

### Usage

```tsx
import { StatusLine } from "@orchetron/storm-tui";

// Built-in layout
<StatusLine
  brand="Storm"
  model="qwen-2.5-72b"
  tokens={4200}
  turns={12}
  extra={{ cost: "$0.42" }}
/>
// Renders: ⚡ Storm qwen-2.5-72b          tokens:4.2K  turns:12  cost:$0.42

// Custom layout
<StatusLine
  left={<Text bold color="cyan">My App</Text>}
  right={<Text dim>Ready</Text>}
/>

// Powerline segments
<StatusLine segments={[
  { text: "NORMAL", color: "#000", bg: "#88C0D0" },
  { text: "main", color: "#FFF", bg: "#5E81AC" },
  { text: "src/index.ts", color: "#D8DEE9", bg: "#3B4252" },
]} />
```

### When to use

The persistent bottom bar in any AI agent TUI. The built-in layout mode provides everything needed for an AI chat status bar with minimal configuration. Powerline mode is ideal for more customized, vim-style status bars.

---

## 16. StreamingText

Typewriter-style streaming text display with blinking cursor.

Renders text with an optional animated blinking cursor (`▊`) at the end when streaming is active. Supports a typewriter "animate" mode that reveals text character by character at a configurable speed, with an `onComplete` callback. Cursor blink and typing animation both use imperative `requestRender()`.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | **required** | Text content to display. |
| `color` | `string \| number` | -- | Text color. |
| `cursor` | `boolean` | `true` | Whether to show a cursor when streaming. |
| `streaming` | `boolean` | -- | Whether the text is currently streaming. Cursor only shows when both `cursor` and `streaming` are true. |
| `animate` | `boolean` | `false` | When `true`, reveals text character by character (typewriter effect). |
| `speed` | `number` | `2` | Characters revealed per tick when `animate` is true (~30fps ticks). |
| `onComplete` | `() => void` | -- | Callback fired when all text has been revealed in animate mode. |
| `cursorCharacter` | `string` | `"▊"` | Override the cursor character. |
| `cursorBlinkInterval` | `number` | `530` | Cursor blink interval in milliseconds. |
| `renderCursor` | `(char: string, visible: boolean) => ReactNode` | -- | Custom render for the cursor. Receives the cursor character and current visibility state. |

### Usage

```tsx
import { StreamingText } from "@orchetron/storm-tui";

// Live streaming with cursor
<StreamingText text={partialResponse} streaming={true} />

// Completed stream (no cursor)
<StreamingText text={fullResponse} streaming={false} />

// Typewriter reveal animation
<StreamingText
  text="Hello! I'm your AI assistant."
  animate
  speed={3}
  onComplete={() => setReady(true)}
/>

// Custom cursor
<StreamingText
  text={response}
  streaming={isStreaming}
  cursorCharacter="_"
  cursorBlinkInterval={400}
/>
```

### When to use

Displaying AI model output as it streams in. The blinking cursor provides visual feedback that the model is still generating. The typewriter mode is useful for welcome messages or staged reveals. Both timers clean up automatically when streaming stops or the component unmounts.

---

## 17. SyntaxHighlight

Code syntax highlighting supporting 100 languages with multiline state tracking.

Regex-based syntax highlighter with zero external dependencies. Handles keywords, types, strings (including multiline and template literals), comments (line and block), numbers, operators, preprocessor directives, and HTML/XML tags. Supports Tree-sitter integration when available for higher accuracy. Extensible via `registerLanguage()`.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `code` | `string` | **required** | Source code to highlight. |
| `language` | `string` | -- | Language identifier (e.g. `"typescript"`, `"python"`, `"rust"`). |
| `width` | `number` | -- | Width constraint for the output. |

### Supported Languages (100)

**Systems:** C, C++, Rust, Go, Zig, Nim, Odin, V, Crystal, Mojo

**Application:** Java, Kotlin, Swift, Scala, Dart, C#, F#, Objective-C

**Scripting:** JavaScript, TypeScript, Python, Ruby, PHP, Perl, Lua, R, Julia, MATLAB

**Functional:** Haskell, Elixir, Erlang, OCaml, Elm, PureScript, Lean, Idris, Agda, Coq, Roc, Unison, Gleam

**Lisp family:** Clojure, Common Lisp, Scheme, Racket, Fennel, Janet, Hy

**AltJS:** CoffeeScript, LiveScript, ReScript, Reason

**Shell:** Bash, Fish, PowerShell, Nix, Zsh

**Web:** HTML, CSS, SVG, Svelte, Vue, Astro, MDX

**Data/Config:** JSON, YAML, TOML, INI, XML, Protobuf, Prisma, EdgeQL

**Infrastructure:** Dockerfile, Terraform/HCL, Makefile, CMake, Puppet, Ansible, Helm, Bicep, TypeSpec

**Query:** SQL, GraphQL, Cypher

**Academic:** Prolog, Smalltalk, Fortran, COBOL, TCL

**GPU/Hardware:** GLSL, HLSL, Solidity, Verilog, VHDL, Assembly, WAT/WASM

**Diagram:** Mermaid, PlantUML

**Other:** LaTeX, Regex, Diff/Patch, Groovy, Jsonnet

### Usage

```tsx
import { SyntaxHighlight } from "@orchetron/storm-tui";

<SyntaxHighlight
  code={`function greet(name: string): string {
  return \`Hello, \${name}!\`;
}`}
  language="typescript"
/>

// Python
<SyntaxHighlight code={'def factorial(n):\n  return 1 if n <= 1 else n * factorial(n-1)'} language="python" />

// Width-constrained
<SyntaxHighlight code={sourceCode} language="rust" width={80} />
```

### Extending with Custom Languages

```typescript
import { registerLanguage } from "@orchetron/storm-tui";

registerLanguage("mylang", {
  keywords: new Set(["fn", "let", "mut", "if", "else", "return"]),
  typeKeywords: new Set(["int", "str", "bool"]),
  lineComment: "//",
  blockCommentStart: "/*",
  blockCommentEnd: "*/",
  stringDelimiters: ['"', "'"],
});
```

### When to use

Inside code blocks, `CommandBlock` output, `MarkdownText` fenced code blocks (which use this internally), or anywhere source code needs to be displayed. The `MarkdownText` widget automatically delegates to `SyntaxHighlight` for fenced code blocks.

---

## 18. TokenStream

Live token count, speed, and context progress display.

A compact single-row widget showing model name, token counts (total, input, output), tokens-per-second speed (color-coded), and an optional progress bar when `maxTokens` is provided. Designed to be fed updated props from your streaming logic -- this is a display widget, not a stream processor.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `tokens` | `number` | **required** | Total tokens so far. |
| `inputTokens` | `number` | -- | Input/prompt tokens. |
| `outputTokens` | `number` | -- | Output/completion tokens. |
| `tokensPerSecond` | `number` | -- | Current speed in tokens per second. Only shown when `streaming` is true. |
| `maxTokens` | `number` | -- | Context window limit. When provided, shows a progress bar. |
| `model` | `string` | -- | Model name, shown dim with a separator. |
| `streaming` | `boolean` | -- | Whether currently streaming. Controls speed display. |
| `color` | `string \| number` | -- | Override color for token counts. |
| `renderMetric` | `(label: string, value: string \| number) => ReactNode` | -- | Custom render for each metric (label + value pair). |

### Speed Color

| Speed | Color |
|-------|-------|
| >= 30 tok/s | Green |
| < 30 tok/s | Amber |

### Progress Bar Color

| Usage | Color |
|-------|-------|
| <= 70% | Green |
| 70-90% | Amber |
| > 90% | Red |

### Usage

```tsx
import { TokenStream } from "@orchetron/storm-tui";

// Basic streaming display
<TokenStream
  tokens={1650}
  inputTokens={1200}
  outputTokens={450}
  tokensPerSecond={42}
  model="qwen-2.5-72b"
  streaming={true}
/>
// Renders: qwen-2.5-72b . 1.7K tokens (1.2K in / 450 out) . 42 tok/s

// With context progress bar
<TokenStream
  tokens={6500}
  maxTokens={8192}
  model="llama-3.1"
  streaming={false}
/>
// Renders: llama-3.1 . 6.5K tokens . ██████░░ 79%

// Minimal (just total)
<TokenStream tokens={500} />
```

### When to use

Real-time streaming status displays during LLM inference. Place in a status bar or above the chat input to show live metrics. The speed indicator helps users gauge generation performance, and the progress bar warns when context is filling up. Pair with `CostTracker` for cost alongside performance.

---

## 19. WelcomeBanner

Welcome screen with gradient title, subtitle, version, tips, and dismiss handler.

Renders a branded welcome screen with Storm's signature heavy-dash separator and diamond icon. Supports two modes: compact (single line) and full (multi-line with separator, subtitle, version, tip of the day, and dismiss hint). Title can optionally render with a gradient from brand primary to brand light.

### Props

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `"STORM"` | Banner title text. |
| `subtitle` | `string` | `"Terminal UI at the speed of lightning."` | Subtitle text. |
| `version` | `string` | -- | Version string (displayed as `vX.Y.Z`). |
| `showGradient` | `boolean` | `false` | Apply color gradient to the title text. |
| `compact` | `boolean` | `true` | Single-line mode (`true`) vs full multi-line banner (`false`). |
| `tips` | `string[]` | -- | Array of tips. One is randomly selected and displayed (stable across re-renders). |
| `onDismiss` | `() => void` | -- | Callback fired when the user presses any key. Shows "Press any key to continue" hint when set. |
| `renderTitle` | `(title: string) => ReactNode` | -- | Custom render for the banner title (full mode only). |
| `separatorChar` | `string` | `"━"` | Separator character for the banner rule line. |
| `diamondIcon` | `string` | `"◆"` | Diamond icon character before the title. |

### Usage

```tsx
import { WelcomeBanner } from "@orchetron/storm-tui";

// Compact single-line (default)
<WelcomeBanner />
// Renders: ◆ storm . Terminal UI at the speed of lightning.

// Full banner with gradient and version
<WelcomeBanner
  compact={false}
  showGradient={true}
  version="1.2.0"
/>
// Renders:
//   ━━━ ◆ STORM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   Terminal UI at the speed of lightning.  v1.2.0

// With tips and dismiss
<WelcomeBanner
  compact={false}
  tips={[
    "Use /help to see available commands",
    "Press Tab to switch between panes",
    "Ctrl+C to cancel a running operation",
  ]}
  onDismiss={() => setShowBanner(false)}
/>

// Custom branding
<WelcomeBanner
  title="MY AGENT"
  subtitle="AI-powered code assistant"
  version="0.1.0"
  compact={false}
  showGradient
/>
```

### When to use

The first thing users see when launching your AI agent TUI. The compact mode works well as a persistent header, while the full banner mode is ideal for a splash screen that dismisses on keypress. Tips rotate randomly to surface discoverable features.

---

## Import Summary

All widgets are exported from the main entry point `@orchetron/storm-tui`:

```typescript
import {
  AnimatedLogo,
  ApprovalPrompt,
  BlinkDot,
  CommandBlock,
  CommandDropdown,
  ComponentGallery,
  ContextWindow,
  CostTracker,
  MarkdownText,
  MessageBubble,
  ModelBadge,
  OperationTree,
  PerformanceHUD,
  ShimmerText,
  StatusLine,
  StreamingText,
  SyntaxHighlight,
  TokenStream,
  WelcomeBanner,
} from "@orchetron/storm-tui";
```

## Architecture Notes

- **Imperative animation pattern**: All animated widgets (AnimatedLogo, BlinkDot, ShimmerText, StreamingText, OperationTree) use ref mutation + `requestRender()` instead of React state. This is because Storm's custom React reconciler does not flush state updates the way React DOM does. See the [pitfalls guide](./pitfalls.md) for details.

- **Plugin props**: Every widget wraps its raw props through `usePluginProps("WidgetName", rawProps)`, allowing plugins to intercept and modify any widget's props globally.

- **Personality system**: Animated widgets read timing defaults from `usePersonality()`, which provides theme-aware animation durations (`durationFast`, `durationSlow`).

- **Cleanup**: All timer-based widgets register cleanup via `useCleanup()` to prevent leaked intervals on unmount.

- **Memoization**: All widgets are wrapped in `React.memo()` to minimize re-renders in Storm's reconciler.
