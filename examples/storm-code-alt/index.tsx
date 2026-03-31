#!/usr/bin/env npx tsx
/**
 * Storm Code CLI -- Entry point.
 *
 * An AI coding assistant interface built with Storm TUI.
 * Features tool calls (Read/Edit/Bash), streaming responses, approval prompts,
 * and the Storm Code visual design.
 *
 * Usage: npx tsx examples/storm-code/index.tsx
 */

import React from "react";
import { render } from "../../src/index.js";
import { App } from "./App.js";

const app = render(<App />);
await app.waitUntilExit();
