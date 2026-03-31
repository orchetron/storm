# Storm TUI Hook Guide

> For a full API reference of all hooks with signatures, see [Hooks Reference](hooks.md).

All hooks are imported from `@orchetron/storm-tui`. They follow React conventions but are adapted for the custom reconciler -- notably, `useEffect` cleanup does not fire, so cleanup is handled by `useCleanup`.

---

## Tier 0 -- Essential

Learn these first. Every Storm TUI app uses them.

### useApp()

Convenience wrapper over `useTui()` that exposes app-level controls: exit, rerender, and clear.

```ts
import { useApp } from "@orchetron/storm-tui";

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
import { useTui } from "@orchetron/storm-tui";

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
import { useInput } from "@orchetron/storm-tui";

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
import { useTerminal, Text } from "@orchetron/storm-tui";

function StatusBar() {
  const { width, height, exit } = useTerminal();
  return <Text>Terminal: {width}x{height}</Text>;
}
```

### useCleanup()

Register a cleanup function that runs on unmount. Required because `useEffect` cleanup does not fire in Storm's reconciler.

```ts
import { useRef } from "react";
import { useCleanup } from "@orchetron/storm-tui";

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

---

## Tier 1 -- Common

For most apps that need focus, shortcuts, timers, or animation.

### useFocus()

Make a component focusable. Tab cycling is handled globally by the renderer.

```tsx
import { useFocus, Box, Text } from "@orchetron/storm-tui";

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

### useKeyboardShortcuts()

Declarative shortcut definitions. Matches key + modifiers and calls the handler.

```ts
import { useKeyboardShortcuts } from "@orchetron/storm-tui";

function App() {
  useKeyboardShortcuts([
    { key: "q", handler: () => process.exit(0), description: "Quit" },
    { key: "r", ctrl: true, handler: () => refresh(), description: "Refresh" },
    { key: "f", handler: () => toggleSearch(), description: "Find" },
  ], { isActive: true });
}
```

### useInterval() / useTimeout()

Timers with automatic cleanup on unmount.

```ts
import { useInterval, useTimeout } from "@orchetron/storm-tui";

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
import { useAnimation, Text } from "@orchetron/storm-tui";

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
import { useScroll, Box } from "@orchetron/storm-tui";

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
import { useVirtualList, useInput, Box, Text } from "@orchetron/storm-tui";

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
import { useCommandPalette } from "@orchetron/storm-tui";

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
import { useInlinePrompt, Text } from "@orchetron/storm-tui";

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
import { useNotification, Box, Text } from "@orchetron/storm-tui";

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

### useMeasure()

Read layout dimensions of a rendered element by ID.

```ts
import { useMeasure } from "@orchetron/storm-tui";

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
import { useSelectBehavior } from "@orchetron/storm-tui";

const select = useSelectBehavior({
  items: ["apple", "banana", "cherry"],
  onSelect: (item) => console.log(item),
});
// select.activeIndex, select.selectedItem, select.isOpen
```

### useListBehavior

Navigable list with cursor tracking.

```ts
import { useListBehavior } from "@orchetron/storm-tui";

const list = useListBehavior({
  items: myItems,
  onActivate: (item) => openItem(item),
});
// list.activeIndex, list.activeItem
```

### useMenuBehavior

Menu with nested submenus, keyboard navigation, and activation.

```ts
import { useMenuBehavior } from "@orchetron/storm-tui";

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
import { useTreeBehavior } from "@orchetron/storm-tui";

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
import { useTabsBehavior } from "@orchetron/storm-tui";

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
import { useAccordionBehavior } from "@orchetron/storm-tui";

const accordion = useAccordionBehavior({
  sections: ["General", "Advanced", "Debug"],
  allowMultiple: false,
});
// accordion.expandedSections, accordion.toggle(index)
```

### useFormBehavior

Multi-field form state, validation, and submission.

```ts
import { useFormBehavior } from "@orchetron/storm-tui";

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
import { useDialogBehavior } from "@orchetron/storm-tui";

const dialog = useDialogBehavior({
  onConfirm: () => deleteItem(),
  onCancel: () => {},
});
// dialog.isOpen, dialog.open(), dialog.close(), dialog.confirm()
```

### useToastBehavior

Toast queue management (similar to useNotification but headless -- no rendering opinions).

```ts
import { useToastBehavior } from "@orchetron/storm-tui";

const toasts = useToastBehavior({ maxToasts: 5, defaultDuration: 3000 });
// toasts.items, toasts.add("Saved!"), toasts.dismiss(id)
```

### useCalendarBehavior

Date navigation and selection (month grid, cursor movement).

```ts
import { useCalendarBehavior } from "@orchetron/storm-tui";

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
| Define keyboard shortcuts | `useKeyboardShortcuts()` |
| Show shortcuts in a help bar | `useHotkey()` |
| Get terminal dimensions | `useTerminal()` |
| Clean up on unmount | `useCleanup()` |
| Make a component focusable | `useFocus()` |
| Manage focus programmatically | `useFocusManager()` |
| Run code on an interval | `useInterval()` |
| Run code after a delay | `useTimeout()` |
| Animate frames (spinner, etc.) | `useAnimation()` |
| Tween a numeric value | `useTween()` |
| Scroll content imperatively | `useScroll()` |
| Render a large list efficiently | `useVirtualList()` |
| Add fuzzy command search | `useCommandPalette()` |
| Show an inline yes/no prompt | `useInlinePrompt()` |
| Display toast notifications | `useNotification()` |
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
import { useAsyncCleanup } from "@orchetron/storm-tui";

useAsyncCleanup(async () => {
  await db.flush();
  await fs.promises.writeFile("state.json", JSON.stringify(state));
});
```

Async cleanups run after sync cleanups and complete before `waitUntilExit()` resolves.
