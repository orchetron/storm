# Storm TUI Hook Guide

All hooks are imported from `@orchetron/storm`. They follow React conventions but are adapted for the custom reconciler -- notably, `useEffect` cleanup does not fire, so cleanup is handled by `useCleanup`.

---

## Tier 0 -- Essential

Learn these first. Every Storm TUI app uses them.

### useApp()

Convenience wrapper over `useTui()` that exposes app-level controls: exit, rerender, and clear.

```ts
import { useApp } from "@orchetron/storm";

function MyComponent() {
  const { exit, rerender, clear } = useApp();

  // Exit the app (optionally with an error)
  exit();

  // Trigger a repaint (calls requestRender under the hood)
  rerender();

  // Invalidate diff cache and force full redraw
  clear();
}
```

**Returns:** `UseAppResult` with fields:
- `exit(error?)` -- Exit the app (optional error, delegates to `useTui().exit`)
- `rerender()` -- Trigger a fast repaint (delegates to `useTui().requestRender`)
- `clear()` -- Force a full redraw (delegates to `useTui().clear`)

If you need the full context (screen, input, focus, flushSync, commitText), use `useTui()` directly.

### useTui()

Access the core context: render control, input manager, focus manager, and exit.

```ts
import { useTui } from "@orchetron/storm";

function MyComponent() {
  const { requestRender, exit, input, flushSync, clear, commitText } = useTui();

  // Force a paint cycle without going through React's scheduler
  requestRender();

  // Write text to terminal scrollback (above the live render area)
  commitText("Build succeeded.\n");

  // Exit the app
  exit();
}
```

**Returns:** `TuiContextValue` with fields:
- `screen` -- Screen instance (width, height, resize events)
- `input` -- InputManager for raw event subscription
- `focus` -- FocusManager for programmatic focus control
- `exit(error?)` -- Exit the app (optional error)
- `requestRender()` -- Trigger a paint cycle imperatively
- `flushSync(fn)` -- Run callback with synchronous React flushing
- `clear()` -- Invalidate diff cache, force full repaint
- `renderContext` -- Per-instance state (animation scheduler, cleanups)
- `commitText(text)` -- Write to scrollback above the live area

### useInput()

Subscribe to keyboard events.

```ts
import { useInput } from "@orchetron/storm";

function MyComponent() {
  useInput((event) => {
    if (event.key === "return") {
      // handle enter
    }
    if (event.ctrl && event.key === "c") {
      // handle Ctrl+C
    }
    if (event.char === "q") {
      // handle 'q' keypress
    }
  }, { isActive: true });
}
```

**Options:**
- `isActive` (default: `true`) -- only receive events when true
- `priority` -- higher values run first and can suppress lower-priority handlers (useful for focus traps)

**Event shape:** `{ key: string, char: string, ctrl: boolean, shift: boolean, meta: boolean }`

### useTerminal()

Reactive terminal dimensions. Updates automatically on resize.

```tsx
import { useTerminal, Text } from "@orchetron/storm";

function StatusBar() {
  const { width, height, exit } = useTerminal();
  return <Text>Terminal: {width}x{height}</Text>;
}
```

### useCleanup()

Register a cleanup function that runs on unmount. Required because `useEffect` cleanup does not fire in Storm's reconciler.

```ts
import { useRef } from "react";
import { useCleanup } from "@orchetron/storm";

function MyComponent() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  if (!timerRef.current) {
    timerRef.current = setInterval(() => { /* ... */ }, 1000);
  }

  useCleanup(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  });
}
```

### useTick()

The recommended hook for periodic updates (polling, animation, live metrics). Two modes:

```tsx
// Reactive (default) -- triggers React re-render
const tickRef = useRef(0);
useTick(500, () => { tickRef.current++; });
return <Text>{tickRef.current}</Text>;

// Imperative -- cell-level repaint, zero React overhead
useTick(80, (tick) => {
  textRef.current.text = FRAMES[tick % FRAMES.length];
}, { reactive: false });
```

**Options:**
- `active` (default: `true`) -- pause/resume the timer
- `reactive` (default: `true`) -- when true, triggers a React re-render; when false, calls `requestRender()` for cell-level repaint only

**Returns:** current tick count

---

## Tier 1 -- Common

For most apps that need focus, shortcuts, timers, or animation.

### useHotkey()

Declarative keyboard shortcut registration with labels for help display.

