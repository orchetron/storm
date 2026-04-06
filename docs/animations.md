# Storm TUI Animations

Storm TUI provides both imperative and declarative animation APIs. All animations integrate with the global `AnimationScheduler`, which batches frame updates onto a single timer and calls `requestRender()` once per tick.

## Animation approaches

| Approach | API | Best for |
|----------|-----|----------|
| **Imperative** | `useAnimation` | Spinners, progress bars, continuous animations |
| **Declarative** | `useTransition`, `<Transition>`, `<AnimatePresence>` | Show/hide, enter/exit, UI state changes |

Imperative hooks give you direct control over frame updates and avoid React reconciliation overhead. Declarative components are simpler to use for common enter/exit patterns.

## useAnimation

Frame-based animation hook that registers with the global `AnimationScheduler`. Returns an auto-incrementing frame counter that you use to index into frame arrays.

```ts
interface UseAnimationOptions {
  /** Frame rate in ms (default: 80) */
  interval?: number;
  /** Only animate when true (default: true) */
  active?: boolean;
  /** Starting frame index (default: 0) */
  initialFrame?: number;
}

interface UseAnimationResult {
  /** Current frame index (0-based, wraps automatically) */
  frame: number;
  /** Ref to a text node for imperative updates */
  textRef: React.RefObject<any>;
  /** Manually advance one frame */
  tick: () => void;
}
```

### Example: spinner

```tsx
import { useAnimation } from "@orchetron/storm";

const FRAMES = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];

function Spinner({ active = true }: { active?: boolean }) {
  const { frame, textRef } = useAnimation({ interval: 80, active });
  return (
    <tui-text _textNodeRef={textRef}>
      {FRAMES[frame % FRAMES.length]}
    </tui-text>
  );
}
```

### Example: multiple offset spinners

Use `initialFrame` to desynchronize multiple spinners:

```tsx
function LoadingRow({ label, index }: { label: string; index: number }) {
  const { frame } = useAnimation({ interval: 80, initialFrame: index * 3 });
  return (
    <Box>
      <Text>{FRAMES[frame % FRAMES.length]} {label}</Text>
    </Box>
  );
}
```

## useTransition

Declarative hook that animates a numeric value between `from` and `to` with configurable easing, duration, and delay. Auto-starts on mount.

```ts
interface TransitionConfig {
  from: number;
  to: number;
  duration?: number;          // default: 200
  easing?: "linear" | "easeIn" | "easeOut" | "easeInOut" | "spring";
  delay?: number;             // default: 0
  onComplete?: () => void;
}

interface UseTransitionResult {
  value: number;              // current animated value
  isAnimating: boolean;
  start: (override?: Partial<TransitionConfig>) => void;
  stop: () => void;
  reset: () => void;
}
```

### Example: fade in on mount

```tsx
import { useTransition } from "@orchetron/storm";

function FadeIn({ children }: { children: React.ReactNode }) {
  const { value } = useTransition({
    from: 0,
    to: 1,
    duration: 300,
    easing: "easeOut",
  });
  return <Box dim={value < 0.5}>{children}</Box>;
}
```

### Example: delayed slide with callback

```tsx
function SlideIn() {
  const { value, isAnimating } = useTransition({
    from: -10,
    to: 0,
    duration: 400,
    easing: "spring",
    delay: 200,
    onComplete: () => console.log("Animation done"),
  });

  return (
    <Box marginTop={Math.round(value)}>
      <Text>Sliding content {isAnimating ? "(animating)" : ""}</Text>
    </Box>
  );
}
```

### Imperative control

The `start`, `stop`, and `reset` methods give full control:

```tsx
function Toggle() {
  const { value, start, reset } = useTransition({
    from: 0, to: 1, duration: 200,
  });

  // Reverse the animation
  const handleToggle = () => {
    start({ from: value, to: value > 0.5 ? 0 : 1 });
  };

  return (
    <Box>
      <Text dim={value < 0.5}>Toggle content</Text>
    </Box>
  );
}
```

## Transition component

A declarative wrapper that animates children when the `show` prop toggles. Handles enter and exit animations automatically.

```ts
interface TransitionProps {
  show: boolean;
  type?: "fade" | "slide-down" | "slide-up" | "slide-right" | "collapse";
  enter?: { duration?: number; easing?: string };
  exit?: { duration?: number; easing?: string };
  children: React.ReactNode;
}
```

Animation types:

- **fade** -- toggles the `dim` attribute based on animation progress
- **slide-down** -- animates `marginTop` from negative to 0 (content slides down into view)
- **slide-up** -- animates `marginTop` from positive to 0 (content slides up into view)
- **slide-right** -- animates `paddingLeft` from positive to 0 (content slides right into view)
- **collapse** -- animates `height` from 0 to auto (content expands vertically)

