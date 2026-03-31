#!/usr/bin/env npx tsx
/**
 * Storm TUI Showcase Runner
 *
 * Component galleries + world-class app templates.
 * Usage: npx tsx examples/run-showcase.ts <name>
 */

import React from "react";
import { render } from "../src/reconciler/render.js";

// Component galleries
import { ShowcasePrimitives } from "../src/templates/showcase/ShowcasePrimitives.js";
import { ShowcaseInput } from "../src/templates/showcase/ShowcaseInput.js";
import { ShowcaseSelection } from "../src/templates/showcase/ShowcaseSelection.js";
import { ShowcaseData } from "../src/templates/showcase/ShowcaseData.js";
import { ShowcaseFeedback } from "../src/templates/showcase/ShowcaseFeedback.js";
import { ShowcaseLayout } from "../src/templates/showcase/ShowcaseLayout.js";
import { ShowcaseVisual } from "../src/templates/showcase/ShowcaseVisual.js";
import { ShowcaseAdvanced } from "../src/templates/showcase/ShowcaseAdvanced.js";
import { ShowcaseAI } from "../src/templates/showcase/ShowcaseAI.js";
import { ShowcaseChat } from "../src/templates/showcase/ShowcaseChat.js";
import { ShowcaseRichContent } from "../src/templates/showcase/ShowcaseRichContent.js";

// App templates
import { FinancialDashboard } from "../src/templates/showcase/FinancialDashboard.js";
import { SystemDashboard } from "../src/templates/showcase/SystemDashboard.js";
import { AgentChat } from "../src/templates/showcase/AgentChat.js";
import { ProjectManager } from "../src/templates/showcase/ProjectManager.js";
import { CodeReview } from "../src/templates/showcase/CodeReview.js";

const TEMPLATES: Record<string, () => React.ReactElement> = {
  // Component galleries
  primitives: () => React.createElement(ShowcasePrimitives, { title: "Core Primitives" }),
  input: () => React.createElement(ShowcaseInput, { title: "Input Controls" }),
  selection: () => React.createElement(ShowcaseSelection, { title: "Selection & Navigation" }),
  data: () => React.createElement(ShowcaseData, { title: "Data Display" }),
  feedback: () => React.createElement(ShowcaseFeedback, { title: "Feedback & Status" }),
  layout: () => React.createElement(ShowcaseLayout, { title: "Layout & Structure" }),
  visual: () => React.createElement(ShowcaseVisual, { title: "Visual Effects" }),
  advanced: () => React.createElement(ShowcaseAdvanced, { title: "Advanced Components" }),
  ai: () => React.createElement(ShowcaseAI, { title: "AI-Native Widgets" }),
  chat: () => React.createElement(ShowcaseChat, { title: "Chat & Content Widgets" }),
  rich: () => React.createElement(ShowcaseRichContent, { title: "Rich Content" }),

  // App templates
  finance: () => React.createElement(FinancialDashboard, { title: "STORM TERMINAL" }),
  monitor: () => React.createElement(SystemDashboard, { title: "SYSTEM MONITOR" }),
  agent: () => React.createElement(AgentChat, { title: "Agent Chat" }),
  project: () => React.createElement(ProjectManager, { title: "PROJECT HQ" }),
  review: () => React.createElement(CodeReview, { title: "Code Review" }),
};

const name = process.argv[2]?.toLowerCase();

if (!name || !TEMPLATES[name]) {
  console.log("\n  \x1b[1m⚡ Storm TUI Showcase Runner\x1b[0m\n");

  console.log("  \x1b[2mComponent Galleries\x1b[0m");
  console.log("    primitives  — Text, Badge, Tag, Avatar, Breadcrumb");
  console.log("    input       — TextInput, Form, Calendar, Checkbox, Switch");
  console.log("    selection   — Select, Menu, Tabs, Stepper, Paginator");
  console.log("    data        — Table, DataGrid, Tree, Sparkline, Pretty");
  console.log("    feedback    — Spinner, ProgressBar, Gauge, Toast, Timer");
  console.log("    layout      — ScrollView, Modal, Accordion, Card, Shadow");
  console.log("    visual      — Gradient, GlowText, Digits, Image, Separator");
  console.log("    advanced    — VirtualList, DirectoryTree, FilePicker, RichLog");
  console.log("    ai          — TokenStream, CostTracker, OperationTree, PerformanceHUD");
  console.log("    chat        — MarkdownText, SyntaxHighlight, MessageBubble");
  console.log("    rich        — Images, Markdown, TypeScript + Python code");

  console.log("\n  \x1b[1mApp Templates\x1b[0m  \x1b[2m(world-class demos)\x1b[0m");
  console.log("    \x1b[33mfinance\x1b[0m     — Bloomberg-style trading terminal  \x1b[2m(gold/amber)\x1b[0m");
  console.log("    \x1b[36mmonitor\x1b[0m     — Grafana-style system dashboard    \x1b[2m(cyan/blue)\x1b[0m");
  console.log("    \x1b[35magent\x1b[0m       — Advanced AI chat + debug panes   \x1b[2m(violet/mint)\x1b[0m");
  console.log("    \x1b[32mproject\x1b[0m     — Kanban board + timeline + settings \x1b[2m(teal/emerald)\x1b[0m");
  console.log("    \x1b[31mreview\x1b[0m      — Terminal code review tool         \x1b[2m(orange/coral)\x1b[0m");

  console.log("\n  \x1b[2mUsage: npx tsx examples/run-showcase.ts <name>\x1b[0m\n");
  process.exit(0);
}

const app = render(TEMPLATES[name]!());

process.on("SIGINT", () => {
  app.unmount();
  process.exit(0);
});
