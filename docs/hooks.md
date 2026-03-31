# Hooks Reference

> For a guide on choosing the right hook, see [Hook Guide](hook-guide.md).

Storm provides 26 hooks for input handling, focus management, animation, terminal info, accessibility, and more. All hooks use Storm's eager registration pattern -- handlers are registered immediately during render (not in `useEffect`) because `useEffect` cleanup does not fire reliably in the custom reconciler.

All hooks import from `@orchetron/storm-tui`.

---

## Input Handling

### useInput

Subscribe to keyboard events. The handler receives a `KeyEvent` with properties for the key name, modifier keys, and printable character.

The `isActive` option allows conditional listening -- when `false`, events are silently ignored without unsubscribing. This is cheaper than toggling subscriptions.

```tsx
import { useInput } from "@orchetron/storm-tui";

function VimNavigator({ onMove }: { onMove: (dir: string) => void }) {
  useInput((event) => {
    if (event.key === "up" || event.char === "k") onMove("up");
    if (event.key === "down" || event.char === "j") onMove("down");
    if (event.key === "left" || event.char === "h") onMove("left");
    if (event.key === "right" || event.char === "l") onMove("right");
    if (event.key === "c" && event.ctrl) process.exit(0);
  }, { isActive: true });

  return <Text>Use arrow keys or hjkl to navigate</Text>;
}
```

**Signature:** `useInput(handler: (event: KeyEvent) => void, options?: { isActive?: boolean }) => void`

---

### useMouse

Subscribe to mouse events including clicks, scroll, and motion. The handler receives a `MouseEvent` with x/y coordinates, button type, and modifier keys. Mouse scroll events for ScrollView are handled via hit-testing in the renderer -- this hook is for custom mouse handling.

```tsx
import { useMouse } from "@orchetron/storm-tui";

function ClickTarget() {
  useMouse((event) => {
    if (event.button === "left") {
      console.log(`Clicked at ${event.x}, ${event.y}`);
    }
    if (event.button === "scroll-up") {
      console.log("Scrolled up");
    }
  }, { isActive: true });

  return <Text>Click anywhere...</Text>;
}
```

**Signature:** `useMouse(handler: (event: MouseEvent) => void, options?: { isActive?: boolean }) => void`

---

## Terminal

### useTerminal

Reactive terminal dimensions that update on resize, plus an `exit` function. Width and height reflect the current terminal size in columns and rows.

```tsx
import { useTerminal, Box, Text } from "@orchetron/storm-tui";

function ResponsiveLayout() {
  const { width, height, exit } = useTerminal();

  return (
    <Box flexDirection="column">
      <Text>Terminal: {width}x{height}</Text>
      {width < 80 && <Text color="#FBBF24">Warning: narrow terminal</Text>}
      <Button label="Quit" onPress={() => exit()} />
    </Box>
  );
}
```

**Signature:** `useTerminal() => { width: number; height: number; exit: () => void }`

---

## App Context

### useTui

Access the full TUI context including screen, input manager, focus manager, exit, requestRender, flushSync, clear, and renderContext. This is the low-level escape hatch -- prefer the specific hooks (useTerminal, useInput, etc.) when possible.

```tsx
import { useTui } from "@orchetron/storm-tui";

function ImmediateUpdate() {
  const { requestRender, flushSync, exit, clear } = useTui();

  // Force an immediate paint cycle
  requestRender();

  // Run a state update synchronously (not batched)
  flushSync(() => {
    someRef.current = newValue;
  });

  // Clear and repaint the entire screen
  clear();

  return <Text>Low-level TUI access</Text>;
}
```

**Signature:** `useTui() => TuiContextValue` (includes `screen`, `input`, `focus`, `exit`, `requestRender`, `flushSync`, `clear`, `renderContext`, `commitText`)

---

## Theme

### useTheme

Access the active theme colors and auto-generated shades. Returns the theme from the nearest `ThemeProvider`, or the default teal palette if none is present.

