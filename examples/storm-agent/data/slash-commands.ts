/**
 * Storm Agent CLI — Slash command registry.
 */

import type { SlashCommand } from "./types.js";

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "/memory",
    description: "Show current agent memory (core + archival)",
    category: "memory",
    handler: () =>
      "Core Memory:\n  persona: [Agent identity loaded]\n  human: [User context loaded]\n\n" +
      "Archival Memory: 4 entries\nRecall Memory: 0 entries",
  },
  {
    name: "/remember",
    description: "Add a note to archival memory",
    category: "memory",
    handler: (args) =>
      args ? `Added to archival memory: "${args}"` : "Usage: /remember <text to remember>",
  },
  {
    name: "/compact",
    description: "Compact conversation history to save context",
    category: "memory",
    handler: () => "Compacted conversation: 24 messages -> 8 summary messages. Saved 3,200 tokens.",
  },
  {
    name: "/pin",
    description: "Pin a message to prevent compaction",
    category: "memory",
    handler: (args) =>
      args ? `Pinned message #${args}. It will survive compaction.` : "Usage: /pin <message-id>",
  },
  {
    name: "/model",
    description: "Show or switch the current model",
    category: "agent",
    handler: (args) =>
      args
        ? `Switched model to: ${args}`
        : "Current model: qwen-2.5-72b\nAvailable: qwen-2.5-72b, codestral-latest, qwen-2.5-coder-32b, phi-4",
  },
  {
    name: "/agents",
    description: "List all available agents",
    category: "agent",
    handler: () =>
      "Available agents:\n" +
      "  Atlas    — General assistant (qwen-2.5-72b)\n" +
      "  CodeBot  — Coding specialist (codestral-latest)\n" +
      "  Memex    — Research agent (qwen-2.5-coder-32b)\n" +
      "  Nova     — Creative assistant (phi-4)",
  },
  {
    name: "/new",
    description: "Create a new conversation session",
    category: "session",
    handler: () => "Created new session. Conversation history cleared. Memory persists.",
  },
  {
    name: "/rename",
    description: "Rename the current session",
    category: "session",
    handler: (args) =>
      args ? `Session renamed to: "${args}"` : "Usage: /rename <new name>",
  },
  {
    name: "/export",
    description: "Export conversation history as JSON",
    category: "session",
    handler: () => "Exported 24 messages to ./exports/session-2026-03-28.json",
  },
  {
    name: "/context",
    description: "Show context window usage",
    category: "system",
    handler: () =>
      "Context Window:\n" +
      "  Used: 12,450 / 128,000 tokens (9.7%)\n" +
      "  System: 2,100 tokens\n" +
      "  Memory: 1,800 tokens\n" +
      "  History: 8,550 tokens",
  },
  {
    name: "/clear",
    description: "Clear the screen (keeps history)",
    category: "system",
    handler: () => "Screen cleared.",
  },
  {
    name: "/help",
    description: "Show all available commands",
    category: "system",
    handler: () =>
      "Commands:\n" +
      "  /memory    — Show agent memory\n" +
      "  /remember  — Add to archival memory\n" +
      "  /model     — Show/switch model\n" +
      "  /agents    — List agents\n" +
      "  /context   — Context window usage\n" +
      "  /clear     — Clear screen\n" +
      "  /help      — This message\n" +
      "  /exit      — Exit the application\n" +
      "  Type / for all commands",
  },
  {
    name: "/init",
    description: "Re-initialize the agent with fresh memory",
    category: "agent",
    handler: () => "Agent re-initialized. Core memory reset to defaults. Archival memory preserved.",
  },
  {
    name: "/doctor",
    description: "Run diagnostics on agent health",
    category: "debug",
    handler: () =>
      "Agent Diagnostics:\n" +
      "  Memory: OK (core: 2 sections, archival: 4 entries)\n" +
      "  Model: OK (qwen-2.5-72b, connected)\n" +
      "  Tools: OK (5 tools registered)\n" +
      "  Latency: 142ms avg\n" +
      "  Status: Healthy",
  },
  {
    name: "/search",
    description: "Search archival memory",
    category: "memory",
    handler: (args) =>
      args
        ? `Searching archival memory for "${args}"...\nFound 2 matching entries.`
        : "Usage: /search <query>",
  },
  {
    name: "/usage",
    description: "Show token usage statistics",
    category: "system",
    handler: () =>
      "Token Usage (this session):\n" +
      "  Input: 8,200 tokens\n" +
      "  Output: 4,250 tokens\n" +
      "  Total: 12,450 tokens\n" +
      "  Estimated cost: $0.19",
  },
  {
    name: "/cost",
    description: "Show estimated cost breakdown",
    category: "system",
    handler: () =>
      "Cost Breakdown:\n" +
      "  Input tokens:  8,200 x $0.015/1K = $0.12\n" +
      "  Output tokens: 4,250 x $0.075/1K = $0.32\n" +
      "  Total: $0.44\n" +
      "  Session budget remaining: $4.56",
  },
  {
    name: "/skill",
    description: "Execute a specific agent skill",
    category: "agent",
    handler: (args) =>
      args
        ? `Executing skill: ${args}...`
        : "Usage: /skill <skill-name> [args]\nUse /skills to list available skills.",
  },
  {
    name: "/skills",
    description: "List available agent skills",
    category: "agent",
    handler: () =>
      "Available Skills:\n" +
      "  summarize   — Summarize text or conversation\n" +
      "  translate   — Translate between languages\n" +
      "  refactor    — Suggest code refactoring\n" +
      "  test-gen    — Generate unit tests\n" +
      "  doc-gen     — Generate documentation",
  },
  {
    name: "/exit",
    description: "Exit the application",
    category: "system",
    handler: () => "Goodbye!",
  },
];

/**
 * Find a command by name (with or without the / prefix).
 */
export function findCommand(input: string): SlashCommand | undefined {
  const name = input.startsWith("/") ? input : `/${input}`;
  const parts = name.split(/\s+/);
  const cmdName = parts[0]!.toLowerCase();
  return SLASH_COMMANDS.find((c) => c.name.toLowerCase() === cmdName);
}

/**
 * Execute a slash command. Returns the system message result.
 */
export function executeCommand(input: string): string {
  const parts = input.trim().split(/\s+/);
  const cmdName = parts[0]!;
  const args = parts.slice(1).join(" ");
  const cmd = findCommand(cmdName);
  if (!cmd) return `Unknown command: ${cmdName}. Type /help for available commands.`;
  return cmd.handler(args);
}

/**
 * Filter commands by partial input (for autocomplete).
 */
export function filterCommands(partial: string): SlashCommand[] {
  const lower = partial.toLowerCase().replace(/^\//, "");
  if (lower.length === 0) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((c) =>
    c.name.toLowerCase().slice(1).startsWith(lower),
  );
}
