# Getting Started with Storm TUI

Storm is a terminal UI framework built on React. It renders to a cell-based buffer, diffs at the cell level, and only writes what changed. If you know React, you know Storm.

## Installation

```bash
npm install @orchetron/storm-tui react
```

Requires Node.js 18+ and React 18 or 19. TypeScript is recommended but not required.

```bash
# With TypeScript (recommended)
npm install @orchetron/storm-tui react typescript @types/react @types/node
```

Your `tsconfig.json` should target ESM:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "jsx": "react-jsx",
    "strict": true,
    "outDir": "dist"
  }
}
```

## Learning Path

**Start here (5 minutes):**
1. Hello World (below)
2. Layout with Box and Text
3. Keyboard input with useInput

**Build your first app (15 minutes):**
4. ScrollView for scrollable content
5. TextInput for user input
6. Tabs for navigation

**Go deeper (as needed):**
- [Hook Guide](hook-guide.md) -- which hook for what
- [Common Pitfalls](pitfalls.md) -- avoid the top 10 mistakes
- [Recipes](recipes.md) -- copy-paste patterns for real apps
- [AI Widgets](widgets.md) -- 19 purpose-built AI agent components
- [DevTools](devtools.md) -- one-line debugging setup

## Your First App

Create `app.tsx`:

```tsx
import { render, Box, Text, Spinner, useInput, useTui } from "@orchetron/storm-tui";

function App() {
  const { exit } = useTui();
  useInput((e) => { if (e.key === "c" && e.ctrl) exit(); });

  return (
    <Box borderStyle="round" borderColor="#82AAFF" padding={1}>
      <Text color="#34D399" bold>Hello, Storm!</Text>
      <Spinner type="dots" />
      <Text dim>Ctrl+C to exit</Text>
    </Box>
  );
}

const app = render(<App />);
await app.waitUntilExit();
```

**Tip:** For convenience, `useApp()` provides just `exit`, `rerender`, and `clear` -- a simpler alternative when you don't need the full context that `useTui()` offers.

**Tip:** Add `enableDevTools(app)` after `render()` to get a render heatmap, accessibility audit, time-travel debugger, and component inspector. See [DevTools Guide](devtools.md).

Run it:

```bash
npx tsx app.tsx
```

`render()` enters the alternate screen buffer, enables raw mode and mouse reporting, then renders your React tree. `waitUntilExit()` returns a promise that resolves when the app exits.

## The Golden Rules

Before you write any Storm code, know these three things:

### Rule 1: Use `useRef` + `requestRender()` for animation and live data

```tsx
// WRONG — triggers full React reconciliation every tick (slow)
const [frame, setFrame] = useState(0);
useEffect(() => { setInterval(() => setFrame(f => f + 1), 100) }, []);

// RIGHT — imperative repaint, 10-20x faster
const frameRef = useRef(0);
const { requestRender } = useTui();
useTick(100, () => { frameRef.current++; });
```

`useState` is for structural changes (switching screens, adding items). For anything that updates frequently (animation, scroll, live metrics), use refs + `requestRender()` or `useTick()`.

**Storm will warn you automatically.** If more than 10 full React reconciliation passes happen in one second, Storm writes a performance warning to stderr pointing you here. The warning fires once per 5 seconds in development, and is capped at 3 occurrences in production.

### Rule 2: Use `useCleanup()`, not `useEffect` cleanup

```tsx
// WRONG — cleanup function will NOT fire in Storm's reconciler
useEffect(() => {
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);  // Never runs!
}, []);

// RIGHT
const timerRef = useRef<ReturnType<typeof setInterval>>();
if (!timerRef.current) timerRef.current = setInterval(tick, 1000);
useCleanup(() => { clearInterval(timerRef.current!); });
```

### Rule 3: ScrollView needs a height constraint

```tsx
// WRONG — expands forever, never scrolls
<ScrollView>{children}</ScrollView>

// RIGHT
<ScrollView height={20}>{children}</ScrollView>
// or
<ScrollView flex={1}>{children}</ScrollView>
```

These rules are the top reasons new apps feel slow or broken. For the full list of gotchas, see [Common Pitfalls](pitfalls.md).

## Layout Basics

Storm uses a flexbox layout engine. Every `Box` is a flex container. The default flex direction is `column` (vertical stacking).

### Vertical and Horizontal Layout

```tsx
// Vertical (default)
<Box flexDirection="column">
  <Text>Top</Text>
  <Text>Bottom</Text>
