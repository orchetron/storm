# Common Pitfalls

Read this before you write your first component. These are the gotchas that trip up every new Storm TUI developer, and the patterns that fix them.

---

## 1. useState vs useRef + requestRender()

Storm TUI uses a custom React reconciler with a cell-based buffer renderer. This means React state updates are more expensive than you might expect.

**The cost:**
- `useState` setter triggers full React reconciliation, layout rebuild, paint, and diff (~5-10ms)
- `useRef` mutation + `requestRender()` skips reconciliation entirely and repaints from cached layout (~0.5ms)

**The rule:**
- Use `useState` for **structural** changes: showing/hiding panels, adding/removing list items, changing which component renders
- Use `useRef` + `requestRender()` for **visual** updates: scroll position, cursor movement, animation frames, highlight toggling

### Wrong: useState for scroll position

```tsx
function ChatLog({ messages }: { messages: string[] }) {
  const [scrollTop, setScrollTop] = useState(0);

  // Every scroll event triggers full reconciliation — laggy at 60fps
  useInput((event) => {
    if (event.key === "up") setScrollTop((s) => Math.max(0, s - 1));
    if (event.key === "down") setScrollTop((s) => s + 1);
  });

  return <Box height={20}>/* render with scrollTop */</Box>;
}
```

### Right: useRef + requestRender() for scroll position

```tsx
function ChatLog({ messages }: { messages: string[] }) {
  const { requestRender } = useTui();
  const scrollTopRef = useRef(0);

  // Mutate the ref and request a fast repaint — 10x faster
  useInput((event) => {
    if (event.key === "up") {
      scrollTopRef.current = Math.max(0, scrollTopRef.current - 1);
      requestRender();
    }
    if (event.key === "down") {
      scrollTopRef.current += 1;
      requestRender();
    }
  });

  return <Box height={20}>/* render with scrollTopRef.current */</Box>;
}
```

This is how `useScroll` and `useAnimation` work internally. Follow the same pattern for any high-frequency visual update.

---

## 2. ScrollView needs a height constraint

`ScrollView` can only scroll when it knows how tall it is. Without a height constraint, it expands to fit all content and there is nothing to scroll.

### Wrong: no constraint

```tsx
// ScrollView expands to fit all children — no scrolling happens
<Box flexDirection="column">
  <ScrollView>
    {items.map((item) => <Text key={item.id}>{item.text}</Text>)}
  </ScrollView>
</Box>
```

### Right: use flex={1} or a fixed height

```tsx
// Option A: flex to fill available space (most common)
<Box flexDirection="column" height="100%">
  <Text>Header</Text>
  <ScrollView flex={1}>
    {items.map((item) => <Text key={item.id}>{item.text}</Text>)}
  </ScrollView>
  <Text>Footer</Text>
</Box>

// Option B: fixed height
<ScrollView height={20}>
  {items.map((item) => <Text key={item.id}>{item.text}</Text>)}
</ScrollView>
```

### Chat apps: enable stickToBottom

`stickToBottom` defaults to `false`. For chat-style interfaces where new content appears at the bottom, turn it on:

```tsx
<ScrollView flex={1} stickToBottom={true}>
  {messages.map((msg) => <Text key={msg.id}>{msg.text}</Text>)}
</ScrollView>
```

When `stickToBottom` is active and the user is scrolled to the bottom, new children automatically keep the view pinned to the latest content.

---

## 3. Don't nest Box inside Text

`Text` is for styled inline content. `Box` is for layout. Nesting a `Box` inside `Text` silently breaks layout calculations because the reconciler treats `Text` children as inline content, not layout nodes.

### Wrong: Box inside Text

```tsx
// Layout breaks silently — the Box is ignored or mispositioned
<Text color="green">
  Status: <Box width={10}><Text>OK</Text></Box>
</Text>
```

### Right: Box containing Text children

```tsx
// Box handles layout, Text handles styling
<Box>
  <Text color="green">Status: </Text>
  <Box width={10}><Text>OK</Text></Box>
</Box>
```

