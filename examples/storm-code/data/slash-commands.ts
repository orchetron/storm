/**
 * Storm Code CLI — Slash command registry.
 */

import type { SlashCommand } from "./types.js";

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "/compact",
    description: "Compact conversation history to save context",
    category: "memory",
    handler: () => "Compacted conversation: 24 messages -> 8 summary messages. Saved 3,200 tokens.",
  },
  {
    name: "/memory",
    description: "Show current memory usage and entries",
    category: "memory",
    handler: () =>
      "Memory:\n" +
      "  Conversation: 24 messages (8,550 tokens)\n" +
      "  Pinned: 2 messages\n" +
      "  Compacted: 0 times",
  },
  {
    name: "/model",
    description: "Show or switch the current model",
    category: "tools",
    handler: (args) =>
      args
        ? `Switched model to: ${args}`
        : "Current model: demo-coder\nAvailable: demo-coder, demo-small, demo-chat, demo-model",
  },
  {
    name: "/new",
    description: "Create a new conversation session",
    category: "session",
    handler: () => "Created new session. Conversation history cleared.",
  },
  {
    name: "/rename",
    description: "Rename the current session",
    category: "session",
    handler: (args) =>
      args ? `Session renamed to: "${args}"` : "Usage: /rename <new name>",
  },
  {
    name: "/context",
    description: "Show context window usage",
    category: "system",
    handler: () =>
      "Context Window:\n" +
      "  Used: 12,450 / 128,000 tokens (9.7%)\n" +
      "  System: 2,100 tokens\n" +
      "  History: 8,550 tokens\n" +
      "  Tools: 1,800 tokens",
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
      "  /compact   — Compact conversation\n" +
      "  /memory    — Show memory usage\n" +
      "  /model     — Show/switch model\n" +
      "  /context   — Context window usage\n" +
      "  /clear     — Clear screen\n" +
      "  /cost      — Show cost breakdown\n" +
      "  /doctor    — Run diagnostics\n" +
      "  /help      — This message\n" +
      "  /exit      — Exit",
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
    name: "/doctor",
    description: "Run diagnostics on environment health",
    category: "debug",
    handler: () =>
      "Diagnostics:\n" +
      "  Model: OK (demo-coder, connected)\n" +
      "  Tools: OK (8 tools registered)\n" +
      "  Context: OK (9.7% used)\n" +
      "  Latency: 142ms avg\n" +
      "  Status: Healthy",
  },
  {
    name: "/allowed-tools",
    description: "Show auto-approved tools",
    category: "tools",
    handler: () =>
      "Auto-approved tools:\n" +
      "  read_file  — Always allowed\n" +
      "  grep       — Always allowed\n" +
      "  bash       — Requires approval\n" +
      "  edit_file  — Requires approval",
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
      "  Estimated cost: $0.44",
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