```tsx
useHotkey({
  hotkeys: [
    { key: "ctrl+s", label: "Save", action: () => save() },
    { key: "ctrl+q", label: "Quit", action: () => exit() },
  ],
});
```

### useFocus()

Make a component focusable. Tab cycling is handled globally by the renderer.

```tsx
import { useFocus, Box, Text } from "@orchetron/storm";

function Button({ label }: { label: string }) {
  const { isFocused, focus } = useFocus({
    autoFocus: true,   // Start focused
    tabIndex: 0,       // Tab order (lower = first)
    group: "toolbar",  // Focus group for trapping
  });

  return (
    <Box borderStyle={isFocused ? "round" : "single"}>
      <Text bold={isFocused}>{label}</Text>
    </Box>
  );
}
```

### useMouse()

Subscribe to mouse events including clicks, scroll, and motion.

```ts
import { useMouse } from "@orchetron/storm";

useMouse((event) => {
  if (event.button === "left") console.log(`Clicked at ${event.x}, ${event.y}`);
  if (event.button === "scroll-up") console.log("Scrolled up");
}, { isActive: true });
```

**Signature:** `useMouse(handler: (event: MouseEvent) => void, options?: { isActive?: boolean }) => void`

### useFocusManager()

Programmatic focus control -- cycle through focusable elements, jump to a specific ID, or enable/disable the focus system.

```ts
import { useFocusManager, useInput } from "@orchetron/storm";

const { focusNext, focusPrevious, focus } = useFocusManager();

useInput((event) => {
  if (event.key === "tab" && event.shift) focusPrevious();
  else if (event.key === "tab") focusNext();
  else if (event.char === "1") focus("panel-1");
});
```

**Signature:** `useFocusManager() => { enableFocus, disableFocus, focusNext, focusPrevious, focus: (id: string) => void }`

### useTheme()

Access the active theme colors and auto-generated shades from the nearest `ThemeProvider`.

```ts
import { useTheme } from "@orchetron/storm";

const { colors, shades } = useTheme();
// colors.brand.primary, colors.success, colors.error, etc.
// shades.brand.lighten2, shades.brand.darken1, etc.
```

**Signature:** `useTheme() => { colors: StormColors; shades: ThemeShades }`

### useInterval() / useTimeout()

Timers with automatic cleanup on unmount.

```ts
import { useInterval, useTimeout } from "@orchetron/storm";

function Clock() {
  useInterval(() => {
    // Runs every 1000ms
    updateTime();
  }, 1000, { active: true });
}

function SplashScreen() {
  useTimeout(() => {
    // Runs once after 3000ms
    hideSplash();
  }, 3000);
}
```

### useAnimation()

Frame-based animation using the global AnimationScheduler. All animations share one timer to prevent thrashing.

```tsx
import { useAnimation, Text } from "@orchetron/storm";

const SPINNER = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];

function Spinner() {
  const { frame, textRef } = useAnimation({ interval: 80 });
  return (
    <Text _textNodeRef={textRef}>
      {SPINNER[frame % SPINNER.length]}
    </Text>
  );
}
```

**Returns:**
- `frame` -- current frame index (0-based, increments each tick)
- `textRef` -- ref for imperative text node updates
- `tick()` -- manually advance one frame

---

## Tier 2 -- Interactive

For complex UIs with scrolling, lists, prompts, and notifications.

### useScroll()

Imperative scroll control using `requestRender()` for instant response (not React state).

```tsx
import { useScroll, Box } from "@orchetron/storm";

function LogView({ lines }: { lines: string[] }) {
  const { scrollTop, maxScroll, isAtBottom, scrollBy, scrollToBottom } = useScroll({
    contentHeight: lines.length,
    viewportHeight: 20,
    speed: 3,
  });

  useInput((event) => {
    if (event.key === "up") scrollBy(-1);
    if (event.key === "down") scrollBy(1);
    if (event.key === "end") scrollToBottom();
  });

  const visible = lines.slice(scrollTop, scrollTop + 20);
  return <Box flexDirection="column">{/* render visible */}</Box>;
}
```

### useVirtualList()

Large list virtualization. Only computes the visible slice plus overscan.

```tsx
import { useVirtualList, useInput, Box, Text } from "@orchetron/storm";

function BigList({ items }: { items: string[] }) {
  const { visibleItems, scrollTop, scrollTo, onScroll } = useVirtualList({
    items,
    itemHeight: 1,
    viewportHeight: 20,
    overscan: 3,
  });

  useInput((event) => {
    if (event.key === "up") onScroll(-1);
    if (event.key === "down") onScroll(1);
  });

  return (
    <Box flexDirection="column">
      {visibleItems.map(({ item, index, offsetY }) => (
        <Text key={index}>{item}</Text>
      ))}
    </Box>
  );
}
```

