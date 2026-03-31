#!/usr/bin/env node
/**
 * Fast launcher for pre-built templates (no tsx compilation).
 * Usage: node examples/launch.mjs review
 */
import React from "react";
import { render } from "../dist/reconciler/render.js";
import { CodeReview } from "../dist/templates/showcase/CodeReview.js";
import { FinancialDashboard } from "../dist/templates/showcase/FinancialDashboard.js";
import { SystemDashboard } from "../dist/templates/showcase/SystemDashboard.js";
import { AgentChat } from "../dist/templates/showcase/AgentChat.js";
import { ProjectManager } from "../dist/templates/showcase/ProjectManager.js";

const TEMPLATES = {
  review: () => React.createElement(CodeReview, { title: "Code Review" }),
  finance: () => React.createElement(FinancialDashboard, { title: "STORM TERMINAL" }),
  monitor: () => React.createElement(SystemDashboard, { title: "SYSTEM MONITOR" }),
  agent: () => React.createElement(AgentChat, { title: "Agent Chat" }),
  project: () => React.createElement(ProjectManager, { title: "PROJECT HQ" }),
};

const name = process.argv[2]?.toLowerCase();
if (!name || !TEMPLATES[name]) {
  console.log("Usage: node examples/launch.mjs <review|finance|monitor|agent|project>");
  process.exit(0);
}

const app = render(TEMPLATES[name](), { alternateScreen: true, mouse: true });
process.on("SIGINT", () => { app.unmount(); process.exit(0); });
