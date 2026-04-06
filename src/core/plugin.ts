import type { KeyEvent, MouseEvent } from "../input/types.js";

interface Shortcut { key: string; ctrl?: boolean; shift?: boolean; meta?: boolean; handler: () => void; label?: string; description?: string; }
import type { RenderContext } from "./render-context.js";
import type { ScreenBuffer } from "./buffer.js";
import type { StormColors } from "../theme/colors.js";

export interface CustomElementHandler {
  /** Paint the custom element to the buffer. Receives the element's React props via the optional `props` parameter. */
  paint: (
    element: unknown,
    buffer: ScreenBuffer,
    x: number,
    y: number,
    width: number,
    height: number,
    props?: Record<string, unknown>,
  ) => void;
  /** Called when a custom element is added to the tree. */
  mount?: (element: unknown) => void;
  /** Called when a custom element is removed from the tree. */
  unmount?: (element: unknown) => void;
  /** Called when a custom element's props are updated by React reconciliation. */
  update?: (element: unknown, props: Record<string, unknown>) => void;
  /** Called on keyboard input when the custom element (or its ancestor) is focused. */
  onKey?: (event: KeyEvent) => void;
}

export class PluginBus {
  private listeners = new Map<string, Set<(data: unknown) => void>>();

  /** Emit data on a channel. All registered handlers are called synchronously. */
  emit(channel: string, data: unknown): void {
    const handlers = this.listeners.get(channel);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (err) {
        process.stderr.write(
          `[storm] PluginBus error on channel "${channel}": ${(err as Error).message}\n`,
        );
      }
    }
  }

  /** Subscribe to a channel. Returns an unsubscribe function. */
  on(channel: string, handler: (data: unknown) => void): () => void {
    let handlers = this.listeners.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(channel, handlers);
    }
    handlers.add(handler);
    return () => {
      handlers!.delete(handler);
      if (handlers!.size === 0) {
        this.listeners.delete(channel);
      }
    };
  }

  /** Subscribe to a channel for a single emission only. Returns an unsubscribe function. */
  once(channel: string, handler: (data: unknown) => void): () => void {
    const unsubscribe = this.on(channel, (data) => {
      unsubscribe();
      handler(data);
    });
    return unsubscribe;
  }
}

export interface PluginContext {
  /** Register a custom element type. */
  registerElement: (tagName: string, handler: CustomElementHandler) => void;
  /** Add a global keyboard shortcut. */
  addShortcut: (shortcut: Shortcut) => void;
  /** Access the render context. */
  renderContext: RenderContext;
  /** Access the theme. */
  theme: StormColors;
  /** Inter-plugin communication bus. */
  bus: PluginBus;
}

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
  /**
   * Optional scope identifier. When set, the plugin's onComponentProps hook
   * only applies to components within a matching scope subtree.
   * When undefined, the plugin affects all components (default behavior).
   */
  scope?: string;
  /** Called when the plugin is registered. Receives merged config. May be async. */
  setup?: (context: PluginContext, config: TConfig) => void | Promise<void>;
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

export interface PluginManagerOptions {
  /**
   * When true, circular dependencies throw an Error instead of warning.
   * Default: true in dev (NODE_ENV !== "production"), false in prod.
   */
  strictDependencies?: boolean;
}

/** Default priority for plugins that don't specify one. */
const DEFAULT_PRIORITY = 100;

