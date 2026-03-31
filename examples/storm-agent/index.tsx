#!/usr/bin/env npx tsx
/**
 * Storm Agent CLI — Entry point.
 *
 * An AI agent chat interface built with Storm TUI.
 * Features persistent memory, tool approval, slash commands, and streaming responses.
 *
 * Usage: npx tsx examples/storm-agent/index.tsx
 */

import React from "react";
import { render } from "../../src/index.js";
import { App } from "./App.js";

const app = render(<App />);
await app.waitUntilExit();
