#!/usr/bin/env npx tsx
/**
 * Storm Ops — AI Operations Center.
 *
 * Multi-agent operations dashboard with real-time resource monitoring,
 * event logging, diff tracking, cost analysis, and governance oversight.
 *
 * Usage: npx tsx examples/storm-ops/index.tsx
 */

import React from "react";
import { render } from "../../src/index.js";
import { App } from "./App.js";

const app = render(<App />);
await app.waitUntilExit();
