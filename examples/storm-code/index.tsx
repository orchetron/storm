#!/usr/bin/env npx tsx
/**
 * Storm Code CLI — Entry point.
 *
 * A coding assistant chat interface built with Storm TUI.
 * Features tool approval, slash commands, and streaming responses.
 *
 * Usage: npx tsx examples/storm-code/index.tsx
 */

import React from "react";
import { render } from "../../src/index.js";
import { App } from "./App.js";

const app = render(<App />);
await app.waitUntilExit();