```tsx
import { useTheme, Box, Text } from "@orchetron/storm-tui";

function ThemedStatus({ ok }: { ok: boolean }) {
  const { colors, shades } = useTheme();

  return (
    <Box borderStyle="single" borderColor={colors.divider}>
      <Text color={ok ? colors.success : colors.error} bold>
        {ok ? "Healthy" : "Degraded"}
      </Text>
      <Text color={shades.brand.lighten2}>
        Last check: just now
      </Text>
    </Box>
  );
}
```

**Signature:** `useTheme() => { colors: StormColors; shades: ThemeShades }`

---

## Focus Management

### useFocus

Make a component focusable within the Tab-cycling focus ring. Returns whether the component is currently focused and a function to programmatically claim focus.

```tsx
import { useFocus, Box, Text } from "@orchetron/storm-tui";

function FocusablePanel({ label }: { label: string }) {
  const { isFocused, focus } = useFocus({ autoFocus: false });

  return (
    <Box
      borderStyle="single"
      borderColor={isFocused ? "#82AAFF" : "#505050"}
      padding={1}
    >
      <Text bold={isFocused}>{label}</Text>
      {isFocused && <Text color="#82AAFF"> (focused)</Text>}
    </Box>
  );
}
```

**Signature:** `useFocus(options?: { id?: string; autoFocus?: boolean }) => { isFocused: boolean; focus: () => void }`

---

### useFocusManager

Programmatic focus control -- cycle through focusable elements, jump to a specific ID, or enable/disable the focus system entirely.

```tsx
import { useFocusManager, useInput, Box } from "@orchetron/storm-tui";

function FocusController() {
  const { focusNext, focusPrevious, focus } = useFocusManager();

  useInput((event) => {
    if (event.key === "tab" && event.shift) focusPrevious();
    else if (event.key === "tab") focusNext();
    else if (event.char === "1") focus("panel-1");
    else if (event.char === "2") focus("panel-2");
  });

  return <Text dim>Tab to cycle focus, 1/2 to jump</Text>;
}
```

**Signature:** `useFocusManager() => { enableFocus, disableFocus, focusNext, focusPrevious, focus: (id: string) => void }`

---

## Keyboard Shortcuts

### useKeyboardShortcuts

Declarative keyboard shortcut system. Define an array of shortcut definitions (key + modifiers + handler) and the hook matches incoming key events against them. Builds on `useInput` internally.

```tsx
import { useKeyboardShortcuts } from "@orchetron/storm-tui";

function Editor() {
  useKeyboardShortcuts([
    { key: "s", ctrl: true, handler: () => save(), description: "Save file" },
    { key: "z", ctrl: true, handler: () => undo(), description: "Undo" },
    { key: "y", ctrl: true, handler: () => redo(), description: "Redo" },
    { key: "f", ctrl: true, handler: () => openSearch(), description: "Find" },
    { key: "q", ctrl: true, handler: () => exit(), description: "Quit" },
  ]);

  return <Text>Editor ready. Ctrl+S to save.</Text>;
}
```

**Signature:** `useKeyboardShortcuts(shortcuts: Shortcut[], options?: { isActive?: boolean }) => void`

`Shortcut` type: `{ key: string; ctrl?: boolean; meta?: boolean; shift?: boolean; handler: () => void; description?: string }`

---

## Resource Cleanup

### useCleanup

Register a cleanup function that runs when the app unmounts. This is the only reliable way to clean up timers, listeners, and subscriptions in Storm's reconciler, since `useEffect` cleanup does not fire.

```tsx
import { useCleanup } from "@orchetron/storm-tui";

function WebSocketMonitor({ url }: { url: string }) {
  const wsRef = useRef<WebSocket | null>(null);

  if (!wsRef.current) {
    wsRef.current = new WebSocket(url);
  }

  useCleanup(() => {
    wsRef.current?.close();
    wsRef.current = null;
  });

  return <Text>Connected to {url}</Text>;
}
```