</Box>

// Horizontal
<Box flexDirection="row" gap={2}>
  <Text>Left</Text>
  <Text>Right</Text>
</Box>
```

### Fixed and Flexible Sizing

```tsx
<Box flexDirection="row" width={80} height={24}>
  {/* Fixed-width sidebar */}
  <Box width={25} borderStyle="single" flexDirection="column" padding={1}>
    <Text bold>Sidebar</Text>
  </Box>

  {/* Flexible content area */}
  <Box flex={1} flexDirection="column" padding={1}>
    <Text>Content fills remaining space</Text>
  </Box>
</Box>
```

### Percentage Sizing

```tsx
<Box flexDirection="row">
  <Box width="30%"><Text>30%</Text></Box>
  <Box width="70%"><Text>70%</Text></Box>
</Box>
```

### Alignment and Justification

```tsx
<Box
  flexDirection="row"
  justifyContent="space-between"
  alignItems="center"
  width={60}
  height={5}
>
  <Text>Left</Text>
  <Text>Center</Text>
  <Text>Right</Text>
</Box>
```

The layout engine supports the full set of flexbox properties: `flexDirection`, `flexGrow`, `flexShrink`, `flexBasis`, `flexWrap`, `gap`, `alignItems` (including `baseline`), `alignSelf`, `alignContent`, `justifyContent` (6 modes), `margin` (including `auto`), `padding`, `overflow`, `position` (`relative`/`absolute`), `order`, `aspectRatio`, `minWidth`/`maxWidth`/`minHeight`/`maxHeight`, and CSS Grid (`gridTemplateColumns`, `gridTemplateRows`, `gridColumn`, `gridRow`, `gridAutoFlow`).

## Handling Input

### Keyboard Input

Use the `useInput` hook to listen for keyboard events:

```tsx
import { useState } from "react";
import { render, Box, Text, useInput, useTui } from "@orchetron/storm-tui";

function App() {
  const [count, setCount] = useState(0);
  const { flushSync, exit } = useTui();

  useInput((event) => {
    if (event.key === "up") {
      flushSync(() => setCount((c) => c + 1));
    }
    if (event.key === "down") {
      flushSync(() => setCount((c) => Math.max(0, c - 1)));
    }
    if (event.char === "q") {
      exit();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Counter: {count}</Text>
      <Text dim>[Up/Down] change value  [q] quit</Text>
    </Box>
  );
}

render(<App />);
```

**Note:** Storm uses a custom React reconciler with `syncContainerUpdate`, which handles most state updates automatically. Basic `setState` calls work without `flushSync`. However, `flushSync()` is recommended for immediate visual feedback -- it guarantees React processes the update synchronously before the next paint, eliminating any batching delay. For high-frequency updates (scroll, animation), prefer `useRef` + `requestRender()` instead -- see [Common Pitfalls](pitfalls.md#usestate-vs-useref--requestrender).

The `KeyEvent` object contains:

| Property | Type | Description |
|---|---|---|
| `key` | `string` | Named key (`"up"`, `"down"`, `"return"`, `"escape"`, `"tab"`, etc.) |
| `char` | `string` | Printable character (e.g. `"a"`, `"1"`, `" "`) |
| `ctrl` | `boolean` | Control key held |
| `shift` | `boolean` | Shift key held |
| `meta` | `boolean` | Meta/Alt key held |

### Text Input

For editable text fields, use the `TextInput` component:

```tsx
import { useState } from "react";
import { render, Box, Text, TextInput } from "@orchetron/storm-tui";

function App() {
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <Box flexDirection="column" padding={1} gap={1}>
      <Text bold>What is your name?</Text>
      <TextInput
        value={name}
        onChange={setName}
        onSubmit={() => setSubmitted(true)}
        placeholder="Type your name..."
      />
      {submitted && <Text color="#34D399">Hello, {name}!</Text>}
    </Box>
  );
}

render(<App />);
```

`TextInput` handles cursor positioning, history navigation (with the `history` prop), undo/redo (Ctrl+Z / Ctrl+Y), and word-level movement (Ctrl+Left/Right).

### Mouse Input

```tsx
import { useMouse } from "@orchetron/storm-tui";

function MyComponent() {
  useMouse((event) => {
    if (event.action === "press" && event.button === "left") {
      console.log(`Clicked at (${event.x}, ${event.y})`);
    }
  });

  return <Text>Click me</Text>;
}
```

Mouse scroll events are automatically routed to the `ScrollView` under the cursor via hit-testing.

## Scrolling

Use `ScrollView` for content that overflows its container:

```tsx
import { render, Box, Text, ScrollView, useTerminal } from "@orchetron/storm-tui";

function App() {
  const { width, height } = useTerminal();

  const items = Array.from({ length: 100 }, (_, i) => `Item ${i + 1}`);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color="#82AAFF">Scrollable List</Text>
      <ScrollView flex={1}>
        {items.map((item) => (
          <Text key={item}>{item}</Text>
        ))}
      </ScrollView>
      <Text dim>Scroll with mouse wheel or trackpad</Text>
    </Box>
  );
}