`Text` can nest inside `Text` for inline styling:

```tsx
// This is fine — inline style nesting
<Text>
  Hello <Text bold>world</Text>, welcome to <Text color="cyan">Storm</Text>
</Text>
```

---

## 4. useCleanup instead of useEffect

Storm's custom reconciler does not reliably fire `useEffect` cleanup functions. If you use `useEffect` to set up a timer or event listener, the cleanup callback may never run, causing memory leaks and ghost handlers.

Always use `useCleanup()` for anything that needs teardown.

### Wrong: useEffect for cleanup

```tsx
function Poller({ url }: { url: string }) {
  useEffect(() => {
    const id = setInterval(() => fetch(url), 5000);
    return () => clearInterval(id); // This cleanup may never fire
  }, [url]);

  return <Text>Polling...</Text>;
}
```

### Right: useCleanup

```tsx
import { useCleanup } from "@orchetron/storm";

function Poller({ url }: { url: string }) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!timerRef.current) {
    timerRef.current = setInterval(() => fetch(url), 5000);
  }

  // This is guaranteed to run on app unmount
  useCleanup(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
    }
  });

  return <Text>Polling...</Text>;
}
```

`useCleanup` registers with the render context and fires when the app unmounts. It is the only reliable teardown mechanism in Storm TUI.

---

## 5. flushSync is for React state only

Storm exposes `flushSync` from `useTui()`. It forces synchronous React reconciliation so that state updates inside the callback commit immediately, rather than being batched.

The catch: `flushSync` only works with React state setters. Mutating a ref inside `flushSync` does nothing because refs do not trigger React reconciliation.

### Right: flushSync with setState

```tsx
function ConfirmDialog() {
  const { flushSync } = useTui();
  const [visible, setVisible] = useState(false);

  const showImmediately = () => {
    // The dialog renders on the very next frame — no batching delay
    flushSync(() => setVisible(true));
  };

  return visible ? <Modal visible onClose={() => setVisible(false)}>
    <Text>Are you sure?</Text>
  </Modal> : null;
}
```

### Wrong: flushSync with ref mutation

```tsx
function Broken() {
  const { flushSync, requestRender } = useTui();
  const scrollRef = useRef(0);

  const jumpToTop = () => {
    // Does nothing — ref changes don't trigger React
    flushSync(() => { scrollRef.current = 0; });

    // Instead, mutate and request repaint:
    scrollRef.current = 0;
    requestRender();
  };
}
```

**Rule of thumb:** if you are changing a ref, use `requestRender()`. If you are changing state and need it to commit synchronously, use `flushSync()`.

---

## 6. Keyboard input: which hook to use?

Storm provides three input hooks at different abstraction levels.

### useInput — raw key events

The lowest level. You get every key press and handle matching yourself.

```tsx
import { useInput } from "@orchetron/storm";

useInput((event) => {
  if (event.key === "escape") handleClose();
  if (event.ctrl && event.key === "s") handleSave();
  if (event.char === "q") handleQuit();
});
```

Good for: simple components with 1-3 key bindings, custom key processing logic.

### useHotkey — shortcuts with display labels

Returns a `bindings` array you can render into a help bar.

```tsx
import { useHotkey } from "@orchetron/storm";

const { bindings } = useHotkey({
  hotkeys: [
    { key: "q", label: "Quit", action: handleQuit },
    { key: "s", ctrl: true, label: "Save", action: handleSave },
    { key: "f", ctrl: true, label: "Find", action: handleFind },
  ],
});

// Render a footer help bar from bindings
return (
  <Box>
    {bindings.map((b) => (
      <Text key={b.label}> {b.description} {b.label} </Text>
    ))}
  </Box>
);
```

Good for: apps that show a keyboard shortcut help bar or legend.

### Decision guide

Start with `useInput`. If you want to render a help bar from the shortcut definitions, use `useHotkey`.

---

## 7. Focus management basics

Storm has a built-in focus system. Components opt in with `useFocus()`.