**Signature:** `useCleanup(fn: () => void) => void`

---

## Timing

### useAnimation

Frame-based animation hook. Registers with Storm's global AnimationScheduler so all animations share a single timer -- preventing timer thrashing. Returns the current frame count and a ref for imperative text node updates.

```tsx
import { useAnimation } from "@orchetron/storm-tui";

const FRAMES = ["-", "\\", "|", "/"];

function CustomSpinner() {
  const { frame, textRef } = useAnimation({ interval: 80 });

  return (
    <Text _textNodeRef={textRef}>{FRAMES[frame % FRAMES.length]}</Text>
  );
}
```

**Signature:** `useAnimation(options?: { interval?: number; active?: boolean }) => { frame: number; textRef: RefObject<any>; tick: () => void }`

---

### useInterval

Repeating timer with automatic cleanup. The callback is stored in a ref so it always accesses the latest closure values. The `active` option pauses/resumes without destroying the timer.

```tsx
import { useInterval } from "@orchetron/storm-tui";

function Clock() {
  const timeRef = useRef(new Date());
  const { requestRender } = useTui();

  useInterval(() => {
    timeRef.current = new Date();
    requestRender();
  }, 1000);

  return <Text>{timeRef.current.toLocaleTimeString()}</Text>;
}
```

**Signature:** `useInterval(callback: () => void, delayMs: number, options?: { active?: boolean }) => void`

---

### useTimeout

One-shot timer with automatic cleanup. Fires the callback once after the specified delay. The callback ref is updated each render so the timeout always calls the latest version.

```tsx
import { useTimeout } from "@orchetron/storm-tui";

function SplashScreen({ onDone }: { onDone: () => void }) {
  useTimeout(() => {
    onDone();
  }, 3000);

  return <Text bold color="#82AAFF">Welcome to Storm TUI</Text>;
}
```

**Signature:** `useTimeout(callback: () => void, delayMs: number) => void`

---

## Virtualization

### useVirtualList

Efficient rendering of large datasets by computing only the visible slice plus overscan. Returns the visible items with their offset positions and scroll control functions. Uses `requestRender()` instead of React state for instant scroll response.

```tsx
import { useVirtualList, Box, Text } from "@orchetron/storm-tui";

function BigList({ items }: { items: string[] }) {
  const { visibleItems, totalHeight, onScroll, scrollToTop } = useVirtualList({
    items,
    itemHeight: 1,
    viewportHeight: 20,
    overscan: 5,
  });

  useMouse((event) => {
    if (event.button === "scroll-up") onScroll(-3);
    if (event.button === "scroll-down") onScroll(3);
  });

  return (
    <Box flexDirection="column" height={20}>
      {visibleItems.map(({ item, index }) => (
        <Text key={index}>{item}</Text>
      ))}
    </Box>
  );
}
```

**Signature:** `useVirtualList<T>(options: { items: T[]; itemHeight?: number; viewportHeight: number; overscan?: number }) => { visibleItems, totalHeight, scrollTop, scrollTo, scrollToTop, scrollToBottom, onScroll }`

---

## Clipboard

### useClipboard

Read and write the system clipboard via OSC 52 escape sequences. Works in terminals that support OSC 52 (most modern terminals including iTerm2, WezTerm, Kitty, and recent versions of Terminal.app).

```tsx
import { useClipboard, Button, Text } from "@orchetron/storm-tui";

function CopyButton({ text }: { text: string }) {
  const { copy, content } = useClipboard();

  return (
    <Box flexDirection="row" gap={2}>
      <Button label="Copy" onPress={() => copy(text)} />
      {content && <Text dim>Copied: {content.slice(0, 20)}...</Text>}
    </Box>
  );
}
```

**Signature:** `useClipboard() => { copy: (text: string) => void; read: () => void; content: string | null }`

---

### usePaste