### Example: dropdown menu

```tsx
import { Transition } from "@orchetron/storm";

function Dropdown({ isOpen }: { isOpen: boolean }) {
  return (
    <Box flexDirection="column">
      <Text bold>Menu</Text>
      <Transition
        show={isOpen}
        type="slide-down"
        enter={{ duration: 200, easing: "easeOut" }}
        exit={{ duration: 150, easing: "easeIn" }}
      >
        <Box flexDirection="column" paddingLeft={2}>
          <Text>Option A</Text>
          <Text>Option B</Text>
          <Text>Option C</Text>
        </Box>
      </Transition>
    </Box>
  );
}
```

### Example: collapsible section

```tsx
function CollapsibleSection({ title, expanded, children }) {
  return (
    <Box flexDirection="column">
      <Text bold>{expanded ? "[-]" : "[+]"} {title}</Text>
      <Transition show={expanded} type="collapse">
        {children}
      </Transition>
    </Box>
  );
}
```

### Example: fade alert

```tsx
function Alert({ visible, message }) {
  return (
    <Transition show={visible} type="fade" enter={{ duration: 100 }}>
      <Box borderStyle="round" paddingX={1}>
        <Text color="yellow">{message}</Text>
      </Box>
    </Transition>
  );
}
```

The Transition component renders nothing (`null`) when fully hidden, so there is no layout cost for invisible content.

## AnimatePresence

Manages mount/unmount animations for dynamic lists of keyed children. When a child is removed, AnimatePresence keeps it rendered long enough for the exit animation to play before removing it from the tree.

```ts
interface AnimatePresenceProps {
  children: React.ReactNode;
  exitType?: "fade" | "slide-up" | "collapse";  // default: "fade"
  exitDuration?: number;  // milliseconds
}
```

Children **must** have a unique `key` prop so AnimatePresence can track entering, present, and exiting items.

### Example: animated list

```tsx
import { AnimatePresence } from "@orchetron/storm";

function NotificationList({ notifications }) {
  return (
    <AnimatePresence exitType="fade" exitDuration={200}>
      {notifications.map((n) => (
        <Box key={n.id} paddingX={1}>
          <Text>{n.message}</Text>
        </Box>
      ))}
    </AnimatePresence>
  );
}
```

### Example: slide-up removal

```tsx
function TaskList({ tasks }) {
  return (
    <AnimatePresence exitType="slide-up" exitDuration={150}>
      {tasks.map((task) => (
        <Box key={task.id}>
          <Text strikethrough={task.done}>{task.title}</Text>
        </Box>
      ))}
    </AnimatePresence>
  );
}
```

If a child that is mid-exit reappears (same key), AnimatePresence cancels the exit and keeps it visible.

## Easing functions

All animation APIs accept easing functions. Storm TUI provides these built-in options:

| Name | Curve | Use case |
|------|-------|----------|
| `linear` | Constant speed | Progress indicators, marquee |
| `easeIn` | Slow start, fast end | Elements leaving the screen |
| `easeOut` | Fast start, slow end | Elements entering the screen (default) |
| `easeInOut` | Slow start and end | Symmetric transitions |
| `spring` | Damped oscillation with overshoot | Playful UI, attention-grabbing motion |

The `spring` easing is available in `useTransition` but not in the `Transition` component (which supports `linear`, `easeIn`, `easeOut`, `easeInOut`).

## Performance

### Why imperative is faster

Storm TUI uses a custom React reconciler where state updates do not automatically flush renders (unlike browser React). Animation hooks use refs and `requestRender()` for imperative mutation, which avoids:

- React reconciliation overhead on every frame
- Unnecessary virtual DOM diffing
- State batching delays

The `AnimationScheduler` further improves performance by batching all animation callbacks onto a single timer. Instead of N spinners each running their own `setInterval`, one scheduler ticks all animations and triggers one `requestRender()` per frame.

### When to use each approach

**Use `useAnimation`** for frame-based animations like spinners, cycling through text frames, or anything that needs a frame counter.

**Use `useTransition`** when you need control over a value animation -- delay, manual start/stop/reset, completion callbacks, or spring easing.

**Use `<Transition>`** for simple show/hide patterns where you want enter/exit animations without managing state yourself.

**Use `<AnimatePresence>`** for dynamic lists where items can be added and removed, and you want exit animations before elements unmount.

As a rule of thumb: start with the declarative components (`Transition`, `AnimatePresence`). Drop down to `useTransition` when you need finer control. Use `useAnimation` for frame-based patterns that don't map to numeric interpolation.
