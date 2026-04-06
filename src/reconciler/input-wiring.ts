/**
 * Wires mouse scroll to hit-tested ScrollViews, Tab/Shift+Tab to focus cycling,
 * and double Ctrl+C to force-exit. Registered once at app startup, disposed on unmount.
 */

import type { InputManager } from "../input/manager.js";
import type { RenderContext } from "../core/render-context.js";
import type { PluginManager } from "../core/plugin.js";
import type { Screen } from "../core/screen.js";

export class InputWiring {
  private readonly unsubScroll: () => void;
  private readonly unsubTab: () => void;
  private readonly unsubCtrlC: () => void;
  private lastCtrlC = 0;

  constructor(
    private readonly input: InputManager,
    private readonly screen: Screen,
    private readonly renderCtx: RenderContext,
    private readonly pluginManager: PluginManager,
  ) {
    // ── Scroll: 1:1 pass-through ────────────────────────────────────
    // Each event = 1 line. Speed matches finger speed.
    this.unsubScroll = input.onMouse((event) => {
      const processed = pluginManager.processMouse(event);
      if (!processed) return;
      if (processed.button === "scroll-up" || processed.button === "scroll-down") {
        const target = renderCtx.focus.hitTestScroll(processed.x, processed.y);
        const delta = processed.button === "scroll-up" ? -1 : 1;
        if (processed.shift && target?.onHScroll) {
          target.onHScroll(delta);
        } else if (target?.onScroll) {
          target.onScroll(delta);
        }
      }
    });

    // Tab cycles focus
    this.unsubTab = input.onKey((event) => {
      const processed = pluginManager.processKey(event);
      if (!processed) return;
      if (processed.key === "tab") {
        if (processed.shift) renderCtx.focus.cyclePrev();
        else renderCtx.focus.cycleNext();
      }
    });

    // Double Ctrl+C force exits
    this.unsubCtrlC = input.onKey((event) => {
      if (event.key === "c" && event.ctrl) {
        const now = Date.now();
        if (now - this.lastCtrlC < 500) {
          input.stop();
          screen.stop();
          process.exit(0);
        }
        this.lastCtrlC = now;
      }
    });
  }

  /** Unsubscribe all input handlers. */
  dispose(): void {
    this.unsubScroll();
    this.unsubTab();
    this.unsubCtrlC();
  }
}
