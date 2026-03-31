/**
 * Storm Code CLI -- Type definitions.
 */

// -- Message Types ------------------------------------------------------------

export type MessageType =
  | "user"
  | "assistant"
  | "thinking"
  | "tool_call"
  | "system";

export interface ToolCall {
  /** Tool name: Read, Edit, Bash, etc. */
  name: string;
  /** Arguments string (NO parens), e.g. "src/auth/session.ts" */
  args: string;
  /** Full output text from the tool */
  output: string;
  /** Number of lines in full output */
  totalLines: number;
  /** Whether the output is currently expanded */
  expanded: boolean;
  /** Whether this is an error result */
  isError: boolean;
}

export interface Message {
  id: number;
  type: MessageType;
  content: string;
  timestamp: number;
  /** For thinking messages: duration in seconds */
  thinkingDuration?: number;
  /** Whether thinking is expanded (Ctrl+O) */
  thinkingExpanded?: boolean;
  /** For tool_call messages */
  toolCall?: ToolCall;
}
