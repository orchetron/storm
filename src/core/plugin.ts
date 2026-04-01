/**
 * Plugin system for Storm TUI.
 *
 * Plugins can hook into the render lifecycle, intercept input events,
 * register custom elements, and add global keyboard shortcuts.
 *
 * Features:
 * - Priority-based ordering (lower priority runs first, default: 100)
 * - Dependency validation and topological sorting
 * - Per-plugin configuration via generic TConfig
 * - Error isolation: every hook call is wrapped in try/catch
 * - Guaranteed cleanup in reverse order with double-cleanup protection
 * - Custom element mount/unmount lifecycle hooks
 */

import type { KeyEvent, MouseEvent } from "../input/types.js";
import type { Shortcut } from "../hooks/useKeyboardShortcuts.js";
import type { RenderContext } from "./render-context.js";
import type { ScreenBuffer } from "./buffer.js";
import type { StormColors } from "../theme/colors.js";

// ── Custom element handler ─────────────────────────────────────────

export interface CustomElementHandler {
  /** Paint the custom element to the buffer. */
  paint: (
    element: unknown,
    buffer: ScreenBuffer,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  /** Called when a custom element is added to the tree. */
  mount?: (element: unknown) => void;
  /** Called when a custom element is removed from the tree. */
  unmount?: (element: unknown) => void;
}

// ── Plugin context ─────────────────────────────────────────────────

export interface PluginContext {
  /** Register a custom element type. */
  registerElement: (tagName: string, handler: CustomElementHandler) => void;
  /** Add a global keyboard shortcut. */
  addShortcut: (shortcut: Shortcut) => void;
  /** Access the render context. */
  renderContext: RenderContext;
  /** Access the theme. */
  theme: StormColors;
}

// ── Plugin interface ───────────────────────────────────────────────

export interface StormPlugin<TConfig = unknown> {
  /** Plugin name — must be unique. */
  name: string;
  /**
   * Execution priority. Lower values run first. Default: 100.
   * Plugins with equal priority run in registration order.
   */
  priority?: number;
  /**
   * Names of plugins that must run before this one.
   * If a dependency is not registered, a warning is emitted to stderr.
   * Circular dependencies fall back to priority order with a warning.
   */
  dependencies?: string[];
  /** Default configuration for this plugin. Merged with user-provided config. */
  defaultConfig?: TConfig;
  /** Called when the plugin is registered. Receives merged config. */
  setup?: (context: PluginContext, config: TConfig) => void;
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

// ── Plugin manager options ─────────────────────────────────────────

export interface PluginManagerOptions {
  /**
   * When true, circular dependencies throw an Error instead of warning.
   * Default: true in dev (NODE_ENV !== "production"), false in prod.
   */
  strictDependencies?: boolean;
}

// ── Plugin manager ─────────────────────────────────────────────────

/** Default priority for plugins that don't specify one. */
const DEFAULT_PRIORITY = 100;

export class PluginManager {
  private plugins: StormPlugin[] = [];
  private customElements = new Map<string, CustomElementHandler>();
  private shortcuts: Shortcut[] = [];
  private configs = new Map<string, unknown>();
  private failedPlugins = new Set<string>();
  private destroyed = false;
  /** Tracks registration order for stable sorting when priorities are equal. */
  private registrationOrder = new Map<string, number>();
  private registrationCounter = 0;
  private readonly strictDependencies: boolean;

  constructor(options?: PluginManagerOptions) {
    this.strictDependencies = options?.strictDependencies ??
      (process.env.NODE_ENV !== "production");
  }

  /**
   * Safely invoke a plugin hook. Catches and logs errors to stderr.
   * Returns false if the call threw an error.
   */
  private safeCall(pluginName: string, hookName: string, fn: () => void): boolean {
    try {
      fn();
      return true;
    } catch (err) {
      process.stderr.write(
        `[storm-tui] Plugin "${pluginName}" error in ${hookName}: ${(err as Error).message}\n`,
      );
      return false;
    }
  }

  /**
   * Sort the plugins array by priority and dependency order.
   * Called after each register() to maintain a consistent execution order.
   */
  private sortPlugins(): void {
    const names = new Set(this.plugins.map((p) => p.name));

    // Validate dependencies exist
    for (const plugin of this.plugins) {
      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          if (!names.has(dep)) {
            process.stderr.write(
              `[storm-tui] Plugin "${plugin.name}" depends on "${dep}" which is not registered.\n`,
            );
          }
        }
      }
    }

