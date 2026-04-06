/**
 * Auto-Scroll Plugin — vim-style scroll navigation shortcuts.
 *
 * Adds Shift+G (go to bottom) and gg (go to top) key bindings that
 * apply to all ScrollView instances via the focus system. Uses a key
 * sequence tracker for the double-g chord.
 */

import type { StormPlugin } from "../core/plugin.js";
import type { KeyEvent } from "../input/types.js";

export const autoScrollPlugin: StormPlugin = {
  name: "auto-scroll",

  setup({ renderContext }) {
    // gg chord state — track whether we're waiting for the second 'g'
    let waitingForSecondG = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;
    const CHORD_TIMEOUT_MS = 500;

    function resetChord(): void {
      waitingForSecondG = false;
      if (gTimer !== null) {
        clearTimeout(gTimer);
        gTimer = null;
      }
    }

    /** Find the active scroll entry via the focus manager. */
    function getActiveScrollEntry() {
      const activeId = renderContext.focus.activeScrollId;
      if (activeId) {
        return renderContext.focus.entries.get(activeId);
      }
      // Fallback: find the first scroll entry
      for (const entry of renderContext.focus.entries.values()) {
        if (entry.type === "scroll") return entry;
      }
      return undefined;
    }

    this.onKey = (event: KeyEvent): KeyEvent | null => {
      // Shift+G → scroll to bottom
      if (event.key === "G" && event.shift && !event.ctrl && !event.meta) {
        resetChord();
        const entry = getActiveScrollEntry();
        entry?.onScroll?.(Infinity);
        return null; // consume the event
      }

      // gg chord → scroll to top
      if (event.key === "g" && !event.shift && !event.ctrl && !event.meta) {
        if (waitingForSecondG) {
          // Second 'g' — scroll to top
          resetChord();
          const entry = getActiveScrollEntry();
          entry?.onScroll?.(-Infinity);
          return null; // consume
        } else {
          // First 'g' — start waiting for the second
          waitingForSecondG = true;
          gTimer = setTimeout(resetChord, CHORD_TIMEOUT_MS);
          return null; // consume (we'll release on timeout if no second g)
        }
      }

      // Any other key cancels the gg chord
      resetChord();
      return event;
    };
  },

  cleanup() {
    // onKey is cleaned up by the plugin manager
  },
};