Subscribe to bracketed paste events. Receives the pasted text as a string. Separate from `useInput` because paste events can contain newlines and special characters that would be ambiguous as key events.

```tsx
import { usePaste } from "@orchetron/storm-tui";

function PasteTarget() {
  const [pasted, setPasted] = useState("");

  usePaste((text) => {
    setPasted(text);
    console.log("Pasted:", text.length, "characters");
  });

  return <Text>{pasted || "Paste something here..."}</Text>;
}
```

**Signature:** `usePaste(handler: (text: string) => void, options?: { isActive?: boolean }) => void`

---

## Accessibility

### useAccessibility

Access all accessibility preferences detected from environment variables. Includes high contrast mode, reduced motion preference, and screen reader detection. Results are cached in a ref for zero-cost repeated access.

```tsx
import { useAccessibility, Spinner, Text } from "@orchetron/storm-tui";

function LoadingIndicator() {
  const a11y = useAccessibility();

  if (a11y.reducedMotion) {
    return <Text>Loading...</Text>;
  }

  return <Spinner type="dots" label="Loading..." />;
}
```

**Signature:** `useAccessibility() => { highContrast: boolean; reducedMotion: boolean; screenReader: boolean }`

---

### useReducedMotion

Convenience hook that returns `true` if the user prefers reduced motion. Components should check this before starting animations. Uses `useAccessibility` internally.

```tsx
import { useReducedMotion } from "@orchetron/storm-tui";

function AnimatedBorder() {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <Box borderStyle="single" borderColor="#82AAFF"><Text>Static</Text></Box>;
  }

  return <GlowText>Animated glow effect</GlowText>;
}
```

**Signature:** `useReducedMotion() => boolean`

---

### useIsScreenReaderEnabled

Detects whether a screen reader or accessibility tool is active by checking the `ACCESSIBILITY` and `SCREEN_READER` environment variables. Use this to provide alternative text-only representations of visual content.

```tsx
import { useIsScreenReaderEnabled, Sparkline, Text } from "@orchetron/storm-tui";

function DataViz({ data }: { data: number[] }) {
  const screenReader = useIsScreenReaderEnabled();

  if (screenReader) {
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    return <Text>Average value: {avg.toFixed(1)}</Text>;
  }

  return <Sparkline data={data} width={30} />;
}
```

**Signature:** `useIsScreenReaderEnabled() => boolean`

---

## Scroll Control

### useScroll

Imperative scroll state management with mouse and keyboard handlers pre-wired. Returns the current scroll position and functions to scroll absolutely, relatively, or to the bottom. Handles PgUp/PgDown, Shift+Up/Down, and mouse scroll out of the box.

```tsx
import { useScroll, Box, Text } from "@orchetron/storm-tui";

function CustomScrollArea({ lines, viewportHeight }: { lines: string[]; viewportHeight: number }) {
  const { scrollTop, scrollTo, scrollToBottom, isAtBottom } = useScroll({
    contentHeight: lines.length,
    viewportHeight,
    speed: 3,
  });

  const visible = lines.slice(scrollTop, scrollTop + viewportHeight);

  return (
    <Box flexDirection="column" height={viewportHeight}>
      {visible.map((line, i) => (
        <Text key={scrollTop + i}>{line}</Text>
      ))}
      {!isAtBottom && <Text dim>... more below (PgDn)</Text>}
    </Box>
  );
}
```

**Signature:** `useScroll(options: { speed?: number; contentHeight: number; viewportHeight: number }) => { scrollTop, maxScroll, isAtBottom, scrollTo, scrollBy, scrollToBottom }`

---

## Style Sheets

### useStyles

Reserved hook for creating scoped style sheets. Allows defining reusable style objects that map to Storm's style system.

