/**
 * React reconciler host configuration.
 *
 * Tells React how to create, mutate, and commit our TUI elements.
 * After React commits all changes, we trigger layout → paint → diff.
 */

import Reconciler from "react-reconciler";
import { DefaultEventPriority } from "react-reconciler/constants.js";
import {
  type TuiElement,
  type TuiTextNode,
  type TuiRoot,
  type TuiElementType,
  createElement,
  createTextNode,
  isTuiElement,
  extractLayoutProps,
} from "./types.js";

type HostType = TuiElementType;
type HostProps = Record<string, unknown>;
type HostContainer = TuiRoot;
type HostInstance = TuiElement;
type HostTextInstance = TuiTextNode;
type HostContext = Record<string, never>;
type HostUpdatePayload = Record<string, unknown> | null;

/** Extracted from react-reconciler's createReconciler parameter type. */
type StormHostConfig = Parameters<typeof Reconciler>[0];

// ── Custom element lifecycle hooks ───────────────────────────────
// These are set by render() to wire the PluginManager's custom element
// mount/unmount notifications into the reconciler's tree mutation calls.
// Module-level because hostConfig is a static singleton.

type ElementLifecycleHook = (type: string, element: unknown) => void;
let _onCustomElementMount: ElementLifecycleHook | null = null;
let _onCustomElementUnmount: ElementLifecycleHook | null = null;

/**
 * Set callbacks for custom element mount/unmount lifecycle events.
 * Called by render() to connect the PluginManager's lifecycle hooks.
 * @internal
 */
export function setCustomElementLifecycleHooks(
  onMount: ElementLifecycleHook | null,
  onUnmount: ElementLifecycleHook | null,
): void {
  _onCustomElementMount = onMount;
  _onCustomElementUnmount = onUnmount;
}

/** Known built-in element types — anything else is a custom element. */
const BUILTIN_TYPES = new Set(["tui-box", "tui-text", "tui-scroll-view", "tui-text-input", "tui-overlay"]);

function appendChild(
  parent: HostInstance | HostContainer,
  child: HostInstance | HostTextInstance,
): void {
  // Validate nesting: tui-box cannot be a child of tui-text
  if ("type" in child && child.type === "tui-box" && "type" in parent && parent.type === "tui-text") {
    console.warn(
      "Storm TUI: <Box> cannot be nested inside <Text>. " +
      "Use <Text> for styled content, <Box> for layout. " +
      "Wrap text content in <Text> elements inside a <Box>."
    );
  }
  const children = "children" in parent ? parent.children : [];
  children.push(child);
  if ("parent" in child) {
    child.parent = "type" in parent && parent.type !== undefined
      ? (parent as HostInstance)
      : null;
  }
  // Capture text node ref for imperative mutation (Spinner, etc.)
  if (child.type === "TEXT_NODE" && "props" in parent) {
    const ref = (parent as HostInstance).props["_textNodeRef"] as { current: unknown } | undefined;
    if (ref) {
      ref.current = child;
    }
  }
  // Notify custom element lifecycle: mount
  if ("type" in child && child.type !== "TEXT_NODE" && !BUILTIN_TYPES.has(child.type) && _onCustomElementMount) {
    _onCustomElementMount(child.type, child);
  }
}

function removeChild(
  parent: HostInstance | HostContainer,
  child: HostInstance | HostTextInstance,
): void {
  // Notify custom element lifecycle: unmount (before removal)
  if ("type" in child && child.type !== "TEXT_NODE" && !BUILTIN_TYPES.has(child.type) && _onCustomElementUnmount) {
    _onCustomElementUnmount(child.type, child);
  }
  const children = "children" in parent ? parent.children : [];
  const idx = children.indexOf(child);
  if (idx >= 0) children.splice(idx, 1);
  if ("parent" in child) child.parent = null;
}