render(<App />);
```

Key `ScrollView` props:

| Prop | Type | Default | Description |
|---|---|---|---|
| `stickToBottom` | `boolean` | `false` | Auto-scroll to bottom when new content appears |
| `scrollSpeed` | `number` | -- | Lines per scroll event |
| `scrollbarThumbColor` | `string \| number` | theme brand | Color of the scrollbar thumb |
| `scrollbarTrackColor` | `string \| number` | -- | Color of the scrollbar track |

Scroll is hit-tested: only the `ScrollView` under the mouse cursor receives scroll events. Multiple `ScrollView` components can coexist independently.

## Theming

Storm ships with a default color palette and four presets. Use `ThemeProvider` to apply a theme:

```tsx
import { render, Box, Text, ThemeProvider, neonTheme, useTheme } from "@orchetron/storm-tui";

function ThemedContent() {
  const { colors } = useTheme();
  return (
    <Box borderStyle="round" borderColor={colors.brand.primary} padding={1}>
      <Text color={colors.text.primary}>
        Themed content
      </Text>
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={neonTheme}>
      <ThemedContent />
    </ThemeProvider>
  );
}

render(<App />);
```

Built-in presets: `neonTheme` (hyper-saturated gold), `calmTheme` (muted warm tones), `highContrastTheme` (WCAG accessibility), `monochromeTheme` (all greys). See the [Theming Guide](./theming.md) for full details.

## Style Props

Storm uses a three-tiered style customization system. Every component accepts style props from its tier:

**Tier 1 -- Text styles** (inline components like `Text`, `Badge`, `Spinner`):

```tsx
<Text color="#82AAFF" bold dim>Styled text</Text>
```

**Tier 2 -- Layout styles** (adds sizing and margin):

```tsx
<Button label="Click" width={20} margin={1} color="#34D399" />
```

**Tier 3 -- Container styles** (adds padding, border, background):

```tsx
<Card
  borderStyle="round"
  borderColor="#82AAFF"
  padding={2}
  backgroundColor="#141414"
>
  <Text>Content</Text>
</Card>
```

### StyleSheet API

For CSS-like styling across your app, use the `StyleSheet` system:

```tsx
import { createStyleSheet, StyleProvider, useStyles, Box, Text } from "@orchetron/storm-tui";

const sheet = createStyleSheet({
  "Box":             { padding: 1 },
  "Text":            { color: "white" },
  "Text.title":      { bold: true, color: "cyan" },
  "Button:focus":    { inverse: true },
  "Box.sidebar Text": { dim: true },
});

function MyText({ className }: { className?: string }) {
  const styles = useStyles("Text", className);
  return <Text {...styles}>Hello</Text>;
}

function App() {
  return (
    <StyleProvider sheet={sheet}>
      <MyText className="title" />
    </StyleProvider>
  );
}
```

Selectors support type selectors (`"Box"`), class selectors (`".title"`), state pseudo-classes (`":focus"`), and descendant combinators (`"Box.sidebar Text"`).

## Component Defaults

Every component reads visual defaults from a centralized `DEFAULTS` object. You can import and inspect these:

```tsx
import { DEFAULTS } from "@orchetron/storm-tui";

// DEFAULTS.card.borderStyle === "round"
// DEFAULTS.card.paddingLeft === 2
// DEFAULTS.modal.width === 60
// DEFAULTS.progressBar.filledChar === "█"
```

Override any default by passing the corresponding prop directly to the component.

## Full-Screen App Pattern

Most Storm apps fill the terminal. Here is the standard pattern:

```tsx
import { useState } from "react";
import {
  render, Box, Text, ScrollView, TextInput,
  useInput, useTerminal, useTui,
} from "@orchetron/storm-tui";

