# Contributing to Storm

Contributions that make Storm faster, more accessible, or more useful are welcome.

## Setup

```bash
git clone https://github.com/orchetron/storm-tui.git
cd storm-tui
npm install
```

Verify everything works:

```bash
npx vitest run                                 # 452 tests
npx tsc --noEmit                               # 0 errors
npx tsx examples/storm-code/index.tsx           # see it run
npx tsx examples/benchmarks.ts                  # performance baseline
```

Enable DevTools while developing:

```tsx
import { enableDevTools } from "@orchetron/storm-tui";
const app = render(<App />);
enableDevTools(app);  // render heatmap, a11y audit, time-travel, inspector
```

## Where to start

**Good first contributions:**
- Improve a component — better keyboard handling, empty states, edge cases
- Add a syntax highlighting language (`registerLanguage` in SyntaxHighlight)
- Add a theme preset
- Write a recipe in `docs/recipes.md`
- Fix a bug you found while building something

**High-impact contributions:**
- Performance optimizations (measure before/after with `npx tsx examples/benchmarks.ts`)
- New hooks that solve real problems
- Accessibility — screen reader output, contrast, focus management
- Documentation — examples, guides, corrections

## Code of conduct

Be respectful. Be constructive. Focus on the work.

## Code organization

```
src/
  core/           Engine. Buffer, diff, screen, input, unicode, animation, i18n,
                  personality, plugin, middleware, stylesheet.
                  Touch carefully — it affects everything.

  layout/         Pure TypeScript flexbox + CSS Grid. ~1,300 lines.
                  No external dependencies.

  reconciler/     React integration. Host config, paint pipeline, render().
                  Where React meets the terminal.

  components/     92 components. Each is a single file.
                  This is where most contributions happen.

  widgets/        19 AI/developer widgets. OperationTree, MessageBubble,
                  SyntaxHighlight, MarkdownText, TokenStream, etc.

  hooks/          74 hooks across 4 tiers.
    headless/     15 headless behavior hooks (select, list, menu, tree, etc.)

  devtools/       DevTools suite. Inspector, heatmap, time-travel, a11y audit,
                  performance monitor, event logger, enableDevTools().

  theme/          Colors, 11 presets, shade generation, validation, loader.
  templates/      Showcase galleries, chat templates.
  testing/        renderForTest, assertions, SVG snapshots.
  context/        TuiContext — glue between React and Storm.

assets/           Logo variants (SVG + PNG), architecture diagrams.
examples/         Demo apps, showcase runner, benchmarks.
docs/             12 documentation guides.
```

## Writing a component

Every component follows this pattern:

```typescript
import React from "react";
import { usePluginProps } from "../hooks/usePluginProps.js";
import { colors } from "../theme/colors.js";

export interface MyComponentProps {
  label: string;
  color?: string;
}

export const MyComponent = React.memo(function MyComponent(
  rawProps: MyComponentProps,
): React.ReactElement {
  // 1. Plugin props — lets plugins intercept and override props
  const props = usePluginProps(
    "MyComponent",
    rawProps as unknown as Record<string, unknown>,
  ) as unknown as MyComponentProps;

  const { label, color = colors.brand.primary } = props;

  // 2. Use createElement with tui-* element types
  return React.createElement(
    "tui-box" as any,
    { flexDirection: "row", role: "group" },   // 3. ARIA role
    React.createElement("tui-text" as any, { color, bold: true }, label),
  );
});
```

**Every component must:**
- Use `usePluginProps()` — enables plugin interception
- Be wrapped in `React.memo()` — prevents unnecessary re-renders
- Include an ARIA `role` on the root element
- Handle empty data gracefully — show a dim placeholder, never crash

**Why `.js` extensions?** ESM requires them. TypeScript resolves `.js` to `.ts` at compile time.

**Why `useRef` over `useState` for animation?** React's state doesn't flush reliably from external events (stdin, timers) in the custom reconciler. Refs are immediate. `requestRender()` triggers a fast repaint without reconciliation. Use `useState` + `flushSync` for structural state changes.

**Why `useCleanup` instead of `useEffect`?** `useEffect` cleanup doesn't fire reliably in the custom reconciler. `useCleanup` hooks into the render context's cleanup registry.

## Writing a hook

```typescript
import { useRef } from "react";
import { useTui } from "../context/TuiContext.js";
import { useCleanup } from "./useCleanup.js";

export interface UseMyHookOptions {
  enabled?: boolean;
}

export interface UseMyHookResult {
  value: string;
}

export function useMyHook(options?: UseMyHookOptions): UseMyHookResult {
  const { input } = useTui();
  const valueRef = useRef("initial");

  // Register eagerly — not in useEffect.
  // Ref guard ensures this runs exactly once.
  const registeredRef = useRef(false);
  const unsubRef = useRef<(() => void) | null>(null);

  if (!registeredRef.current) {
    registeredRef.current = true;
    unsubRef.current = input.onKey((event) => {
      // handle event
    });
  }

  useCleanup(() => { unsubRef.current?.(); });

  return { value: valueRef.current };
}
```