```tsx
import { useFocus } from "@orchetron/storm";

function MyButton({ label }: { label: string }) {
  const { isFocused, focus } = useFocus();

  return (
    <Box borderStyle={isFocused ? "double" : "single"}>
      <Text bold={isFocused}>{label}</Text>
    </Box>
  );
}
```

**Key behaviors:**
- Components with `useFocus()` are automatically added to the tab order
- The first registered component gets auto-focused
- Tab cycles through all focusable components
- `tabIndex` controls order (lower values receive focus first)

```tsx
// Custom tab order: search gets focus before list
const search = useFocus({ tabIndex: 0 });
const list = useFocus({ tabIndex: 1 });
const sidebar = useFocus({ tabIndex: 2 });
```

**Focus trapping for modals:**

The `Modal` component automatically traps focus. All keyboard input is captured at the highest priority while the modal is visible. You do not need to set this up manually.

```tsx
// Focus is automatically trapped inside the modal
<Modal visible={showDialog} onClose={() => setShowDialog(false)}>
  <Text>This modal traps focus. Tab only cycles within it.</Text>
  <Button label="OK" onPress={() => setShowDialog(false)} />
</Modal>
```

If you need manual focus trapping outside of Modal, use `FocusGroup` with a `group` identifier on your `useFocus` calls.

> **Note:** Input components (TextInput, ChatInput, SearchInput, MaskedInput) accept both `focus` and `isFocused` props. All other interactive components use `isFocused`. We recommend using `isFocused` consistently across your app.

---

## 8. Animation: use the framework's tools

Storm provides animation primitives that sync to a global scheduler. Using them instead of raw timers avoids timer thrashing and ensures proper cleanup.

### useAnimation — frame-based animation

Registers with the global `AnimationScheduler`. All animations tick on a single timer.

```tsx
import { useAnimation } from "@orchetron/storm";

const FRAMES = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];

function MySpinner() {
  const { frame } = useAnimation({ interval: 80 });
  return <Text>{FRAMES[frame % FRAMES.length]}</Text>;
}
```

### Transition — declarative enter/exit

Wraps children with animated visibility transitions.

```tsx
import { Transition } from "@orchetron/storm";

<Transition show={isVisible} type="fade" enter={{ duration: 200 }}>
  <Text>I fade in and out</Text>
</Transition>
```

Supports `"fade"`, `"slide-down"`, `"slide-up"`, `"slide-right"`, and `"collapse"` types.

### Don't use setInterval directly

Raw `setInterval` won't be cleaned up when your component unmounts (because `useEffect` cleanup is unreliable). Use `useInterval` instead:

```tsx
import { useInterval } from "@orchetron/storm";

// Automatically cleaned up via useCleanup
useInterval(() => {
  fetchStatus();
}, 5000);

// Pause/resume with the active option
useInterval(() => {
  pollForUpdates();
}, 1000, { active: isPolling });
```

---

## 9. DevTools: one line to enable

```tsx
import { render, enableDevTools } from "@orchetron/storm";

const app = render(<App />);
enableDevTools(app);
```

That is it. All DevTools features are wired up:

| Key | Feature |
|-----|---------|
| `1` | Render diff heatmap -- see which cells changed each frame |
| `2` | WCAG accessibility audit -- contrast and structure checks |
| `3` | Time-travel debugging -- use left/right arrows to scrub through frames |
| `4` | DevTools overlay -- inspector with `[]` to switch panels, `jk` to navigate, `space` to toggle |

All overlays are non-blocking. Your app keeps running underneath. Press the same key again to dismiss.

DevTools keys can be customized:

```tsx
enableDevTools(app, {
  heatmapKey: "F1",
  auditKey: "F2",
  timeTravelKey: "F3",
  overlayKey: "F4",
  maxFrames: 240,
});
```

---

## 10. Plugin system: register before first paint

The `render()` function creates a `PluginManager` and processes plugin hooks during the first paint. Plugins registered after `render()` returns will miss the initial lifecycle events.

