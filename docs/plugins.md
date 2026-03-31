# Storm TUI Plugin System

Plugins extend Storm TUI with custom behavior -- lifecycle hooks, input interception, component prop overrides, and default component configuration. They integrate deeply without modifying core code.

## What plugins can do

A `StormPlugin` is a plain object implementing any combination of these capabilities:

- **Lifecycle hooks** -- run code at setup, before/after each render, and on cleanup
- **Input interception** -- intercept keyboard and mouse events before they reach components, with the ability to consume (suppress) them
- **Component prop overrides** -- transform props passed to any component at render time
- **Component defaults** -- register default props for specific components (user props always win)
- **Custom elements** -- register custom element types with their own paint routines
- **Global shortcuts** -- add keyboard shortcuts via the plugin context

## StormPlugin interface

```ts
interface StormPlugin {
  /** Plugin name -- must be unique. */
  name: string;

  /** Called when the plugin is registered. */
  setup?: (context: PluginContext) => void;

  /** Called before each render. */
  beforeRender?: () => void;

  /** Called after each render with timing info. */
  afterRender?: (info: { renderTimeMs: number; cellsChanged: number }) => void;

  /** Called on key events before they reach components. Return null to consume. */
  onKey?: (event: KeyEvent) => KeyEvent | null;

  /** Called on mouse events before they reach components. Return null to consume. */
  onMouse?: (event: MouseEvent) => MouseEvent | null;

  /** Called when app exits. */
  cleanup?: () => void;

  /**
   * Intercept and modify component props before rendering.
   * Return the modified props, or undefined to pass through unchanged.
   */
  onComponentProps?: (
    componentName: string,
    props: Record<string, unknown>,
  ) => Record<string, unknown> | undefined;

  /**
   * Register default props for specific components.
   * These are applied BEFORE user props (user props win).
   */
  componentDefaults?: Record<string, Record<string, unknown>>;
}
```

The `PluginContext` provided to `setup` exposes:

```ts
interface PluginContext {
  registerElement: (tagName: string, handler: CustomElementHandler) => void;
  addShortcut: (shortcut: Shortcut) => void;
  renderContext: RenderContext;
  theme: StormColors;
}
```

## Creating a plugin

Here is a complete plugin that adds a Ctrl+R keyboard shortcut to reload data:

```ts
import type { StormPlugin } from "@orchetron/storm-tui";

let reloadCallback: (() => void) | null = null;

export function setReloadCallback(fn: () => void) {
  reloadCallback = fn;
}

export const reloadPlugin: StormPlugin = {
  name: "reload-shortcut",

  setup(context) {
    context.addShortcut({
      key: "r",
      ctrl: true,
      description: "Reload data",
      handler: () => reloadCallback?.(),
    });
  },

  onKey(event) {
    // Consume Ctrl+R so it doesn't propagate to components
    if (event.key === "r" && event.ctrl) {
      reloadCallback?.();
      return null; // consumed
    }
    return event; // pass through
  },

  beforeRender() {
    // Optional: track render count, log timing, etc.
  },

  cleanup() {
    reloadCallback = null;
  },
};
```

## Plugin lifecycle

Plugins follow a strict lifecycle in this order:

1. **setup** -- Called once when the plugin is registered via `pluginManager.register()`. Receives a `PluginContext` for registering custom elements and shortcuts.

2. **beforeRender** -- Called before every render pass. All registered plugins run in registration order. Use this for pre-render bookkeeping or resetting per-frame state.

3. **afterRender** -- Called after every render pass with timing information:
   ```ts
   afterRender(info: { renderTimeMs: number; cellsChanged: number }) {
     if (info.renderTimeMs > 16) {
       console.warn(`Slow render: ${info.renderTimeMs}ms`);
     }
   }
   ```

4. **cleanup** -- Called when the app exits or the plugin is unregistered. Clean up timers, file handles, or external resources here.

## Input interception

The `onKey` and `onMouse` hooks form a middleware chain. Each plugin receives the event and can either pass it through (return the event) or consume it (return `null`). Events flow through plugins in registration order -- if any plugin returns `null`, the event is dropped.

```ts
const loggingPlugin: StormPlugin = {
  name: "input-logger",

  onKey(event) {
    // Log every keypress but don't consume it
    console.log(`Key: ${event.key}, ctrl=${event.ctrl}`);
    return event;
  },

  onMouse(event) {
    // Block all mouse clicks in a specific region
    if (event.x < 10 && event.y < 5) {
      return null; // consumed -- components won't see it
    }
    return event;
  },
};
```

You can also modify events before passing them along:

```ts
onKey(event) {
  // Remap 'h' to left-arrow
  if (event.key === "h") {
    return { ...event, key: "left" };
  }
  return event;
}
```

## Component prop overrides

The `onComponentProps` callback is called for every component render. It receives the component name and the current props (after defaults are applied). Return modified props to transform them, or `undefined` to pass through unchanged.

```ts
const highContrastPlugin: StormPlugin = {
  name: "high-contrast",

  onComponentProps(componentName, props) {
    if (componentName === "Text") {
      return { ...props, bold: true };
    }
    // Return undefined for components we don't care about
    return undefined;
  },
};
```

The processing order is:

1. Merge `componentDefaults` from all plugins (in registration order)
2. Apply user-provided props on top (user props win)
3. Run each plugin's `onComponentProps` in registration order

## Component defaults

The `componentDefaults` record provides default prop values for named components. These are merged across all plugins, with later plugins overriding earlier ones. User-provided props always take precedence.

```ts
const compactPlugin: StormPlugin = {
  name: "compact-layout",

  componentDefaults: {
    Box: { paddingX: 0, paddingY: 0 },
    Text: { wrap: "truncate" },
    Select: { maxVisible: 5 },
  },
};
```

This is a declarative alternative to `onComponentProps` -- no function needed, just a record of component names to default props.

## Registering plugins

### Via render() options

Pass plugins when creating the app:

```ts
import { render } from "@orchetron/storm-tui";
import { reloadPlugin } from "./plugins/reload.js";

const app = render(<App />, {
  plugins: [reloadPlugin],
});
```

### Via pluginManager

Register plugins dynamically after render:

```ts
const app = render(<App />);

// Register later
app.pluginManager.register(myPlugin);

// Unregister by name (calls cleanup hook)
app.pluginManager.unregister("my-plugin");

// Query plugins
const plugin = app.pluginManager.getPlugin("my-plugin");
const all = app.pluginManager.getAll();
```

## Built-in plugins

### vim-mode

Storm TUI ships with a `vimModePlugin` that adds j/k navigation to list-style components:

```ts
import { vimModePlugin } from "@orchetron/storm-tui";

const app = render(<App />, {
  plugins: [vimModePlugin],
});
```

This plugin uses `componentDefaults` to set `keyBindings` on `Select`, `Menu`, and `ListView`:

```ts
// What vimModePlugin does internally:
const vimModePlugin: StormPlugin = {
  name: "vim-mode",
  componentDefaults: {
    Select: { keyBindings: { next: "j", prev: "k" } },
    Menu: { keyBindings: { next: "j", prev: "k" } },
    ListView: { keyBindings: { next: "j", prev: "k" } },
  },
};
```

Since these are defaults, users can still override key bindings per-component:

```tsx
<Select keyBindings={{ next: "n", prev: "p" }}>
  {/* These bindings override vim-mode's defaults */}
</Select>
```