function App() {
  const { width, height } = useTerminal();
  const { flushSync, exit } = useTui();
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");

  useInput((e) => {
    if (e.key === "q" && e.ctrl) exit();
  });

  const handleSubmit = (value: string) => {
    flushSync(() => {
      setMessages((m) => [...m, value]);
      setInput("");
    });
  };

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box borderStyle="double" borderColor="#82AAFF" paddingX={1}>
        <Text bold color="#82AAFF">My App</Text>
      </Box>

      <ScrollView flex={1} stickToBottom>
        {messages.map((msg, i) => (
          <Text key={i}>{msg}</Text>
        ))}
      </ScrollView>

      <TextInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        placeholder="Type a message..."
      />
    </Box>
  );
}

const app = render(<App />);
await app.waitUntilExit();
```

## Render Options

`render()` accepts options to control terminal behavior:

```tsx
const app = render(<App />, {
  alternateScreen: true,  // Use alternate screen buffer (default: true)
  mouse: true,            // Enable mouse reporting (default: true)
  rawMode: true,          // Enable raw mode on stdin (default: true)
  maxFps: 60,             // Frame rate cap (default: 60)
  autoScroll: false,      // Auto-wrap root in ScrollView (default: false)
  patchConsole: true,     // Intercept console.log/warn/error and route through TUI via commitText(). Prevents console output from corrupting the alternate screen. Output appears above the live area. Does not write to files — for file logging use fs.appendFileSync() directly.
  debugRainbow: false,    // Colorize changed lines for visual debugging
  onRender: (metrics) => {
    // Called after each frame with timing info
  },
  onError: (error) => {
    // Custom error handler
  },
});
```

The returned `TuiApp` object provides:

| Method | Description |
|---|---|
| `unmount()` | Tear down the app and restore terminal |
| `rerender(element)` | Replace the root element |
| `waitUntilExit()` | Promise that resolves when the app exits |
| `clear()` | Force a full redraw |
| `recalculateLayout()` | Invalidate layout cache and repaint |
| `screen` | Access to the `Screen` instance |
| `input` | Access to the `InputManager` |
| `pluginManager` | Register lifecycle plugins |

## Next Steps

- [Components](./components.md) -- all 92 components with props and examples
- [AI Widgets](./widgets.md) -- 19 purpose-built AI agent components
- [Hook Guide](./hook-guide.md) -- which hook for what, 74 hooks documented
- [Theming & Styling](./theming.md) -- color palettes, custom themes, runtime switching
- [Animations](./animations.md) -- Transition, AnimatePresence, useTransition, easing
- [DevTools](./devtools.md) -- heatmap, a11y audit, time-travel, inspector
- [Plugins](./plugins.md) -- lifecycle hooks, input interception, custom elements
- [i18n](./i18n.md) -- locale, direction, pluralization rules
- [Recipes](./recipes.md) -- copy-paste patterns for real apps
- [Common Pitfalls](./pitfalls.md) -- avoid the top mistakes
- [Performance](./performance.md) -- cell-level diff, WASM, frame rate control

## Testing Your App

Storm includes testing utilities for rendering components without a terminal:

```tsx
import { renderForTest } from "@orchetron/storm-tui/testing";

const result = renderForTest(<MyComponent />);
expect(result.hasText("Hello")).toBe(true);

// Simulate input
result.pressEnter();
result.type("hello world");
result.fireKey({ key: "tab" });

// Assert output
expect(result.getLine(0)).toContain("Expected text");
```

For headless rendering in CI or non-interactive contexts, use `renderToString()`:

```tsx
import { renderToString, Box, Text } from "@orchetron/storm-tui";

const { output, cleanup } = renderToString(
  <Box padding={1}>
    <Text bold>Build succeeded</Text>
  </Box>,
  { width: 60, height: 10 }
);

console.log(output);
cleanup();
```

## Platform Support

| Platform | Status |
|---|---|
| macOS | Fully supported |
| Linux | Fully supported |
| Windows Terminal | Experimental -- basic rendering works, some features (mouse, OSC sequences) may not work |
| Legacy Windows Console | Not supported |
