# Architecture

Storm is a terminal UI framework. React reconciler on top, cell-based buffer underneath, diff renderer that only writes what changed. No Yoga, no native dependencies (WASM optional).

## Render Pipeline

Every frame:

1. **React commit** -- reconciler (`reconciler/host.ts`) mutates the element tree
2. **FrameScheduler** (`reconciler/frame-scheduler.ts`) -- throttles to maxFps, coalesces rapid commits, detects render loops
3. **RenderPipeline.fullPaint()** (`reconciler/render-pipeline.ts`) -- orchestrates the rest:
   - Plugins: `beforeRender` hook
   - Middleware: `runLayout` pass
   - `paint()` -- runs `computeLayout()` then writes cells into a `ScreenBuffer`
   - Middleware: `runPaint` pass (post-process the buffer)
   - `Screen.flush()` -- hands buffer to `DiffRenderer`
   - `DiffRenderer.render()` -- diffs prev vs next buffer, emits minimal ANSI
4. **Incremental repaint** -- `requestRender()` triggers a repaint without a React commit. Used by imperative mutation (scroll, animation).

Imperative mutation is the intended path for anything > 10fps. React state updates do not flush synchronously in this reconciler. Mutate refs/props directly, call `requestRender()`.

## Directory Map

```
src/
  reconciler/       React reconciler host config, render(), RenderPipeline, FrameScheduler
  core/             ScreenBuffer, DiffRenderer, Screen, RenderContext, ErrorBoundary, Plugin, Middleware
  layout/           Pure-TS flexbox engine (computeLayout). No native deps.
  hooks/            useCleanup, useImperativeAnimation, useInput, useFocus, etc.
  components/       Box, Text, ScrollView, TextInput, etc.
  widgets/          Higher-level composites (Table, Tabs, Dialog, etc.)
  input/            Keyboard/mouse parser, InputManager
  context/          TuiContext (requestRender, renderContext, inputManager)
  theme/            Color system, ThemeProvider
  testing/          TestInputManager, renderToString, fireEvent, SVG snapshots
  styles/           Style types and helpers
  templates/        App templates
  plugins/          Built-in plugins (devtools overlay, etc.)
  ssh/              SSH server adapter
```

## Key Abstractions

### ScreenBuffer (`core/buffer.ts`)
Flat packed `Uint32Array`/`Int32Array`/`Uint8Array` storage. One cell = codepoint + fg + bg + attrs + ulColor. Zero per-cell GC pressure. Tracks damage rects and per-row damage columns so the diff renderer only scans what changed. Has fast ASCII path in `writeString()` (fill-based, compiles to memset). Exposes `getRowRaw()` for the diff tight loop to skip bounds checks.

### DiffRenderer (`core/diff.ts`)
Double-buffered. Three render paths picked per-frame:
- **Cell-level diff** (< 50% rows changed): emits only changed runs with cursor positioning. Primary path for typing/cursor blink.
- **Full-line replacement** (> 50% changed): cheaper than many cursor jumps.
- **Scroll region optimization** (DECSTBM): pure scroll of 1-5 lines uses terminal scroll commands + paints only revealed rows.

WASM acceleration optional (Rust `render_line`, 3.4x faster). Auto-selected for sparse updates (<=30% rows changed). Falls back to TS silently.

### Layout (`layout/engine.ts`)
`computeLayout(node, x, y, availW, availH)` -- pure function, returns positioned layout tree. Supports flex direction/wrap, percentage sizes, min/max constraints, padding, margin (incl. auto), gap, align/justify, absolute positioning, grid. No side effects.

### Reconciler (`reconciler/host.ts`)
Standard `react-reconciler` host config. Element types: `box`, `text`, `scroll-view`, custom. Tree of `TuiElement`/`TuiTextNode`. Lifecycle hooks wired through `PluginManager` for mount/unmount/update notifications.

### Imperative Mutation
React state does not flush synchronously. For scroll, animation, streaming text: mutate the node/ref directly, call `requestRender()`. The `useImperativeAnimation` hook wraps this pattern -- `setInterval` + `onTick` callback + auto `requestRender()` + `useCleanup` for teardown.

## Adding a Component

1. Create `src/components/MyThing.tsx`
2. It receives props, renders `<box>` / `<text>` primitives
3. For scroll/animation: use `useTui()` to get `requestRender`, mutate refs imperatively
4. Export from `src/index.ts`
5. Do NOT return cleanup functions from `useEffect`. Use `useCleanup()`.

## Adding a Hook

1. Create `src/hooks/useMyHook.ts`
2. Get context via `useTui()` (gives you `requestRender`, `renderContext`, `inputManager`)
3. For teardown (timers, listeners): use `useCleanup()`, not `useEffect` return
4. For animation loops: use `useImperativeAnimation` or roll your own `setInterval` + `requestRender()`
5. Export from `src/index.ts`

## Testing

`src/testing/index.ts` provides:
- **`TestInputManager`** -- mock input. Call `pressKey()`, `click()`, `paste()` to simulate events.
- **`renderToString(element, opts)`** -- renders a component to a plain string (no terminal needed). Set width/height in opts.
- **`renderToSvg(element, opts)`** -- SVG snapshot output for visual regression.
- **`fireEvent`** -- convenience wrappers around TestInputManager.

No real terminal required. Components render into a `ScreenBuffer` in memory, diff is never written to stdout.

## Footguns

1. **useEffect cleanup does not fire reliably.** Storm monkey-patches `React.useEffect` to warn you. Use `useCleanup()`.
2. **useState causes full repaints.** FrameScheduler warns if you exceed 15 full paints/sec. Use imperative mutation for hot paths.
3. **requestRender is not React setState.** It triggers repaint of the existing tree without a React commit. State changes need `useState`; visual updates need `requestRender`.