function insertBefore(
  parent: HostInstance | HostContainer,
  child: HostInstance | HostTextInstance,
  before: HostInstance | HostTextInstance,
): void {
  // Validate nesting: tui-box cannot be a child of tui-text
  if ("type" in child && child.type === "tui-box" && "type" in parent && parent.type === "tui-text") {
    console.warn(
      "Storm TUI: <Box> cannot be nested inside <Text>. " +
      "Use <Text> for styled content, <Box> for layout. " +
      "Wrap text content in <Text> elements inside a <Box>."
    );
  }
  const children = "children" in parent ? parent.children : [];
  const idx = children.indexOf(before);
  if (idx >= 0) {
    children.splice(idx, 0, child);
  } else {
    children.push(child);
  }
  if ("parent" in child) {
    child.parent = "type" in parent && parent.type !== undefined
      ? (parent as HostInstance)
      : null;
  }
  // Notify custom element lifecycle: mount
  if ("type" in child && child.type !== "TEXT_NODE" && !BUILTIN_TYPES.has(child.type) && _onCustomElementMount) {
    _onCustomElementMount(child.type, child);
  }
}

function diffProps(
  oldProps: HostProps,
  newProps: HostProps,
): HostUpdatePayload {
  let changed: Record<string, unknown> | null = null;
  // Check for changed/added props
  for (const key of Object.keys(newProps)) {
    if (key === "children") continue;
    if (oldProps[key] !== newProps[key]) {
      changed ??= {};
      changed[key] = newProps[key];
    }
  }
  // Check for removed props
  for (const key of Object.keys(oldProps)) {
    if (key === "children") continue;
    if (!(key in newProps)) {
      changed ??= {};
      changed[key] = undefined;
    }
  }
  return changed;
}

