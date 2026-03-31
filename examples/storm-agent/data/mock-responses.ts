/**
 * Storm Agent CLI — Mock response templates.
 *
 * Each response is a sequence of steps the simulator will execute.
 */

export type StepKind = "thinking" | "memory_op" | "function_call" | "function_return" | "response";

export interface ResponseStep {
  kind: StepKind;
  content: string;
  /** For memory_op: the action type. */
  memoryAction?: string;
  /** For function_call: tool name. */
  toolName?: string;
  /** For function_call: tool parameters. */
  toolParams?: Record<string, unknown>;
  /** For function_call: risk level. */
  riskLevel?: "low" | "medium" | "high";
}

export interface ResponseTemplate {
  /** Keywords that match user input to this template. */
  keywords: string[];
  steps: ResponseStep[];
}

export const RESPONSE_TEMPLATES: ResponseTemplate[] = [
  // ── Greeting ─────────────────────────────────────────────────────────
  {
    keywords: ["hello", "hi", "hey", "howdy", "greetings"],
    steps: [
      {
        kind: "thinking",
        content:
          "The user is greeting me. I should respond warmly and let them know what I can help with. " +
          "Let me also check if I have any stored context about them from my core memory.",
      },
      {
        kind: "memory_op",
        content: "Retrieving core memory: human section",
        memoryAction: "core_memory_get",
      },
      {
        kind: "response",
        content:
          "Hello! I'm your Agent with persistent memory. I remember our previous conversations " +
          "and can learn new things about you over time. How can I help you today?\n\n" +
          "Some things I can do:\n" +
          "- Answer questions and have conversations\n" +
          "- Read and analyze files in your project\n" +
          "- Remember important context for future sessions\n" +
          "- Execute tools with your approval",
      },
    ],
  },

  // ── Code Help ────────────────────────────────────────────────────────
  {
    keywords: ["code", "function", "implement", "write", "typescript", "javascript"],
    steps: [
      {
        kind: "thinking",
        content:
          "The user wants help with code. Let me think about what they need. " +
          "I should check my archival memory for any project-specific conventions " +
          "they've mentioned before, like TypeScript preferences or coding patterns.",
      },
      {
        kind: "memory_op",
        content: "Searching archival memory for coding conventions",
        memoryAction: "archival_memory_search",
      },
      {
        kind: "response",
        content:
          "I'd be happy to help with code! Based on what I remember about your project:\n\n" +
          "- You prefer **TypeScript** with ESM imports (`.js` extensions)\n" +
          "- You use `exactOptionalPropertyTypes`, so optional fields need conditional spread\n" +
          "- Error handling uses `Result<T, E>` monads over exceptions\n\n" +
          "Could you share more details about what you'd like me to implement? " +
          "I can also read files from your project to understand the existing patterns.",
      },
    ],
  },

  // ── File Reading ─────────────────────────────────────────────────────
  {
    keywords: ["read", "file", "open", "show", "cat", "look at"],
    steps: [
      {
        kind: "thinking",
        content:
          "The user wants me to read a file. I need to use the file read tool. " +
          "Let me parse the path from their message and request approval since " +
          "file operations require user consent.",
      },
      {
        kind: "function_call",
        content: "Reading file from project",
        toolName: "read_file",
        toolParams: { path: "src/index.ts", encoding: "utf-8" },
        riskLevel: "low",
      },
      {
        kind: "function_return",
        content:
          '```typescript\nexport { render } from "./reconciler/render.js";\n' +
          'export { Box } from "./components/Box.js";\n' +
          'export { Text } from "./components/Text.js";\n' +
          "// ... 200+ more exports\n```",
      },
      {
        kind: "response",
        content:
          "Here's what I found in `src/index.ts`. It's the main barrel export file with 200+ symbols organized into sections:\n\n" +
          "- **Core**: Cell, Style, ScreenBuffer, DiffRenderer\n" +
          "- **Components**: Box, Text, ScrollView, TextInput, ChatInput, etc.\n" +
          "- **Widgets**: MessageBubble, StatusLine, ApprovalPrompt\n" +
          "- **Hooks**: useInput, useTerminal, useTui, useInterval\n\n" +
          "Would you like me to look at any specific section in detail?",
      },
    ],
  },

  // ── Memory Operations ────────────────────────────────────────────────
  {
    keywords: ["remember", "memory", "save", "store", "note", "forget"],
    steps: [
      {
        kind: "thinking",
        content:
          "The user wants me to update my memory. I should determine whether this goes " +
          "into core memory (persona/human sections) or archival memory (long-term storage). " +
          "Core memory is for fundamental context; archival is for specific facts.",
      },
      {
        kind: "memory_op",
        content: "Updating core memory: human section with new context",
        memoryAction: "core_memory_append",
      },
      {
        kind: "memory_op",
        content: "Inserting into archival memory for long-term recall",
        memoryAction: "archival_memory_insert",
      },
      {
        kind: "response",
        content:
          "Got it! I've updated my memory:\n\n" +
          "- **Core memory** (human section): Updated with your new context\n" +
          "- **Archival memory**: Stored the specific details for long-term recall\n\n" +
          "I'll remember this in future conversations. You can check what I remember " +
          "anytime with `/memory`.",
      },
    ],
  },

  // ── General Questions ────────────────────────────────────────────────
  {
    keywords: ["what", "how", "why", "explain", "tell", "describe"],
    steps: [
      {
        kind: "thinking",
        content:
          "The user is asking a question. Let me formulate a thorough response. " +
          "I should draw on my knowledge and any relevant archival memories. " +
          "I'll structure my answer clearly with context.",
      },
      {
        kind: "response",
        content:
          "That's a great question. Let me break it down:\n\n" +
          "The key concept here is that **persistent memory** changes how AI agents work. " +
          "Instead of starting fresh each conversation, agents like me maintain:\n\n" +
          "1. **Core memory** — My identity (persona) and what I know about you (human)\n" +
          "2. **Archival memory** — Long-term facts and details I've learned\n" +
          "3. **Recall memory** — Recent conversation context\n\n" +
          "This means I can build up understanding over time, remember your preferences, " +
          "and provide increasingly personalized assistance.\n\n" +
          "Would you like me to go deeper into any of these areas?",
      },
    ],
  },

  // ── Error Handling ───────────────────────────────────────────────────
  {
    keywords: ["error", "bug", "fix", "crash", "broken", "fail", "issue"],
    steps: [
      {
        kind: "thinking",
        content:
          "The user is dealing with an error or bug. I need to understand the issue, " +
          "check relevant files, and suggest a fix. Let me start by reading the file " +
          "where the error might originate.",
      },
      {
        kind: "function_call",
        content: "Searching codebase for error patterns",
        toolName: "search_files",
        toolParams: { query: "error|throw|catch", path: "src/", regex: true },
        riskLevel: "low",
      },
      {
        kind: "function_return",
        content: "Found 47 matches across 12 files. Top results:\n- src/core/guards.ts:23\n- src/reconciler/render.ts:89\n- src/input/manager.ts:156",
      },
      {
        kind: "function_call",
        content: "Reading the most relevant file",
        toolName: "read_file",
        toolParams: { path: "src/core/guards.ts" },
        riskLevel: "low",
      },
      {
        kind: "function_return",
        content: "```typescript\nif (depth > MAX_LAYOUT_DEPTH) {\n  throw new LayoutOverflowError(`Layout depth ${depth} exceeds maximum ${MAX_LAYOUT_DEPTH}`);\n}\n```",
      },
      {
        kind: "response",
        content:
          "I found the issue. Here's my analysis:\n\n" +
          "**Root cause**: The error is coming from a guard check that's triggering unexpectedly.\n\n" +
          "**Fix**: There are two approaches:\n" +
          "1. **Guard adjustment** — Increase the limit if your layout legitimately needs deeper nesting\n" +
          "2. **Layout flattening** — Restructure the component tree to reduce depth\n\n" +
          "I'd recommend option 2 since deep nesting usually indicates a structural issue. " +
          "Want me to help refactor the component?",
      },
    ],
  },

  // ── Tool Execution ───────────────────────────────────────────────────
  {
    keywords: ["run", "execute", "terminal", "command", "shell", "bash"],
    steps: [
      {
        kind: "thinking",
        content:
          "The user wants to execute a command. This requires tool approval since " +
          "shell commands can modify the system. I should explain what I'm about to " +
          "do and request explicit permission.",
      },
      {
        kind: "function_call",
        content: "Executing shell command",
        toolName: "run_command",
        toolParams: { command: "ls -la src/", cwd: "." },
        riskLevel: "medium",
      },
      {
        kind: "function_return",
        content:
          "total 48\ndrwxr-xr-x  12 user  staff   384 Mar 28 10:00 .\n" +
          "-rw-r--r--   1 user  staff  8234 Mar 28 09:55 index.ts\n" +
          "drwxr-xr-x   8 user  staff   256 Mar 28 09:50 components/\n" +
          "drwxr-xr-x   4 user  staff   128 Mar 28 09:50 core/",
      },
      {
        kind: "response",
        content:
          "Command completed successfully. Here's the directory listing:\n\n" +
          "The `src/` directory contains:\n" +
          "- `index.ts` — Main barrel export (8.2KB)\n" +
          "- `components/` — UI component implementations\n" +
          "- `core/` — Core rendering engine (buffer, diff, screen)\n\n" +
          "What would you like to do next?",
      },
    ],
  },

  // ── Project Overview ─────────────────────────────────────────────────
  {
    keywords: ["project", "overview", "architecture", "structure", "about"],
    steps: [
      {
        kind: "thinking",
        content:
          "The user wants a project overview. Let me check my archival memory for " +
          "stored project knowledge and combine it with a quick scan of the project structure.",
      },
      {
        kind: "memory_op",
        content: "Searching archival memory for project architecture notes",
        memoryAction: "archival_memory_search",
      },
      {
        kind: "function_call",
        content: "Scanning project structure",
        toolName: "list_directory",
        toolParams: { path: ".", recursive: false },
        riskLevel: "low",
      },
      {
        kind: "function_return",
        content: "packages/core/, packages/storm-tui/, packages/cli/, docs/, scripts/",
      },
      {
        kind: "response",
        content:
          "Here's your project at a glance:\n\n" +
          "**Orchetron Fabric** — A monorepo with three main packages:\n\n" +
          "| Package | Purpose | Stats |\n" +
          "|---------|---------|-------|\n" +
          "| `core` | 11 swappable planes, governance algebra | 5,499 tests |\n" +
          "| `storm-tui` | Terminal UI framework (cell-diff rendering) | 18K FPS |\n" +
          "| `cli` | AI coding agent CLI | In progress |\n\n" +
          "**Key Architecture**: 11 swappable planes with governance algebra (23+ combinators), " +
          "branded types (31 phantom-branded IDs), and Result<T, E> monads.\n\n" +
          "Want me to dive deeper into any area?",
      },
    ],
  },
];

/**
 * Find the best matching response template for user input.
 * Returns the default (general questions) if no keywords match.
 */
export function findResponseTemplate(input: string): ResponseTemplate {
  const lower = input.toLowerCase();
  let bestMatch: ResponseTemplate | undefined;
  let bestScore = 0;

  for (const template of RESPONSE_TEMPLATES) {
    let score = 0;
    for (const kw of template.keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
    }
  }

  // Fall back to general questions template
  return bestMatch ?? RESPONSE_TEMPLATES[4]!;
}