**Every hook must:**
- Export an Options interface and a Result interface
- Use eager registration (not `useEffect`)
- Clean up with `useCleanup()`
- Use `useForceUpdate()` if ref changes need to trigger re-render

## Code style

- `exactOptionalPropertyTypes: true` — use `...(x ? {x} : {})` for optional props
- `noUncheckedIndexedAccess: true` — use `!` after bounds-checked access
- No `console.log` in production code
- No `useEffect` — use eager registration + `useCleanup`
- Import colors from theme — never hardcode hex values
- Brand color is `#82AAFF` (Electric Arc Blue)

## Testing

Storm has 452 tests across 12 test files:

```bash
npx vitest run                    # run all tests
npx vitest run layout             # run layout tests only
npx vitest run integration        # run integration tests
npx vitest run layout-properties  # run property-based layout tests
```

Test categories:
- `buffer.test.ts` — cell buffer operations
- `diff.test.ts` — diff renderer correctness
- `layout.test.ts` — flexbox layout engine
- `layout-properties.test.ts` — property-based layout tests (100 random iterations each)
- `integration.test.ts` — full render lifecycle, imperative mutation, focus, plugins
- `components.test.ts` — component rendering
- `render-context.test.ts` — focus, animation, scroll state
- `theme.test.ts` — color generation, contrast validation
- `benchmarks.test.ts` — performance baselines

### Integration tests wanted

The following real-world patterns lack dedicated integration tests:

- Form wizard with multi-step navigation (Form + Stepper + useWizard)
- VirtualList with SearchInput filtering and match highlighting
- Multiple ScrollViews with keyboard routing (activeScrollId)
- Modal with inner ScrollView keyboard + mouse scroll
- DirectoryTree with async onLoadChildren callback
- Theme switching via ThemeProvider (verifying all components pick up new colors)

Contributions welcome! See `src/__tests__/` for existing test patterns.

For headless component testing:

```typescript
import { renderForTest } from "@orchetron/storm-tui/testing";

const result = renderForTest(<MyComponent label="test" />);
expect(result.hasText("test")).toBe(true);
```

## Exports

When you add a component, hook, or widget, export it from the right `index.ts`:

- Component → `src/components/index.ts` + `src/index.ts`
- Widget → `src/widgets/index.ts` + `src/index.ts`
- Hook → `src/hooks/index.ts` + `src/index.ts`
- DevTools → `src/devtools/index.ts` + `src/index.ts`

## Development workflow

1. Fork and create a feature branch: `git checkout -b feat/my-feature`
2. Make your changes
3. Verify: `npx tsc --noEmit && npx vitest run`
4. Use `enableDevTools(app)` to visually verify your changes
5. Commit with a clear message: `feat: add sparkline width prop`
6. Open a PR against `main`

### Commit conventions

```
feat: add sparkline width prop
fix: ScrollView height calculation with padding
docs: add DiffView recipe
perf: reduce typed array allocation in diff
refactor: extract text wrapping to util
test: add property-based layout tests
```

## Reporting bugs

Open a GitHub issue with:
- What you expected
- What happened
- Minimal reproduction (a single `.tsx` file ideally)
- Terminal and Node.js version

## Pull requests

- One focused change per PR
- Describe what changed and why
- `npx tsc --noEmit` must pass with 0 errors
- `npx vitest run` must pass
- If you added a component/hook/widget, export it and document it in the relevant `docs/*.md`

## Architecture decisions

**Why typed arrays for the buffer?** Object-per-cell means 30,000 allocations per frame. Typed arrays (`Int32Array`, `Uint8Array`) are contiguous memory outside the GC heap. Near-zero GC pressure at 60fps.

**Why a custom React reconciler?** React gives us the component model, hooks, and reconciliation for free. The custom host config lets us target `tui-box` / `tui-text` elements instead of DOM nodes. We get React's developer experience without React's DOM overhead.

**Why `requestRender()` instead of `setState` for animations?** `setState` triggers React reconciliation + full layout rebuild (~5ms). `requestRender()` repaints from cached layout (~0.5ms). For a spinner updating at 80ms, the difference is the difference between smooth and janky.

**Why `useCleanup` instead of `useEffect`?** `useEffect` cleanup doesn't fire reliably in the custom reconciler. `useCleanup` hooks into the render context's cleanup registry, which runs on `unmount()`.

**Why `.js` extensions on TypeScript imports?** ESM requires file extensions. TypeScript resolves `.js` to `.ts` at compile time. This is the TypeScript-recommended approach for ESM projects.