### useCommandPalette()

Fuzzy command search with keyboard navigation (up/down/enter/escape).

```ts
import { useCommandPalette } from "@orchetron/storm";

function App() {
  const palette = useCommandPalette({
    commands: [
      { name: "Open File", description: "Open a file", category: "file" },
      { name: "Save", description: "Save current file", category: "file" },
      { name: "Toggle Theme", description: "Switch dark/light" },
    ],
    trigger: "/",
    onExecute: (cmd) => handleCommand(cmd),
  });

  // palette.isOpen, palette.query, palette.filtered, palette.activeIndex
  // palette.open(), palette.close()
}
```

### useInlinePrompt()

Inline yes/no prompts with optional timeout.

```tsx
import { useInlinePrompt, Text } from "@orchetron/storm";

function DeleteConfirm() {
  const { selected, countdown, reset } = useInlinePrompt({
    choices: { y: "yes", n: "no" },
    timeoutMs: 10000,
    timeoutChoice: "n",
  });

  if (selected === "yes") return <Text color="red">Deleted.</Text>;
  if (selected === "no") return <Text>Cancelled.</Text>;
  return <Text>Delete? (y/n) {countdown && `${countdown}s`}</Text>;
}
```

### useNotification()

Toast notification queue with auto-removal.

```tsx
import { useNotification, Box, Text } from "@orchetron/storm";

function App() {
  const { notifications, add, remove, clear } = useNotification({
    maxVisible: 3,
    defaultDuration: 4000,
  });

  const handleSave = () => {
    add("File saved", "success");
  };

  return (
    <Box flexDirection="column">
      {notifications.map((n) => (
        <Text key={n.id} color={n.type === "error" ? "red" : "green"}>
          {n.message}
        </Text>
      ))}
    </Box>
  );
}
```

### useBuffer()

Direct cell-level read/write access to the screen buffer. For custom rendering that bypasses the normal layout/paint pipeline.

```tsx
const { writeCell, readCell, requestRender } = useBuffer();

// Write a character at absolute screen coordinates
writeCell(10, 5, "\u2588", "#FF0000");

// Read what's currently at a position
const cell = readCell(10, 5); // { char, fg, bg }

// Trigger a repaint (no React reconciliation)
requestRender();
```

**Returns:** `BufferAccess` with `writeCell`, `readCell`, and `requestRender`.

### useClipboard()

Read and write the system clipboard via OSC 52 escape sequences.

```ts
import { useClipboard } from "@orchetron/storm";

const { copy, read, content } = useClipboard();
copy("text to copy");
```

**Signature:** `useClipboard() => { copy: (text: string) => void; read: () => void; content: string | null }`

### usePaste()

Subscribe to bracketed paste events. Separate from `useInput` because paste events can contain newlines and special characters.

```ts
import { usePaste } from "@orchetron/storm";

usePaste((text) => {
  console.log("Pasted:", text.length, "characters");
}, { isActive: true });
```

**Signature:** `usePaste(handler: (text: string) => void, options?: { isActive?: boolean }) => void`

### useAccessibility()

Access accessibility preferences: high contrast, reduced motion, screen reader detection. Results are cached.

```ts
import { useAccessibility } from "@orchetron/storm";

const { highContrast, reducedMotion, screenReader } = useAccessibility();
```

**Signature:** `useAccessibility() => { highContrast: boolean; reducedMotion: boolean; screenReader: boolean }`

### useReducedMotion()

Convenience hook returning `true` if the user prefers reduced motion. Uses `useAccessibility` internally.

```ts
import { useReducedMotion } from "@orchetron/storm";

const reducedMotion = useReducedMotion(); // boolean
```

**Signature:** `useReducedMotion() => boolean`

### useAdaptive()

Detect terminal capabilities: image protocol, color depth, Unicode support. Computed once and cached.

```ts
import { useAdaptive } from "@orchetron/storm";

const { imageProtocol, colorDepth, unicode } = useAdaptive();
```

**Signature:** `useAdaptive() => { imageProtocol: "kitty" | "iterm2" | "sixel" | "block"; colorDepth: "truecolor" | "256" | "16" | "basic"; unicode: boolean }`

