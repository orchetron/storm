/**
 * Compact Mode Plugin — reduces padding and sizes for space-constrained UIs.
 *
 * Applies smaller defaults to Modal, Card, and Button components.
 */

import type { StormPlugin } from "../core/plugin.js";

export const compactModePlugin: StormPlugin = {
  name: "compact-mode",
  componentDefaults: {
    Modal: { size: "sm" },
    Card: { padding: 0 },
    Button: { size: "sm" },
  },
};