export const hostConfig: StormHostConfig = {
  // ── Feature flags ───────────────────────────────────────────────

  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: true,
  noTimeout: -1 as -1,

  // ── Instance creation ───────────────────────────────────────────

  createInstance(type: HostType, props: HostProps): HostInstance {
    const el = createElement(type, props);
    // If the component passed a _hostPropsRef, store the element's props in it
    // so the component can imperatively mutate props (e.g., scrollTop)
    const ref = props["_hostPropsRef"] as { current: unknown } | undefined;
    if (ref) ref.current = el.props;
    return el;
  },

  createTextInstance(text: string): HostTextInstance {
    return createTextNode(text);
  },

  // ── Tree mutation ───────────────────────────────────────────────

  appendInitialChild: appendChild,
  appendChild: appendChild,
  appendChildToContainer(container: HostContainer, child: HostInstance | HostTextInstance): void {
    container.children.push(child);
    if ("parent" in child) child.parent = null;
    // Notify custom element lifecycle: mount
    if ("type" in child && child.type !== "TEXT_NODE" && !BUILTIN_TYPES.has(child.type) && _onCustomElementMount) {
      _onCustomElementMount(child.type, child);
    }
  },

  removeChild: removeChild,
  removeChildFromContainer(container: HostContainer, child: HostInstance | HostTextInstance): void {
    // Notify custom element lifecycle: unmount (before removal)
    if ("type" in child && child.type !== "TEXT_NODE" && !BUILTIN_TYPES.has(child.type) && _onCustomElementUnmount) {
      _onCustomElementUnmount(child.type, child);
    }
    const idx = container.children.indexOf(child);
    if (idx >= 0) container.children.splice(idx, 1);
    if ("parent" in child) child.parent = null;
  },

  insertBefore: insertBefore,
  insertInContainerBefore(
    container: HostContainer,
    child: HostInstance | HostTextInstance,
    before: HostInstance | HostTextInstance,
  ): void {
    const idx = container.children.indexOf(before);
    if (idx >= 0) {
      container.children.splice(idx, 0, child);
    } else {
      container.children.push(child);
    }
    if ("parent" in child) child.parent = null;
    // Notify custom element lifecycle: mount
    if ("type" in child && child.type !== "TEXT_NODE" && !BUILTIN_TYPES.has(child.type) && _onCustomElementMount) {
      _onCustomElementMount(child.type, child);
    }
  },

  clearContainer(container: HostContainer): void {
    container.children.length = 0;
  },

  // ── Updates ─────────────────────────────────────────────────────

  prepareUpdate(
    _instance: HostInstance,
    _type: HostType,
    oldProps: HostProps,
    newProps: HostProps,
  ): HostUpdatePayload {
    return diffProps(oldProps, newProps);
  },

  commitUpdate(
    instance: HostInstance,
    _type: HostType,
    oldProps: HostProps,
    newProps: HostProps,
  ): void {
    // React freezes props objects — never mutate, always replace
    instance.props = { ...newProps };
    // Invalidate styled-run cache for this instance (props changed — runs may differ)
    instance._cachedRunsVersion = undefined;
    instance._runsDirty = true;
    // Update hostPropsRef to point to the new props object
    const ref = newProps["_hostPropsRef"] as { current: unknown } | undefined;
    if (ref) ref.current = instance.props;
    // Sync layout-relevant props only if any layout prop actually changed
    if (instance.layoutNode) {
      const layoutKeys = [
        "width", "height", "flex", "flexGrow", "flexShrink", "flexBasis",
        "flexDirection", "flexWrap", "padding", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight",
        "paddingX", "paddingY",
        "margin", "marginTop", "marginBottom", "marginLeft", "marginRight",
        "marginX", "marginY",
        "gap", "columnGap", "rowGap", "alignItems", "alignSelf", "justifyContent",
        "overflow", "overflowX", "overflowY", "display", "position",
        "minWidth", "minHeight", "maxWidth", "maxHeight",
        "borderStyle", "borderTop", "borderBottom", "borderLeft", "borderRight",
        "top", "left", "right", "bottom",
        "aspectRatio", "order",
      ];
      let layoutChanged = false;
      for (const k of layoutKeys) {
        if (oldProps[k] !== newProps[k]) { layoutChanged = true; break; }
      }
      if (layoutChanged) {
        // IMPORTANT: Replace the entire props object (don't mutate in place).
        // buildLayoutTree detects changes via reference equality
        // (node._prevProps !== node.props). If we mutate the same object,
        // the dirty check fails and computeLayout skips re-layout, using
        // stale cached positions. Replacing the object ensures the
        // reference changes and the node is correctly marked dirty.
        // This also removes any old keys that are no longer present
        // (e.g., switching from flex:1 to height:100).
        instance.layoutNode.props = extractLayoutProps(instance.type as any, newProps);
      }
    }
  },

  commitTextUpdate(
    textInstance: HostTextInstance,
    _oldText: string,
    newText: string,
  ): void {
    // The text setter already propagates _runsDirty up through all
    // tui-text ancestors, so no extra marking needed here.
    textInstance.text = newText;
  },

  // ── Commit lifecycle ────────────────────────────────────────────

  prepareForCommit(): null {
    return null;
  },

  resetAfterCommit(container: HostContainer): void {
    // THIS is where the magic happens:
    // React is done mutating the tree → trigger layout + paint + diff
    container.onCommit();
  },

  // ── Misc ────────────────────────────────────────────────────────

  finalizeInitialChildren(): boolean {
    return false;
  },

  getPublicInstance(instance: HostInstance): HostInstance {
    return instance;
  },

  getRootHostContext(): HostContext {
    return {};
  },

  getChildHostContext(parentContext: HostContext): HostContext {
    return parentContext;
  },

  shouldSetTextContent(): boolean {
    return false;
  },

  preparePortalMount(): void {
    // no-op
  },

  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,

  getCurrentEventPriority(): number {
    return DefaultEventPriority;
  },

  getInstanceFromNode(): null {
    return null;
  },

  prepareScopeUpdate(): void {
    // no-op
  },

  getInstanceFromScope(): null {
    return null;
  },

  beforeActiveInstanceBlur(): void {
    // no-op
  },

  afterActiveInstanceBlur(): void {
    // no-op
  },

  detachDeletedInstance(): void {
    // no-op
  },

  requestPostPaintCallback(): void {
    // no-op
  },

  maySuspendCommit(): boolean {
    return false;
  },

  preloadInstance(): boolean {
    return true;
  },

  startSuspendingCommit(): void {
    // no-op
  },

  suspendInstance(): void {
    // no-op
  },

  waitForCommitToBeReady(): null {
    return null;
  },

  NotPendingTransition: null as null,

  resetFormInstance(): void {
    // no-op
  },

  setCurrentUpdatePriority(): void {
    // no-op
  },

  getCurrentUpdatePriority(): number {
    return DefaultEventPriority;
  },

  resolveUpdatePriority(): number {
    return DefaultEventPriority;
  },
};
