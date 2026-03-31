/**
 * Storm Code CLI — Mock response templates.
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
  // ── Fix / Bug / Memory Leak — Multi-file edit with diffs ─────────────
  {
    keywords: ["fix", "bug", "memory leak", "leak", "broken", "crash", "error", "fail", "issue"],
    steps: [
      {
        kind: "thinking",
        content:
          "The user is reporting a bug — likely a memory leak or resource cleanup issue. " +
          "I should look at the session management and rate limiting code first, since " +
          "those are common places where subscriptions are created but never torn down. " +
          "Let me read both files and trace the lifecycle.",
      },
      {
        kind: "function_call",
        content: "Reading session manager",
        toolName: "read_file",
        toolParams: { path: "src/auth/session.ts" },
        riskLevel: "low",
      },
      {
        kind: "function_return",
        content:
          "```typescript\nimport { EventEmitter } from \"node:events\";\n" +
          "import { TokenBucket } from \"./rateLimit.js\";\n\n" +
          "export class SessionManager {\n" +
          "  private sessions = new Map<string, Session>();\n" +
          "  private emitter = new EventEmitter();\n\n" +
          "  create(userId: string, ttl: number): Session {\n" +
          "    const session: Session = {\n" +
          "      id: crypto.randomUUID(),\n" +
          "      userId,\n" +
          "      createdAt: Date.now(),\n" +
          "      expiresAt: Date.now() + ttl,\n" +
          "    };\n" +
          "    this.sessions.set(session.id, session);\n" +
          "    this.emitter.emit(\"session:created\", session);\n" +
          "    return session;\n" +
          "  }\n\n" +
          "  onExpiry(cb: (s: Session) => void): void {\n" +
          "    this.emitter.on(\"session:expired\", cb);\n" +
          "  }\n\n" +
          "  startCleanupTimer(): void {\n" +
          "    setInterval(() => {\n" +
          "      const now = Date.now();\n" +
          "      for (const [id, s] of this.sessions) {\n" +
          "        if (s.expiresAt <= now) {\n" +
          "          this.sessions.delete(id);\n" +
          "          this.emitter.emit(\"session:expired\", s);\n" +
          "        }\n" +
          "      }\n" +
          "    }, 30_000);\n" +
          "  }\n" +
          "}\n```",
      },
      {
        kind: "function_call",
        content: "Reading rate limiter",
        toolName: "read_file",
        toolParams: { path: "src/auth/rateLimit.ts" },
        riskLevel: "low",
      },
      {
        kind: "function_return",
        content:
          "```typescript\nexport class TokenBucket {\n" +
          "  private tokens: number;\n" +
          "  private timer: ReturnType<typeof setInterval> | null = null;\n\n" +
          "  constructor(\n" +
          "    private readonly capacity: number,\n" +
          "    private readonly refillRate: number,\n" +
          "  ) {\n" +
          "    this.tokens = capacity;\n" +
          "  }\n\n" +
          "  start(): void {\n" +
          "    this.timer = setInterval(() => {\n" +
          "      this.tokens = Math.min(this.capacity, this.tokens + this.refillRate);\n" +
          "    }, 1000);\n" +
          "  }\n\n" +
          "  consume(n: number): boolean {\n" +
          "    if (this.tokens >= n) {\n" +
          "      this.tokens -= n;\n" +
          "      return true;\n" +
          "    }\n" +
          "    return false;\n" +
          "  }\n" +
          "}\n```",
      },
      {
        kind: "function_call",
        content: "Fixing session.ts — adding cleanup and unsubscribe",
        toolName: "edit_file",
        toolParams: {
          path: "src/auth/session.ts",
          old_string: "  onExpiry(cb: (s: Session) => void): void {\n    this.emitter.on(\"session:expired\", cb);\n  }\n\n  startCleanupTimer(): void {\n    setInterval(() => {",
          new_string: "  onExpiry(cb: (s: Session) => void): () => void {\n    this.emitter.on(\"session:expired\", cb);\n    return () => this.emitter.off(\"session:expired\", cb);\n  }\n\n  private cleanupTimer: ReturnType<typeof setInterval> | null = null;\n\n  startCleanupTimer(): void {\n    this.cleanupTimer = setInterval(() => {",
        },
        riskLevel: "medium",
      },
      {
        kind: "function_return",
        content:
          "@@ -12,8 +12,12 @@\n" +
          "-  onExpiry(cb: (s: Session) => void): void {\n" +
          "-    this.emitter.on(\"session:expired\", cb);\n" +
          "-  }\n" +
          "+  onExpiry(cb: (s: Session) => void): () => void {\n" +
          "+    this.emitter.on(\"session:expired\", cb);\n" +
          "+    return () => this.emitter.off(\"session:expired\", cb);\n" +
          "+  }\n" +
          " \n" +
          "-  startCleanupTimer(): void {\n" +
          "-    setInterval(() => {\n" +
          "+  private cleanupTimer: ReturnType<typeof setInterval> | null = null;\n" +
          "+\n" +
          "+  startCleanupTimer(): void {\n" +
          "+    this.cleanupTimer = setInterval(() => {",
      },
      {
        kind: "function_call",
        content: "Fixing rateLimit.ts — adding stop() method",
        toolName: "edit_file",
        toolParams: {
          path: "src/auth/rateLimit.ts",
          old_string: "  consume(n: number): boolean {",
          new_string: "  stop(): void {\n    if (this.timer) {\n      clearInterval(this.timer);\n      this.timer = null;\n    }\n  }\n\n  consume(n: number): boolean {",
        },
        riskLevel: "medium",
      },
      {
        kind: "function_return",
        content:
          "@@ -15,6 +15,13 @@\n" +
          "+  stop(): void {\n" +
          "+    if (this.timer) {\n" +
          "+      clearInterval(this.timer);\n" +
          "+      this.timer = null;\n" +
          "+    }\n" +
          "+  }\n" +
          "+\n" +
          "   consume(n: number): boolean {",
      },
      {
        kind: "function_call",
        content: "Running auth tests",
        toolName: "bash",
        toolParams: { command: "npm test -- --grep auth" },
        riskLevel: "low",
      },
      {
        kind: "function_return",
        content:
          " ✓ SessionManager > creates session with valid TTL (2ms)\n" +
          " ✓ SessionManager > expires sessions after TTL (31ms)\n" +
          " ✓ SessionManager > onExpiry returns unsubscribe function (1ms)\n" +
          " ✓ TokenBucket > refills at configured rate (1002ms)\n" +
          " ✓ TokenBucket > stop() clears interval (1ms)\n\n" +
          "Test Files  2 passed (2)\n" +
          "     Tests  5 passed (5)\n" +
          "  Duration  1.4s",
      },
      {
        kind: "response",
        content:
          "Found and fixed **two memory leaks** in the auth module:\n\n" +
          "### `src/auth/session.ts`\n" +
          "- `onExpiry()` now returns an unsubscribe function so callers can remove their listener\n" +
          "- `startCleanupTimer()` stores the interval handle in `cleanupTimer` so it can be cleared on shutdown\n\n" +
          "### `src/auth/rateLimit.ts`\n" +
          "- Added `stop()` method to clear the refill interval\n" +
          "- Without this, the `TokenBucket` kept a live timer even after the bucket was no longer needed\n\n" +
          "All 5 auth tests pass. The key pattern: **every `setInterval` needs a corresponding cleanup path**, " +
          "and every `.on()` listener should offer an `.off()` return.",
      },
    ],
  },

  // ── Test / Run / Check — Bash execution ──────────────────────────────
  {
    keywords: ["test", "run", "check", "execute", "command", "shell", "bash", "terminal"],
    steps: [
      {
        kind: "thinking",
        content:
          "The user wants to run tests. I should check the package.json for the test " +
          "script first, then execute it. Vitest is the most common runner in this " +
          "project so I'll use that with verbose output.",
      },
      {
        kind: "function_call",
        content: "Running test suite",
        toolName: "bash",
        toolParams: { command: "npm test" },
        riskLevel: "medium",
      },
      {
        kind: "function_return",
        content:
          " ✓ src/core/guards.test.ts (8 tests) 12ms\n" +
          " ✓ src/reconciler/render.test.ts (14 tests) 45ms\n" +
          " ✓ src/layout/flexbox.test.ts (22 tests) 31ms\n" +
          " ✓ src/components/Box.test.ts (11 tests) 8ms\n" +
          " ✓ src/components/Text.test.ts (9 tests) 6ms\n" +
          " ✓ src/components/ScrollView.test.ts (16 tests) 28ms\n" +
          " ✓ src/input/manager.test.ts (7 tests) 14ms\n" +
          " ✓ src/auth/session.test.ts (5 tests) 1034ms\n" +
          " ✗ src/auth/rateLimit.test.ts (4 tests | 1 failed) 2011ms\n" +
          "   ✗ TokenBucket > rejects when exhausted\n" +
          "     Expected: false\n" +
          "     Received: true\n" +
          "     at rateLimit.test.ts:47:22\n\n" +
          "Test Files  8 passed | 1 failed (9)\n" +
          "     Tests  95 passed | 1 failed (96)\n" +
          "  Duration  3.8s",
      },
      {
        kind: "response",
        content:
          "**95/96 tests pass**, with one failure:\n\n" +
          "```\n✗ TokenBucket > rejects when exhausted\n  Expected: false  Received: true\n```\n\n" +
          "The `consume()` call is returning `true` when the bucket should be empty. " +
          "This is likely a timing issue — the refill interval is adding tokens between " +
          "the drain and the assertion.\n\n" +
          "**Fix**: call `bucket.stop()` before asserting, or use fake timers in the test. " +
          "Want me to patch the test?",
      },
    ],
  },

  // ── Search / Find / Where — Multi-file search ───────────────────────
  {
    keywords: ["search", "find", "where", "grep", "locate", "usage", "reference"],
    steps: [
      {
        kind: "thinking",
        content:
          "The user wants to find something in the codebase. I'll use search_files " +
          "to scan across all TypeScript files and report the matches with context.",
      },
      {
        kind: "function_call",
        content: "Searching for pattern",
        toolName: "search_files",
        toolParams: { pattern: "Result<.*,\\s*.*Error>", path: "src/", include: "*.ts" },
        riskLevel: "low",
      },
      {
        kind: "function_return",
        content:
          "src/core/result.ts:14       export type Result<T, E = Error> = Ok<T> | Err<E>;\n" +
          "src/core/result.ts:89       export function fromPromise<T>(p: Promise<T>): Promise<Result<T, Error>>\n" +
          "src/planes/governance.ts:31 evaluate(policy: Policy): Result<Decision, GovernanceError>\n" +
          "src/planes/evidence.ts:18   record(entry: AuditEntry): Result<ArtifactId, EvidenceError>\n" +
          "src/planes/memory.ts:44     recall(key: string): Result<MemorySlot, MemoryError>\n" +
          "src/planes/auth.ts:22       authorize(ctx: AuthContext): Result<Grant, AuthError>\n" +
          "src/planes/connector.ts:56  invoke(tool: ToolId, args: unknown): Result<ToolOutput, ConnectorError>\n" +
          "src/planes/storage.ts:33    get<T>(key: string): Result<T, StorageError>\n" +
          "src/planes/event.ts:29      publish(event: DomainEvent): Result<void, EventError>\n\n" +
          "9 matches across 9 files",
      },
      {
        kind: "response",
        content:
          "Found **9 usages** of `Result<T, Error>` across the codebase:\n\n" +
          "| File | Usage |\n" +
          "|------|-------|\n" +
          "| `core/result.ts` | Base type definition + `fromPromise` helper |\n" +
          "| `planes/governance.ts` | `evaluate()` returns `Result<Decision, GovernanceError>` |\n" +
          "| `planes/evidence.ts` | `record()` returns `Result<ArtifactId, EvidenceError>` |\n" +
          "| `planes/memory.ts` | `recall()` returns `Result<MemorySlot, MemoryError>` |\n" +
          "| `planes/auth.ts` | `authorize()` returns `Result<Grant, AuthError>` |\n" +
          "| `planes/connector.ts` | `invoke()` returns `Result<ToolOutput, ConnectorError>` |\n" +
          "| `planes/storage.ts` | `get()` returns `Result<T, StorageError>` |\n" +
          "| `planes/event.ts` | `publish()` returns `Result<void, EventError>` |\n\n" +
          "Every plane method returns a typed `Result` — no thrown exceptions at the plane boundary. " +
          "Want me to trace how errors propagate through a specific flow?",
      },
    ],
  },

  // ── Explain / What / How — Read + explain ────────────────────────────
  {
    keywords: ["explain", "what", "how", "why", "describe", "tell"],
    steps: [
      {
        kind: "thinking",
        content:
          "The user wants an explanation. Let me read the relevant source code so I can " +
          "give an accurate, grounded answer rather than speaking from general knowledge.",
      },
      {
        kind: "function_call",
        content: "Reading source for context",
        toolName: "read_file",
        toolParams: { path: "src/reconciler/render.ts" },
        riskLevel: "low",
      },
      {
        kind: "function_return",
        content:
          "```typescript\nimport { ScreenBuffer, Cell } from \"../core/buffer.js\";\n" +
          "import { DiffRenderer } from \"../core/diff.js\";\n" +
          "import { layoutFlexbox } from \"../layout/flexbox.js\";\n\n" +
          "export function render(rootFiber: Fiber, terminal: Terminal): void {\n" +
          "  // Phase 1: Reconcile fiber tree (React work)\n" +
          "  const tree = reconcile(rootFiber);\n\n" +
          "  // Phase 2: Layout (custom flexbox, no browser dependency)\n" +
          "  const layout = layoutFlexbox(tree, terminal.width, terminal.height);\n\n" +
          "  // Phase 3: Paint to cell buffer\n" +
          "  const buffer = new ScreenBuffer(terminal.width, terminal.height);\n" +
          "  paintToBuffer(layout, buffer);\n\n" +
          "  // Phase 4: Diff against previous frame, emit only changed cells\n" +
          "  const diff = DiffRenderer.diff(previousBuffer, buffer);\n" +
          "  terminal.write(diff.toAnsiSequence());\n" +
          "  previousBuffer = buffer;\n" +
          "}\n```",
      },
      {
        kind: "response",
        content:
          "The renderer works in **4 phases** per frame:\n\n" +
          "### Phase 1: Reconcile\n" +
          "The React reconciler walks the fiber tree and determines what changed. " +
          "This is standard React work — diffing the virtual tree.\n\n" +
          "### Phase 2: Layout\n" +
          "A custom **pure-TypeScript flexbox** engine computes positions and sizes. " +
          "No browser or yoga dependency — it handles `flex`, `padding`, `margin`, " +
          "`overflow`, and `gap` natively.\n\n" +
          "### Phase 3: Paint\n" +
          "Each node is painted into a `ScreenBuffer` — a 2D grid of `Cell` objects. " +
          "Each cell holds a character, foreground color, background color, and style flags.\n\n" +
          "### Phase 4: Diff\n" +
          "The `DiffRenderer` compares the new buffer against the previous frame cell-by-cell. " +
          "Only cells that actually changed get written to the terminal as ANSI escape sequences.\n\n" +
          "This is why Storm can hit **18K FPS** on synthetic benchmarks — " +
          "most frames only write a handful of changed cells instead of redrawing everything.",
      },
    ],
  },

  // ── Greeting ─────────────────────────────────────────────────────────
  {
    keywords: ["hello", "hi", "hey", "howdy", "greetings"],
    steps: [
      {
        kind: "thinking",
        content:
          "The user is greeting me. Let me scan the project structure to give a relevant overview.",
      },
      {
        kind: "function_call",
        content: "Scanning project",
        toolName: "bash",
        toolParams: { command: "find src/ -name '*.ts' | head -10" },
        riskLevel: "low",
      },
      {
        kind: "function_return",
        content:
          "src/index.ts\nsrc/components/Box.tsx\nsrc/components/Text.tsx\n" +
          "src/components/ScrollView.tsx\nsrc/reconciler/render.ts\n" +
          "src/core/screen.ts\nsrc/hooks/useInput.ts\n... +84 files",
      },
      {
        kind: "response",
        content:
          "Hey! I'm Storm. I've scanned your project — **91 TypeScript files** in `src/`.\n\n" +
          "Here's what I can help with:\n" +
          "- **Read & analyze** any file in the project\n" +
          "- **Edit code** with targeted replacements and diffs\n" +
          "- **Run commands** like tests, builds, linting\n" +
          "- **Search** across the codebase for patterns\n\n" +
          "Try: `fix the bug in auth` or `run the tests`",
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
          "The user wants help with code. I should understand their project structure " +
          "and conventions before writing anything. Let me check for tsconfig and existing patterns.",
      },
      {
        kind: "function_call",
        content: "Reading project configuration",
        toolName: "read_file",
        toolParams: { path: "tsconfig.json" },
        riskLevel: "low",
      },
      {
        kind: "function_return",
        content:
          '```json\n{\n  "compilerOptions": {\n    "target": "ES2022",\n' +
          '    "module": "NodeNext",\n    "exactOptionalPropertyTypes": true\n  }\n}\n```',
      },
      {
        kind: "response",
        content:
          "I can see this is a TypeScript project with ESM and `exactOptionalPropertyTypes`. " +
          "I'll follow these conventions:\n\n" +
          "- ESM imports with `.js` extensions\n" +
          "- Conditional spread for optional properties\n" +
          "- `Result<T, E>` for error handling where appropriate\n\n" +
          "What would you like me to implement?",
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
          "The user wants a project overview. Let me scan the directory structure " +
          "and summarize what I find.",
      },
      {
        kind: "function_call",
        content: "Scanning project structure",
        toolName: "bash",
        toolParams: { command: "find . -maxdepth 2 -type d | head -20" },
        riskLevel: "low",
      },
      {
        kind: "function_return",
        content: "packages/core/\npackages/storm-tui/\npackages/cli/\ndocs/\nscripts/",
      },
      {
        kind: "response",
        content:
          "Here's the project at a glance:\n\n" +
          "**Orchetron Fabric** — Monorepo with three packages:\n\n" +
          "| Package | Purpose | Stats |\n" +
          "|---------|---------|-------|\n" +
          "| `core` | 11 swappable planes, governance algebra | 5,499 tests |\n" +
          "| `storm-tui` | Terminal UI framework (cell-diff rendering) | 18K FPS |\n" +
          "| `cli` | AI coding agent CLI | In progress |\n\n" +
          "**Architecture**: 11 planes with governance algebra (23+ combinators), " +
          "31 branded types, Result<T, E> monads with 40+ operations.\n\n" +
          "What area do you want to explore?",
      },
    ],
  },

  // ── General Fallback ─────────────────────────────────────────────────
  {
    keywords: [],
    steps: [
      {
        kind: "thinking",
        content:
          "Let me analyze the request and search for relevant code to give a specific answer.",
      },
      {
        kind: "function_call",
        content: "Searching codebase",
        toolName: "search_files",
        toolParams: { pattern: "relevant code", path: "src/" },
        riskLevel: "low",
      },
      {
        kind: "function_return",
        content:
          "src/components/ChatInput.tsx:42  // relevant handler\n" +
          "src/reconciler/render.ts:118     // relevant setup\n" +
          "src/hooks/useInput.ts:21        // relevant hook",
      },
      {
        kind: "function_call",
        content: "Reading file",
        toolName: "read_file",
        toolParams: { path: "src/components/ChatInput.tsx" },
        riskLevel: "low",
      },
      {
        kind: "function_return",
        content:
          "```typescript\nexport function ChatInput(props: ChatInputProps) {\n" +
          "  const { value, onChange, onSubmit } = props;\n" +
          "  // ... 400 lines of input handling\n}\n```",
      },
      {
        kind: "response",
        content:
          "I found 3 relevant files. Here's my analysis:\n\n" +
          "- `ChatInput.tsx` handles all text input with undo/redo and selection\n" +
          "- `render.ts` manages the React reconciler lifecycle\n" +
          "- `useInput.ts` provides the keyboard event hook\n\n" +
          "Would you like me to edit any of these, or should I look deeper?",
      },
    ],
  },
];

/**
 * Find the best matching response template for user input.
 * Returns the fallback template if no keywords match.
 */
export function findResponseTemplate(input: string): ResponseTemplate {
  const lower = input.toLowerCase();
  let bestMatch: ResponseTemplate | undefined;
  let bestScore = 0;

  for (const template of RESPONSE_TEMPLATES) {
    if (template.keywords.length === 0) continue; // skip fallback during scoring
    let score = 0;
    for (const kw of template.keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
    }
  }

  // Fall back to the last template (general fallback)
  return bestMatch ?? RESPONSE_TEMPLATES[RESPONSE_TEMPLATES.length - 1]!;
}