```tsx
import { useTheme } from "@orchetron/storm-tui";

function StyledComponent() {
  const { colors } = useTheme();

  // Pattern: define style objects using theme colors
  const styles = {
    container: { borderStyle: "round" as const, borderColor: colors.brand.primary, padding: 1 },
    title: { color: colors.brand.primary, bold: true },
    body: { color: colors.text.secondary },
  };

  return (
    <Box {...styles.container}>
      <Text {...styles.title}>Title</Text>
      <Text {...styles.body}>Body text</Text>
    </Box>
  );
}
```

---

## Measurement

### useMeasure

Read the computed layout measurements (x, y, width, height) for an element identified by its `_measureId` prop. Measurements are populated after each paint pass, so the returned value reflects the previous frame's layout.

```tsx
import { useMeasure, Box, Text } from "@orchetron/storm-tui";

function MeasuredBox() {
  const layout = useMeasure("my-box");

  return (
    <Box _measureId="my-box" borderStyle="single" padding={1}>
      {layout && (
        <Text dim>
          Size: {layout.width}x{layout.height} at ({layout.x}, {layout.y})
        </Text>
      )}
    </Box>
  );
}
```

**Signature:** `useMeasure(elementId: string) => { x: number; y: number; width: number; height: number } | null`

---

## Plugin System

### usePluginManager

Access the shared PluginManager instance for registering plugins, querying custom elements, or accessing plugin-provided shortcuts. Returns a stable instance that persists across renders.

```tsx
import { usePluginManager } from "@orchetron/storm-tui";

function PluginLoader() {
  const plugins = usePluginManager();

  if (!plugins.has("syntax-highlight")) {
    plugins.register({
      name: "syntax-highlight",
      // ... plugin definition
    });
  }

  return <Text>Plugins loaded: {plugins.list().length}</Text>;
}
```

**Signature:** `usePluginManager() => PluginManager`

---

## Responsive

### useAdaptive

Detect terminal capabilities including image protocol support, color depth, and Unicode support. Results are computed once on first call and cached. Use this to adapt rendering based on what the terminal can display.

```tsx
import { useAdaptive, Image, Text } from "@orchetron/storm-tui";

function SmartImage({ src }: { src: string }) {
  const adaptive = useAdaptive();

  if (adaptive.imageProtocol === "kitty" || adaptive.imageProtocol === "iterm2") {
    return <Image src={src} />;
  }

  return <Text dim>[Image: {src}]</Text>;
}
```

**Signature:** `useAdaptive() => { imageProtocol: "kitty" | "iterm2" | "sixel" | "block"; colorDepth: "truecolor" | "256" | "16" | "basic"; unicode: boolean }`

---

## Screen Reader Announcements

### useAnnounce

Announce dynamic content changes to screen readers via OSC 99 escape sequences. Provides both polite announcements (wait for idle) and urgent/assertive announcements (interrupt current speech).

```tsx
import { useAnnounce, Button } from "@orchetron/storm-tui";

function SaveButton({ onSave }: { onSave: () => Promise<void> }) {
  const { announce, announceUrgent } = useAnnounce();

  const handleSave = async () => {
    try {
      await onSave();
      announce("File saved successfully");
    } catch (err) {
      announceUrgent("Save failed: " + (err as Error).message);
    }
  };

  return <Button label="Save" onPress={handleSave} />;
}
```

**Signature:** `useAnnounce() => { announce: (message: string) => void; announceUrgent: (message: string) => void }`

---

## App Lifecycle

### useApp

App-level controls for exiting, requesting re-renders, and clearing the screen. This is a convenience wrapper around `useTui` that exposes the three most common app-level operations.

```tsx
import { useApp, useInput, Text } from "@orchetron/storm-tui";

function App() {
  const { exit, rerender, clear } = useApp();

  useInput((event) => {
    if (event.char === "q") exit();
    if (event.char === "r") rerender();
    if (event.key === "l" && event.ctrl) clear();
  });

  return <Text>Press q to quit, r to rerender, Ctrl+L to clear</Text>;
}
```

**Signature:** `useApp() => { exit: (error?: Error) => void; rerender: () => void; clear: () => void }`
