/**
 * Storm Agent CLI — Type definitions.
 */

// ── Agent Types ────────────────────────────────────────────────────────

export interface CoreMemory {
  /** The agent's own persona/identity description. */
  persona: string;
  /** What the agent knows about the current user. */
  human: string;
}

export interface AgentMemory {
  core: CoreMemory;
  /** Long-term archival memory entries. */
  archival: string[];
  /** Recalled context entries (short-term working memory). */
  recall: string[];
}

export interface Agent {
  id: string;
  name: string;
  model: string;
  persona: string;
  memory: AgentMemory;
  createdAt: string;
  systemPrompt: string;
}

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
  agentId: string;
  label: string;
  createdAt: string;
  messageCount: number;
}

// ── Slash Command Types ────────────────────────────────────────────────

export type SlashCommandCategory = "memory" | "agent" | "session" | "system" | "debug";

export interface SlashCommand {
  name: string;
  description: string;
  category: SlashCommandCategory;
  handler: (args: string) => string;
}