### useAnnounce()

Announce dynamic content changes to screen readers via OSC 99 escape sequences.

```ts
import { useAnnounce } from "@orchetron/storm";

const { announce, announceUrgent } = useAnnounce();
announce("File saved successfully");
announceUrgent("Save failed!");
```

**Signature:** `useAnnounce() => { announce: (message: string) => void; announceUrgent: (message: string) => void }`

### usePluginManager()

Access the shared `PluginManager` instance for registering plugins, querying custom elements, or accessing plugin-provided shortcuts.

```ts
import { usePluginManager } from "@orchetron/storm";

const plugins = usePluginManager();
plugins.hasPlugin("vim-mode"); // boolean
```

**Signature:** `usePluginManager() => PluginManager`

### useMeasure()

Read layout dimensions of a rendered element by ID.

```ts
import { useMeasure } from "@orchetron/storm";

function Sidebar() {
  const layout = useMeasure("sidebar");
  // layout: { x, y, width, height, innerX, innerY, innerWidth, innerHeight } | null
}
```

---

## Tier 3 -- Headless Behaviors

Renderless hooks for building custom interactive components. They manage state and keyboard navigation -- you provide the rendering.

### useSelectBehavior

Single-select dropdown/picker behavior.

```ts
import { useSelectBehavior } from "@orchetron/storm";

const select = useSelectBehavior({
  items: ["apple", "banana", "cherry"],
  onSelect: (item) => console.log(item),
});
// select.activeIndex, select.selectedItem, select.isOpen
```

### useListBehavior

Navigable list with cursor tracking.

```ts
import { useListBehavior } from "@orchetron/storm";

const list = useListBehavior({
  items: myItems,
  onActivate: (item) => openItem(item),
});
// list.activeIndex, list.activeItem
```

### useMenuBehavior

Menu with nested submenus, keyboard navigation, and activation.

```ts
import { useMenuBehavior } from "@orchetron/storm";

const menu = useMenuBehavior({
  items: [
    { label: "File", children: [{ label: "Open" }, { label: "Save" }] },
    { label: "Edit", children: [{ label: "Undo" }, { label: "Redo" }] },
  ],
  onSelect: (item) => executeMenuItem(item),
});
```

### useTreeBehavior

Collapsible tree navigation with expand/collapse and cursor tracking.

```ts
import { useTreeBehavior } from "@orchetron/storm";

const tree = useTreeBehavior({
  root: fileSystemTree,
  getChildren: (node) => node.children,
  getLabel: (node) => node.name,
  onActivate: (node) => openFile(node),
});
// tree.visibleNodes, tree.activeIndex, tree.toggle(node)
```

### useTabsBehavior

Tab panel management with keyboard cycling.

```ts
import { useTabsBehavior } from "@orchetron/storm";

const tabs = useTabsBehavior({
  tabs: ["Overview", "Details", "Settings"],
  initialTab: 0,
  onChange: (index) => {},
});
// tabs.activeIndex, tabs.activeTab, tabs.select(index)
```

### useAccordionBehavior

Expandable section management (single or multi-expand).

```ts
import { useAccordionBehavior } from "@orchetron/storm";

const accordion = useAccordionBehavior({
  sections: ["General", "Advanced", "Debug"],
  allowMultiple: false,
});
// accordion.expandedSections, accordion.toggle(index)
```

### useFormBehavior

Multi-field form state, validation, and submission.

```ts
import { useFormBehavior } from "@orchetron/storm";

const form = useFormBehavior({
  fields: [
    { name: "email", initial: "", validate: (v) => v.includes("@") ? null : "Invalid" },
    { name: "name", initial: "" },
  ],
  onSubmit: (values) => save(values),
});
// form.values, form.errors, form.setValue("email", "a@b.com"), form.submit()
```

### useDialogBehavior

Modal dialog lifecycle: open, close, confirm, cancel.

```ts
import { useDialogBehavior } from "@orchetron/storm";

const dialog = useDialogBehavior({
  onConfirm: () => deleteItem(),
  onCancel: () => {},
});
// dialog.isOpen, dialog.open(), dialog.close(), dialog.confirm()
```

### useToastBehavior

Toast queue management (similar to useNotification but headless -- no rendering opinions).

```ts
import { useToastBehavior } from "@orchetron/storm";

const toasts = useToastBehavior({ maxToasts: 5, defaultDuration: 3000 });
// toasts.items, toasts.add("Saved!"), toasts.dismiss(id)
```