### Wrong: registering after render

```tsx
const app = render(<App />);

// Too late — the first paint already happened
app.pluginManager.register(myPlugin);
```

### Right: register through the component tree

Access the plugin manager from inside your component tree, where registration happens before the first paint:

```tsx
import { usePluginManager } from "@orchetron/storm";

function App() {
  const pm = usePluginManager();

  // Register on first render — before first paint
  const registered = useRef(false);
  if (!registered.current) {
    registered.current = true;
    pm.register(myPlugin);
  }

  return <Box>...</Box>;
}
```

Or register as early as possible by using the plugin manager from the app instance and re-rendering:

```tsx
const app = render(<App />);
app.pluginManager.register(myPlugin);
app.requestRepaint(); // Force a repaint so plugin hooks apply
```

---

## Quick reference

| Situation | Use this | Not this |
|-----------|----------|----------|
| Scroll, cursor, animation | `useRef` + `requestRender()` | `useState` |
| Timer cleanup | `useCleanup()` | `useEffect` cleanup |
| Periodic callback | `useInterval()` | `setInterval` |
| Frame animation | `useAnimation()` | `setInterval` + counter |
| Force sync state commit | `flushSync(() => setState(...))` | `flushSync(() => ref.current = x)` |
| ScrollView | `<ScrollView flex={1}>` | `<ScrollView>` (no constraint) |
| Layout container | `<Box>` | `<Text>` |
| Inline styled text | `<Text><Text bold>...</Text></Text>` | `<Text><Box>...</Box></Text>` |
| 1-3 key bindings | `useInput` | Manual label tracking |
| Key bindings + help bar | `useHotkey` | Manual label tracking |

---

## 11. Emergency Exit: Double Ctrl+C

If your app intercepts `Ctrl+C` via `useInput`, a single press calls your handler. If the user presses `Ctrl+C` twice rapidly (within 500ms), Storm force-exits the process regardless of your handler. This is a safety valve -- it prevents apps from trapping users.

If you need custom cleanup before exit, use `useCleanup()` or `useAsyncCleanup()` -- these run automatically on any exit path including double-Ctrl+C and SIGTERM.

---

## 12. Terminal Recovery After Crash

If your app crashes or is force-killed (SIGKILL), the terminal may be left in a broken state (no cursor, raw mode, alternate screen). To recover:

```bash
reset          # Full terminal reset
# or
stty sane      # Restore sane terminal settings
```

Storm handles SIGINT, SIGTERM, SIGHUP, uncaught exceptions, and unhandled rejections -- the terminal is restored automatically in all of these cases. Only SIGKILL (which cannot be caught by any program) leaves the terminal broken.

---

## 13. When to use flushSync vs requestRender

Storm has two ways to trigger a repaint:

**`requestRender()`** — imperative repaint. Use for animations, scroll, cursor updates. No React reconciliation. Only repaints the buffer from the existing element tree. Fast (~0.5ms).

**`flushSync(() => { setState(...) })`** — React state update + repaint. Use when the component TREE needs to change (new messages, phase transitions, conditional rendering). Triggers full React reconciliation + layout rebuild + paint.

```tsx
// WRONG: using useState for a spinner animation
const [frame, setFrame] = useState(0);
setInterval(() => setFrame(f => f + 1), 80); // Full reconciliation 12x/sec

// Right: imperative mutation for animations
const textRef = useRef<any>(null);
setInterval(() => {
  textRef.current.text = FRAMES[frame++ % FRAMES.length];
  requestRender(); // Just repaint, no React
}, 80);

// Right: flushSync for structural changes
const handleSubmit = (text: string) => {
  flushSync(() => {
    setMessages(prev => [...prev, { role: "user", text }]);
    setPhase("thinking");
  });
};
```

**Rule of thumb:** If you're changing what's ON screen (text content, colors), use refs + `requestRender()`. If you're changing what EXISTS on screen (adding/removing components, conditional rendering), use `flushSync`.