    // Attempt topological sort respecting dependencies
    const sorted = this.topologicalSort();
    if (sorted) {
      this.plugins = sorted;
    } else {
      // Circular dependency detected
      if (this.strictDependencies) {
        throw new Error(
          `[storm-tui] Circular plugin dependency detected. Cannot resolve plugin ordering.`,
        );
      }
      // Non-strict: fall back to priority-only sort with registration order tiebreaker
      process.stderr.write(
        `[storm-tui] Circular plugin dependency detected. Falling back to priority order.\n`,
      );
      this.plugins.sort((a, b) => {
        const priDiff = (a.priority ?? DEFAULT_PRIORITY) - (b.priority ?? DEFAULT_PRIORITY);
        if (priDiff !== 0) return priDiff;
        return (this.registrationOrder.get(a.name) ?? 0) - (this.registrationOrder.get(b.name) ?? 0);
      });
    }
  }

  /**
   * Topological sort of plugins respecting both priority and dependencies.
   * Returns null if a cycle is detected.
   */
  private topologicalSort(): StormPlugin[] | null {
    const pluginMap = new Map<string, StormPlugin>();
    for (const p of this.plugins) {
      pluginMap.set(p.name, p);
    }

    // Build adjacency: if A depends on B, B must come before A (edge B -> A)
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>(); // dep -> plugins that depend on it

    for (const p of this.plugins) {
      inDegree.set(p.name, 0);
      dependents.set(p.name, []);
    }

    for (const p of this.plugins) {
      if (p.dependencies) {
        for (const dep of p.dependencies) {
          if (pluginMap.has(dep)) {
            inDegree.set(p.name, (inDegree.get(p.name) ?? 0) + 1);
            dependents.get(dep)!.push(p.name);
          }
        }
      }
    }

    // Kahn's algorithm with priority-ordered queue
    const queue: StormPlugin[] = [];
    for (const p of this.plugins) {
      if (inDegree.get(p.name) === 0) {
        queue.push(p);
      }
    }
    // Sort initial queue by priority, then registration order for stable tie-breaking
    queue.sort((a, b) => {
      const priDiff = (a.priority ?? DEFAULT_PRIORITY) - (b.priority ?? DEFAULT_PRIORITY);
      if (priDiff !== 0) return priDiff;
      return (this.registrationOrder.get(a.name) ?? 0) - (this.registrationOrder.get(b.name) ?? 0);
    });

    const result: StormPlugin[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const deps = dependents.get(current.name);
      if (deps) {
        const readyPlugins: StormPlugin[] = [];
        for (const depName of deps) {
          const newDeg = (inDegree.get(depName) ?? 1) - 1;
          inDegree.set(depName, newDeg);
          if (newDeg === 0) {
            const p = pluginMap.get(depName);
            if (p) readyPlugins.push(p);
          }
        }
        // Sort newly ready plugins by priority, then registration order for stable tie-breaking
        readyPlugins.sort((a, b) => {
          const priDiff = (a.priority ?? DEFAULT_PRIORITY) - (b.priority ?? DEFAULT_PRIORITY);
          if (priDiff !== 0) return priDiff;
          return (this.registrationOrder.get(a.name) ?? 0) - (this.registrationOrder.get(b.name) ?? 0);
        });
        queue.push(...readyPlugins);
        // Re-sort the queue to maintain global priority + registration ordering
        queue.sort((a, b) => {
          const priDiff = (a.priority ?? DEFAULT_PRIORITY) - (b.priority ?? DEFAULT_PRIORITY);
          if (priDiff !== 0) return priDiff;
          return (this.registrationOrder.get(a.name) ?? 0) - (this.registrationOrder.get(b.name) ?? 0);
        });
      }
    }

    // If we didn't visit all plugins, there's a cycle
    if (result.length !== this.plugins.length) {
      return null;
    }

    return result;
  }