### useCalendarBehavior

Date navigation and selection (month grid, cursor movement).

```ts
import { useCalendarBehavior } from "@orchetron/storm";

const calendar = useCalendarBehavior({
  initialDate: new Date(),
  onSelect: (date) => setSelectedDate(date),
});
// calendar.year, calendar.month, calendar.days, calendar.cursor
// calendar.nextMonth(), calendar.prevMonth(), calendar.select()
```

### Also available

- `usePaginatorBehavior` -- page-based navigation (page, pageSize, total, next/prev)
- `useStepperBehavior` -- multi-step wizard state (currentStep, next, prev, canProceed)
- `useCollapsibleBehavior` -- single collapsible section (isExpanded, toggle)
- `useTableBehavior` -- sortable, navigable table (columns, rows, sort, cursor)
- `useVirtualListBehavior` -- headless virtual list logic (scroll offset, visible range)

---

## Decision Matrix

| I want to... | Use this hook |
|---|---|
| Exit, rerender, or clear (simple) | `useApp()` |
| Access full render context and exit | `useTui()` |
| Handle raw keyboard input | `useInput()` |
| Show shortcuts in a help bar | `useHotkey()` |
| Get terminal dimensions | `useTerminal()` |
| Clean up on unmount | `useCleanup()` |
| Make a component focusable | `useFocus()` |
| Manage focus programmatically | `useFocusManager()` |
| Run code on an interval | `useInterval()` |
| Run code after a delay | `useTimeout()` |
| Run a periodic callback (polling, animation) | `useTick()` |
| Animate frames (spinner, etc.) | `useAnimation()` |
| Scroll content imperatively | `useScroll()` |
| Render a large list efficiently | `useVirtualList()` |
| Add fuzzy command search | `useCommandPalette()` |
| Show an inline yes/no prompt | `useInlinePrompt()` |
| Display toast notifications | `useNotification()` |
| Write/read cells directly on the screen buffer | `useBuffer()` |
| Read element layout dimensions | `useMeasure()` |
| Handle paste events | `usePaste()` |
| Handle mouse events | `useMouse()` |
| Access clipboard | `useClipboard()` |
| Build a custom select/dropdown | `useSelectBehavior()` |
| Build a navigable list | `useListBehavior()` |
| Build a menu with submenus | `useMenuBehavior()` |
| Build a collapsible tree | `useTreeBehavior()` |
| Build tabs | `useTabsBehavior()` |
| Build an accordion | `useAccordionBehavior()` |
| Build a multi-field form | `useFormBehavior()` |
| Build a modal dialog | `useDialogBehavior()` |
| Build a toast system | `useToastBehavior()` |
| Build a date picker | `useCalendarBehavior()` |

---

## Key Patterns

### Imperative Updates (Not React State)

Storm's reconciler does not reliably flush React state updates. For scroll, animation, and anything that needs instant visual response, mutate a ref and call `requestRender()`:

```ts
const scrollRef = useRef(0);
const { requestRender } = useTui();

// WRONG: useState causes delayed/missed updates
// const [scroll, setScroll] = useState(0);

// RIGHT: ref + requestRender
scrollRef.current += delta;
requestRender();
```

This is why `useScroll`, `useVirtualList`, and `useAnimation` all use refs internally.

### Eager Registration

Hooks register listeners immediately during render (not in `useEffect`), because effects are unreliable in the custom reconciler. A `registeredRef` guard prevents double-registration:

```ts
const registeredRef = useRef(false);
if (!registeredRef.current) {
  registeredRef.current = true;
  // Register listener once
}
```

### Cleanup

Always use `useCleanup()` instead of `useEffect` return functions:

```ts
// WRONG: cleanup won't fire
useEffect(() => {
  const timer = setInterval(fn, 100);
  return () => clearInterval(timer);  // Never called
}, []);

// RIGHT: useRef guard prevents creating a new timer on every render
const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
if (!timerRef.current) {
  timerRef.current = setInterval(fn, 100);
}
useCleanup(() => { if (timerRef.current) clearInterval(timerRef.current); });
```

### Async Cleanup

For cleanup that needs to `await` (database flushes, file writes):

```tsx
import { useAsyncCleanup } from "@orchetron/storm";

useAsyncCleanup(async () => {
  await db.flush();
  await fs.promises.writeFile("state.json", JSON.stringify(state));
});
```

Async cleanups run after sync cleanups and complete before `waitUntilExit()` resolves.
