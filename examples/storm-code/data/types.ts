/**
 * Storm Code CLI — Type definitions.
 */

// ── Message Types ──────────────────────────────────────────────────────

export type MessageType =
  | "user"
  | "assistant"
  | "thinking"
  | "function_call"
  | "function_return"
  | "memory_op"
  | "system";

export interface Message {
  id: number;
  type: MessageType;
  content: string;
  timestamp: number;
  /** Tool name for function_call messages. */
  toolName?: string;
  /** Tool parameters for function_call messages. */
  toolParams?: Record<string, unknown>;
  /** Memory operation type: core_memory_append, core_memory_replace, archival_memory_insert, etc. */
  memoryAction?: string;
  /** Risk level for tool approval. */
  riskLevel?: "low" | "medium" | "high";
}

// ── Session Types ──────────────────────────────────────────────────────

export interface Session {
  id: string;
  label: string;
  createdAt: string;
  messageCount: number;
}

// ── Slash Command Types ────────────────────────────────────────────────

export type SlashCommandCategory = "memory" | "tools" | "session" | "system" | "debug";

export interface SlashCommand {
  name: string;
  description: string;
  category: SlashCommandCategory;
  handler: (args: string) => string;
}
