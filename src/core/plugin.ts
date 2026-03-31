/**
 * Plugin system for Storm TUI.
 *
 * Plugins can hook into the render lifecycle, intercept input events,
 * register custom elements, and add global keyboard shortcuts.
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

export interface StormPlugin {
  /** Plugin name — must be unique. */
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

// ── Plugin manager ─────────────────────────────────────────────────

export class PluginManager {
  private plugins: StormPlugin[] = [];
  private customElements = new Map<string, CustomElementHandler>();
  private shortcuts: Shortcut[] = [];

  /** Register a plugin. Calls its setup hook if a context is provided. */
  register(plugin: StormPlugin, context?: PluginContext): void {
    if (this.plugins.some((p) => p.name === plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered.`);
    }
    this.plugins.push(plugin);

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
      plugin.setup(pluginCtx);
    }
  }

  /** Unregister a plugin by name. Calls its cleanup hook. */
  unregister(name: string): void {
    const idx = this.plugins.findIndex((p) => p.name === name);
    if (idx === -1) return;
    const plugin = this.plugins[idx]!;
    plugin.cleanup?.();
    this.plugins.splice(idx, 1);
  }

  /** Get a plugin by name. */
  getPlugin(name: string): StormPlugin | undefined {
    return this.plugins.find((p) => p.name === name);
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

  /** Run all beforeRender hooks. */
  runBeforeRender(): void {
    for (const plugin of this.plugins) {
      plugin.beforeRender?.();
    }
  }

  /** Run all afterRender hooks. */
  runAfterRender(info: { renderTimeMs: number; cellsChanged: number }): void {
    for (const plugin of this.plugins) {
      plugin.afterRender?.(info);
    }
  }

  /** Run key event through the middleware chain. Returns null if consumed. */
  processKey(event: KeyEvent): KeyEvent | null {
    let current: KeyEvent | null = event;
    for (const plugin of this.plugins) {
      if (!current) break;
      if (plugin.onKey) {
        current = plugin.onKey(current);
      }
    }
    return current;
  }

  /** Run mouse event through the middleware chain. Returns null if consumed. */
  processMouse(event: MouseEvent): MouseEvent | null {
    let current: MouseEvent | null = event;
    for (const plugin of this.plugins) {
      if (!current) break;
      if (plugin.onMouse) {
        current = plugin.onMouse(current);
      }
    }
    return current;
  }

  /** Run all cleanup hooks. */
  runCleanup(): void {
    for (const plugin of this.plugins) {
      plugin.cleanup?.();
    }
  }

  /** Get merged component defaults from all plugins for a given component. */
  getComponentDefaults(componentName: string): Record<string, unknown> {
    let merged: Record<string, unknown> = {};
    for (const plugin of this.plugins) {
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
      if (plugin.onComponentProps) {
        const transformed = plugin.onComponentProps(componentName, result);
        if (transformed !== undefined) {
          result = transformed;
        }
      }
    }
    return result;
  }
}