/** Lifecycle hooks, input interception, custom elements, and component prop transforms. Priority + dependency ordered. */
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

  private comparePriority = (a: { name: string; priority?: number }, b: { name: string; priority?: number }): number => {
    const priDiff = (a.priority ?? DEFAULT_PRIORITY) - (b.priority ?? DEFAULT_PRIORITY);
    if (priDiff !== 0) return priDiff;
    return (this.registrationOrder.get(a.name) ?? 0) - (this.registrationOrder.get(b.name) ?? 0);
  };
  /** Scope stack for scoped plugin support. */
  private scopeStack: string[] = [];
  /** Inter-plugin communication bus. */
  readonly bus = new PluginBus();

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
        `[storm] Plugin "${pluginName}" error in ${hookName}: ${(err as Error).message}\n`,
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

    for (const plugin of this.plugins) {
      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          if (!names.has(dep)) {
            process.stderr.write(
              `[storm] Plugin "${plugin.name}" depends on "${dep}" which is not registered.\n`,
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
          `[storm] Circular plugin dependency detected. Cannot resolve plugin ordering.`,
        );
      }
      // Non-strict: fall back to priority-only sort with registration order tiebreaker
      process.stderr.write(
        `[storm] Circular plugin dependency detected. Falling back to priority order.\n`,
      );
      this.plugins.sort(this.comparePriority);
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
    queue.sort(this.comparePriority);

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
        readyPlugins.sort(this.comparePriority);
        queue.push(...readyPlugins);
        queue.sort(this.comparePriority);
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

    this.sortPlugins();

    if (plugin.setup && context) {
      const pluginCtx = this.buildPluginContext(context);
      const ok = this.safeCall(plugin.name, "setup", () => {
        const result = plugin.setup!(pluginCtx, mergedConfig as never);
        // If setup returns a promise, we can't await it here (register is sync).
        // Log a warning — callers should use setupAll() for async plugins.
        if (result && typeof (result as Promise<void>).then === "function") {
          (result as Promise<void>).catch((err) => {
            process.stderr.write(
              `[storm] Plugin "${plugin.name}" async setup error: ${(err as Error).message}\n`,
            );
            this.failedPlugins.add(plugin.name);
          });
        }
      });
      if (!ok) {
        this.failedPlugins.add(plugin.name);
      }
    }
  }

  /**
   * Build a PluginContext from an external context, wiring up element registration,
   * shortcuts, and the plugin bus.
   */
  private buildPluginContext(context: PluginContext): PluginContext {
    return {
      ...context,
      bus: this.bus,
      registerElement: (tagName, handler) => {
        this.customElements.set(tagName, handler);
      },
      addShortcut: (shortcut) => {
        this.shortcuts.push(shortcut);
      },
    };
  }

  /**
   * Run all plugin setup hooks sequentially, respecting dependency order.
   * Supports async setup hooks — each is awaited before proceeding to the next.
   * Plugins whose setup has already been run (via register()) are skipped if
   * they are not in the failed set and were already initialized.
   */
  async setupAll(context: PluginContext): Promise<void> {
    const pluginCtx = this.buildPluginContext(context);
    for (const plugin of this.plugins) {
      if (this.failedPlugins.has(plugin.name)) continue;
      if (!plugin.setup) continue;
      try {
        const result = plugin.setup(pluginCtx, this.configs.get(plugin.name) as never);
        if (result && typeof (result as Promise<void>).then === "function") {
          await (result as Promise<void>);
        }
      } catch (err) {
        process.stderr.write(
          `[storm] Plugin "${plugin.name}" error in setup: ${(err as Error).message}\n`,
        );
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

  getPlugin(name: string): StormPlugin | undefined {
    return this.plugins.find((p) => p.name === name);
  }

  getPluginConfig<T = unknown>(name: string): T | undefined {
    return this.configs.get(name) as T | undefined;
  }

  getAll(): readonly StormPlugin[] {
    return this.plugins;
  }

  getCustomElements(): ReadonlyMap<string, CustomElementHandler> {
    return this.customElements;
  }

  getShortcuts(): readonly Shortcut[] {
    return this.shortcuts;
  }

  isPluginFailed(name: string): boolean {
    return this.failedPlugins.has(name);
  }

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
            `[storm] Plugin "${plugin.name}" error in onKey: ${(err as Error).message}\n`,
          );
          // Don't lose the event — continue with current value
        }
      }
    }
    return current;
  }

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
            `[storm] Plugin "${plugin.name}" error in onMouse: ${(err as Error).message}\n`,
          );
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

  isDestroyed(): boolean {
    return this.destroyed;
  }

  // ── Scope management ──────────────────────────────────────────────

  /**
   * Push a scope onto the scope stack. Plugins with a matching `scope`
   * will have their onComponentProps hooks active for components rendered
   * while this scope is on the stack.
   */
  pushScope(scopeId: string): void {
    this.scopeStack.push(scopeId);
  }

  popScope(): void {
    this.scopeStack.pop();
  }

  /** Get the current active scope (top of stack), or undefined if none. */
  get currentScope(): string | undefined {
    return this.scopeStack.length > 0
      ? this.scopeStack[this.scopeStack.length - 1]
      : undefined;
  }

  // ── Plugin metadata & discovery ───────────────────────────────────

  /**
   * Get metadata for all registered plugins.
   */
  getPlugins(): Array<{ name: string; priority: number; failed: boolean; config: unknown }> {
    return this.plugins.map((p) => ({
      name: p.name,
      priority: p.priority ?? DEFAULT_PRIORITY,
      failed: this.failedPlugins.has(p.name),
      config: this.configs.get(p.name),
    }));
  }

  hasPlugin(name: string): boolean {
    return this.plugins.some((p) => p.name === name);
  }

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

  applyComponentProps<T extends Record<string, unknown>>(
    componentName: string,
    props: T,
  ): T {
    // 1. Start with merged defaults from all plugins
    const defaults = this.getComponentDefaults(componentName);
    // 2. User props override defaults
    let result: Record<string, unknown> = { ...defaults, ...(props as unknown as Record<string, unknown>) };
    // 3. Run each plugin's onComponentProps interceptor in order
    for (const plugin of this.plugins) {
      if (this.failedPlugins.has(plugin.name)) continue;
      if (plugin.onComponentProps) {
        // Scope check: if the plugin has a scope, it must match one of
        // the currently active scopes in the scope stack.
        if (plugin.scope !== undefined) {
          if (!this.scopeStack.includes(plugin.scope)) {
            continue;
          }
        }
        try {
          const transformed = plugin.onComponentProps(componentName, result);
          if (transformed !== undefined) {
            result = transformed;
          }
        } catch (err) {
          process.stderr.write(
            `[storm] Plugin "${plugin.name}" error in onComponentProps: ${(err as Error).message}\n`,
          );
        }
      }
    }
    return result as unknown as T;
  }

  /**
   * Notify custom element handlers of a mount event.
   * Called by the reconciler when a custom element is added to the tree.
   * @internal
   */
  private notifyCustomElement(tagName: string, hook: string, fn: () => void): void {
    const handler = this.customElements.get(tagName);
    if (!handler || !(hook in handler) || !handler[hook as keyof CustomElementHandler]) return;
    try { fn(); } catch (err) {
      process.stderr.write(`[storm] Custom element "${tagName}" error in ${hook}: ${(err as Error).message}\n`);
    }
  }

  notifyCustomElementMount(tagName: string, element: unknown): void {
    this.notifyCustomElement(tagName, "mount", () => this.customElements.get(tagName)!.mount!(element));
  }

  notifyCustomElementUnmount(tagName: string, element: unknown): void {
    this.notifyCustomElement(tagName, "unmount", () => this.customElements.get(tagName)!.unmount!(element));
  }

  notifyCustomElementUpdate(tagName: string, element: unknown, props: Record<string, unknown>): void {
    this.notifyCustomElement(tagName, "update", () => this.customElements.get(tagName)!.update!(element, props));
  }
}