  /** Register a plugin. Calls its setup hook if a context is provided. */
  register(plugin: StormPlugin, contextOrConfig?: PluginContext | unknown, maybeContext?: PluginContext): void {
    if (this.plugins.some((p) => p.name === plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered.`);
    }

    // Resolve overloaded arguments:
    // register(plugin, context)         — backward compatible
    // register(plugin, config)          — new: config only (no context)
    // register(plugin, config, context) — new: config + context
    let config: unknown;
    let context: PluginContext | undefined;

    if (maybeContext !== undefined) {
      // Three-arg form: register(plugin, config, context)
      config = contextOrConfig;
      context = maybeContext;
    } else if (
      contextOrConfig !== undefined &&
      contextOrConfig !== null &&
      typeof contextOrConfig === "object" &&
      "registerElement" in contextOrConfig &&
      "addShortcut" in contextOrConfig &&
      "renderContext" in contextOrConfig
    ) {
      // Two-arg form with PluginContext (backward compatible)
      context = contextOrConfig as PluginContext;
      config = undefined;
    } else {
      // Two-arg form with config (no context)
      config = contextOrConfig;
    }

    // Merge config: user-provided config overrides defaultConfig
    const mergedConfig =
      plugin.defaultConfig !== undefined || config !== undefined
        ? {
            ...(typeof plugin.defaultConfig === "object" && plugin.defaultConfig !== null
              ? plugin.defaultConfig
              : {}),
            ...(typeof config === "object" && config !== null ? config : {}),
          }
        : undefined;

    this.configs.set(plugin.name, mergedConfig);
    this.registrationOrder.set(plugin.name, this.registrationCounter++);
    this.plugins.push(plugin);

    // Sort plugins by priority and dependencies
    this.sortPlugins();

    if (plugin.setup && context) {
      const pluginCtx: PluginContext = {
        ...context,
        registerElement: (tagName, handler) => {
          this.customElements.set(tagName, handler);
        },
        addShortcut: (shortcut) => {
          this.shortcuts.push(shortcut);
        },
      };
      const ok = this.safeCall(plugin.name, "setup", () => {
        plugin.setup!(pluginCtx, mergedConfig as never);
      });
      if (!ok) {
        this.failedPlugins.add(plugin.name);
      }
    }
  }

  /** Unregister a plugin by name. Calls its cleanup hook. */
  unregister(name: string): void {
    const idx = this.plugins.findIndex((p) => p.name === name);
    if (idx === -1) return;
    const plugin = this.plugins[idx]!;
    if (plugin.cleanup) {
      this.safeCall(plugin.name, "cleanup", () => {
        plugin.cleanup!();
      });
    }
    this.plugins.splice(idx, 1);
    this.configs.delete(name);
    this.failedPlugins.delete(name);
    this.registrationOrder.delete(name);
  }

  /** Get a plugin by name. */
  getPlugin(name: string): StormPlugin | undefined {
    return this.plugins.find((p) => p.name === name);
  }

  /** Get the merged config for a plugin by name. */
  getPluginConfig<T = unknown>(name: string): T | undefined {
    return this.configs.get(name) as T | undefined;
  }

  /** Get all registered plugins. */
  getAll(): readonly StormPlugin[] {
    return this.plugins;
  }

  /** Get all registered custom element handlers. */
  getCustomElements(): ReadonlyMap<string, CustomElementHandler> {
    return this.customElements;
  }

  /** Get all registered shortcuts from plugins. */
  getShortcuts(): readonly Shortcut[] {
    return this.shortcuts;
  }

  /** Check if a plugin's setup failed. Failed plugins have their hooks skipped. */
  isPluginFailed(name: string): boolean {
    return this.failedPlugins.has(name);
  }

  /** Run all beforeRender hooks. */
  runBeforeRender(): void {
    for (const plugin of this.plugins) {
      if (this.failedPlugins.has(plugin.name)) continue;
      if (plugin.beforeRender) {
        this.safeCall(plugin.name, "beforeRender", () => {
          plugin.beforeRender!();
        });
      }
    }
  }

  /** Run all afterRender hooks. */
  runAfterRender(info: { renderTimeMs: number; cellsChanged: number }): void {
    for (const plugin of this.plugins) {
      if (this.failedPlugins.has(plugin.name)) continue;
      if (plugin.afterRender) {
        this.safeCall(plugin.name, "afterRender", () => {
          plugin.afterRender!(info);
        });
      }
    }
  }

  /** Run key event through the middleware chain. Returns null if consumed. */
  processKey(event: KeyEvent): KeyEvent | null {
    let current: KeyEvent | null = event;
    for (const plugin of this.plugins) {
      if (!current) break;
      if (this.failedPlugins.has(plugin.name)) continue;
      if (plugin.onKey) {
        try {
          current = plugin.onKey(current);
        } catch (err) {
          process.stderr.write(
            `[storm-tui] Plugin "${plugin.name}" error in onKey: ${(err as Error).message}\n`,
          );
          // Don't lose the event — continue with current value
        }
      }
    }
    return current;
  }

  /** Run mouse event through the middleware chain. Returns null if consumed. */
  processMouse(event: MouseEvent): MouseEvent | null {
    let current: MouseEvent | null = event;
    for (const plugin of this.plugins) {
      if (!current) break;
      if (this.failedPlugins.has(plugin.name)) continue;
      if (plugin.onMouse) {
        try {
          current = plugin.onMouse(current);
        } catch (err) {
          process.stderr.write(
            `[storm-tui] Plugin "${plugin.name}" error in onMouse: ${(err as Error).message}\n`,
          );
          // Don't lose the event — continue with current value
        }
      }
    }
    return current;
  }

  /**
   * Run all cleanup hooks in reverse order (last registered, first cleaned up).
   * Each cleanup is wrapped in try/catch so one failure doesn't skip the rest.
   * Idempotent: calling runCleanup() again after the first call is a no-op.
   */
  runCleanup(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    // Reverse order: last registered plugin cleans up first
    for (let i = this.plugins.length - 1; i >= 0; i--) {
      const plugin = this.plugins[i]!;
      if (plugin.cleanup) {
        this.safeCall(plugin.name, "cleanup", () => {
          plugin.cleanup!();
        });
      }
    }
  }

  /** Whether runCleanup() has already been called. */
  isDestroyed(): boolean {
    return this.destroyed;
  }

  /** Get merged component defaults from all plugins for a given component. */
  getComponentDefaults(componentName: string): Record<string, unknown> {
    let merged: Record<string, unknown> = {};
    for (const plugin of this.plugins) {
      if (this.failedPlugins.has(plugin.name)) continue;
      const defaults = plugin.componentDefaults?.[componentName];
      if (defaults) {
        merged = { ...merged, ...defaults };
      }
    }
    return merged;
  }

  /** Apply all registered plugin interceptors to component props. */
  applyComponentProps(
    componentName: string,
    props: Record<string, unknown>,
  ): Record<string, unknown> {
    // 1. Start with merged defaults from all plugins
    const defaults = this.getComponentDefaults(componentName);
    // 2. User props override defaults
    let result: Record<string, unknown> = { ...defaults, ...props };
    // 3. Run each plugin's onComponentProps interceptor in order
    for (const plugin of this.plugins) {
      if (this.failedPlugins.has(plugin.name)) continue;
      if (plugin.onComponentProps) {
        try {
          const transformed = plugin.onComponentProps(componentName, result);
          if (transformed !== undefined) {
            result = transformed;
          }
        } catch (err) {
          process.stderr.write(
            `[storm-tui] Plugin "${plugin.name}" error in onComponentProps: ${(err as Error).message}\n`,
          );
        }
      }
    }
    return result;
  }

  /**
   * Notify custom element handlers of a mount event.
   * Called by the reconciler when a custom element is added to the tree.
   * @internal
   */
  notifyCustomElementMount(tagName: string, element: unknown): void {
    const handler = this.customElements.get(tagName);
    if (handler?.mount) {
      try {
        handler.mount(element);
      } catch (err) {
        process.stderr.write(
          `[storm-tui] Custom element "${tagName}" error in mount: ${(err as Error).message}\n`,
        );
      }
    }
  }

  /**
   * Notify custom element handlers of an unmount event.
   * Called by the reconciler when a custom element is removed from the tree.
   * @internal
   */
  notifyCustomElementUnmount(tagName: string, element: unknown): void {
    const handler = this.customElements.get(tagName);
    if (handler?.unmount) {
      try {
        handler.unmount(element);
      } catch (err) {
        process.stderr.write(
          `[storm-tui] Custom element "${tagName}" error in unmount: ${(err as Error).message}\n`,
        );
      }
    }
  }
}
