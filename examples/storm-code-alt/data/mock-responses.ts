/**
 * Storm Code CLI -- Mock response templates.
 *
 * Each response is a sequence of steps the simulator will execute.
 * Steps: thinking -> tool calls (with output) -> assistant response.
 */

export type StepKind = "thinking" | "tool_call" | "response";

export interface ResponseStep {
  kind: StepKind;
  content: string;
  /** For thinking: duration in seconds */
  thinkingDuration?: number;
  /** For tool_call: tool name */
  toolName?: string;
  /** For tool_call: args string */
  toolArgs?: string;
  /** For tool_call: output lines */
  toolOutput?: string;
  /** For tool_call: total lines in output */
  toolTotalLines?: number;
  /** For tool_call: whether it errored */
  toolIsError?: boolean;
  /** For tool_call: whether it needs approval */
  needsApproval?: boolean;
}

export interface ResponseTemplate {
  keywords: string[];
  steps: ResponseStep[];
  /** Cost increment for this response */
  cost: number;
  /** Context % increment */
  contextDelta: number;
}

export const RESPONSE_TEMPLATES: ResponseTemplate[] = [
  // -- Greeting (no tools) ----------------------------------------------------
  {
    keywords: ["hello", "hi", "hey", "howdy", "greetings"],
    cost: 0.003,
    contextDelta: 2,
    steps: [
      {
        kind: "thinking",
        content:
          "The user is greeting me. I should respond helpfully and let them know what I can do.",
        thinkingDuration: 0.8,
      },
      {
        kind: "response",
        content:
          "Hello! I can help you with your codebase. Here are some things I can do:\n\n" +
          "- **Read and analyze** files in your project\n" +
          "- **Edit code** with precise diffs\n" +
          "- **Run commands** in your terminal\n" +
          "- **Answer questions** about your code\n\n" +
          "What would you like to work on?",
      },
    ],
  },

  // -- Code reading (Read tool + explanation) ---------------------------------
  {
    keywords: ["read", "show", "look", "file", "open", "cat", "view"],
    cost: 0.012,
    contextDelta: 5,
    steps: [
      {
        kind: "thinking",
        content:
          "The user wants to see a file. Let me read it and provide a summary of its contents and structure.",
        thinkingDuration: 1.2,
      },
      {
        kind: "tool_call",
        content: "",
        toolName: "Read",
        toolArgs: "src/auth/session.ts",
        toolOutput:
          `1  import { Store } from '../store';\n` +
          `2  import { createSub } from './sub';\n` +
          `3  import { SessionConfig } from './types';\n` +
          `4  \n` +
          `5  export class SessionManager {\n` +
          `6    private store: Store;\n` +
          `7    private ttl: number;\n` +
          `8  \n` +
          `9    constructor(config: SessionConfig) {\n` +
          `10   this.store = new Store(config.backend);\n` +
          `11   this.ttl = config.ttlSeconds ?? 3600;\n` +
          `12 }\n` +
          `13 \n` +
          `14   async create(userId: string): Promise<string> {\n` +
          `15     const token = crypto.randomUUID();\n` +
          `16     await this.store.set(token, { userId, createdAt: Date.now() });\n` +
          `17     return token;\n` +
          `18   }\n` +
          `19 \n` +
          `20   async validate(token: string): Promise<boolean> {\n` +
          `21     const session = await this.store.get(token);\n` +
          `22     return session !== null;\n` +
          `23   }\n` +
          `24 }`,
        toolTotalLines: 24,
      },
      {
        kind: "response",
        content:
          "This is a `SessionManager` class that handles session creation and validation.\n\n" +
          "**Key details:**\n" +
          "- Uses a `Store` backend for session persistence\n" +
          "- Sessions have a configurable TTL (default 1 hour)\n" +
          "- `create()` generates a UUID token and stores `userId` + timestamp\n" +
          "- `validate()` checks if a session token exists in the store\n\n" +
          "The implementation is straightforward but missing a few things:\n" +
          "- No TTL enforcement in `validate()` (stale sessions not expired)\n" +
          "- No `destroy()` method for logout\n" +
          "- No rate limiting on creation\n\n" +
          "Want me to add any of these?",
      },
    ],
  },

  // -- Code editing (Read + Edit with diff) -----------------------------------
  {
    keywords: ["edit", "change", "fix", "modify", "update", "refactor", "add"],
    cost: 0.024,
    contextDelta: 8,
    steps: [
      {
        kind: "thinking",
        content:
          "The user wants me to modify code. I'll need to read the file first, then apply an edit. " +
          "Let me identify the right change and produce a clean diff.",
        thinkingDuration: 2.1,
      },
      {
        kind: "tool_call",
        content: "",
        toolName: "Read",
        toolArgs: "src/auth/rateLimit.ts",
        toolOutput:
          `1  import { RateLimitConfig } from './types';\n` +
          `2  \n` +
          `3  export function checkRateLimit(req: Request, config: RateLimitConfig) {\n` +
          `4    const ip = req.headers["x-forwarded-for"];\n` +
          `5    const bucket = this.getBucket(ip);\n` +
          `6    return bucket.tokens > 0;\n` +
          `7  }`,
        toolTotalLines: 7,
      },
      {
        kind: "tool_call",
        content: "",
        toolName: "Edit",
        toolArgs: "src/auth/rateLimit.ts",
        toolOutput:
          `-  const ip = req.headers["x-forwarded-for"];\n` +
          `+  const ip = req.socket.remoteAddress ?? "unknown";\n` +
          `+  if (!ip) {\n` +
          `+    throw new Error("Cannot determine client IP");\n` +
          `+  }\n` +
          `   const bucket = this.getBucket(ip);\n` +
          `-  return bucket.tokens > 0;\n` +
          `+  if (bucket.tokens <= 0) {\n` +
          `+    throw new RateLimitExceededError(ip, bucket.resetAt);\n` +
          `+  }\n` +
          `+  bucket.tokens -= 1;\n` +
          `+  return true;`,
        toolTotalLines: 12,
        needsApproval: true,
      },
      {
        kind: "response",
        content:
          "I've made two changes to `src/auth/rateLimit.ts`:\n\n" +
          "1. **Fixed IP detection** -- Changed from `x-forwarded-for` header (which can be spoofed) to `req.socket.remoteAddress` with a fallback\n" +
          "2. **Improved rate limit logic** -- Now properly decrements tokens and throws a typed `RateLimitExceededError` instead of silently returning false\n\n" +
          "The error includes the IP and reset time so callers can generate proper 429 responses.",
      },
    ],
  },

  // -- Bash command -----------------------------------------------------------
  {
    keywords: ["run", "test", "bash", "terminal", "command", "npm", "shell", "exec"],
    cost: 0.018,
    contextDelta: 6,
    steps: [
      {
        kind: "thinking",
        content:
          "The user wants to run a command. I should execute it and show the output.",
        thinkingDuration: 0.6,
      },
      {
        kind: "tool_call",
        content: "",
        toolName: "Bash",
        toolArgs: "npm test",
        toolOutput:
          `> storm-app@1.0.0 test\n` +
          `> vitest run\n` +
          `\n` +
          ` PASS  src/__tests__/auth.test.ts (12 tests)\n` +
          ` PASS  src/__tests__/session.test.ts (8 tests)\n` +
          ` PASS  src/__tests__/rateLimit.test.ts (15 tests)\n` +
          ` FAIL  src/__tests__/store.test.ts (3 tests)\n` +
          `\n` +
          `   x store.set should persist value\n` +
          `     Expected: { userId: "u1" }\n` +
          `     Received: undefined\n` +
          `\n` +
          `Tests:  34 passed, 1 failed, 35 total\n` +
          `Time:   2.847s`,
        toolTotalLines: 14,
      },
      {
        kind: "response",
        content:
          "Tests are mostly passing (34/35), but there's one failure in `store.test.ts`:\n\n" +
          "```\nstore.set should persist value\nExpected: { userId: \"u1\" }\nReceived: undefined\n```\n\n" +
          "This looks like the `set()` method isn't actually persisting to the backend. " +
          "Likely causes:\n" +
          "- Missing `await` on an async store operation\n" +
          "- Backend not initialized in the test setup\n\n" +
          "Want me to look at the test file and fix it?",
      },
    ],
  },

  // -- Multi-tool (Read + Edit + Bash test) -----------------------------------
  {
    keywords: ["implement", "create", "build", "write", "feature", "new"],
    cost: 0.042,
    contextDelta: 12,
    steps: [
      {
        kind: "thinking",
        content:
          "The user wants me to implement something. This will require reading existing code " +
          "to understand the patterns, creating/editing files, then running tests to verify. " +
          "Let me plan the approach carefully.",
        thinkingDuration: 3.4,
      },
      {
        kind: "tool_call",
        content: "",
        toolName: "Read",
        toolArgs: "src/auth/types.ts",
        toolOutput:
          `1  export interface SessionConfig {\n` +
          `2    backend: 'memory' | 'redis';\n` +
          `3    ttlSeconds?: number;\n` +
          `4  }\n` +
          `5  \n` +
          `6  export interface RateLimitConfig {\n` +
          `7    maxRequests: number;\n` +
          `8    windowMs: number;\n` +
          `9  }`,
        toolTotalLines: 9,
      },
      {
        kind: "tool_call",
        content: "",
        toolName: "Edit",
        toolArgs: "src/auth/types.ts",
        toolOutput:
          `+\n` +
          `+export interface TokenConfig {\n` +
          `+  secret: string;\n` +
          `+  algorithm: 'HS256' | 'RS256';\n` +
          `+  expiresIn: number;\n` +
          `+}`,
        toolTotalLines: 6,
        needsApproval: true,
      },
      {
        kind: "tool_call",
        content: "",
        toolName: "Bash",
        toolArgs: "npm test -- --run src/__tests__/auth.test.ts",
        toolOutput:
          `> vitest run src/__tests__/auth.test.ts\n` +
          `\n` +
          ` PASS  src/__tests__/auth.test.ts (12 tests)\n` +
          `\n` +
          `Tests:  12 passed, 12 total\n` +
          `Time:   0.892s`,
        toolTotalLines: 6,
      },
      {
        kind: "response",
        content:
          "Done! I've added the `TokenConfig` interface to `src/auth/types.ts`. Here's what I did:\n\n" +
          "1. **Read** the existing types to understand the pattern\n" +
          "2. **Added** `TokenConfig` with `secret`, `algorithm` (HS256/RS256), and `expiresIn` fields\n" +
          "3. **Verified** existing tests still pass (12/12)\n\n" +
          "The new type follows the same conventions as `SessionConfig` and `RateLimitConfig`. " +
          "Next step would be implementing the token service that uses this config.",
      },
    ],
  },

  // -- Error case -------------------------------------------------------------
  {
    keywords: ["error", "bug", "crash", "broken", "fail", "issue", "wrong"],
    cost: 0.015,
    contextDelta: 4,
    steps: [
      {
        kind: "thinking",
        content:
          "The user is reporting an error. I need to investigate by reading relevant files and running diagnostics.",
        thinkingDuration: 1.8,
      },
      {
        kind: "tool_call",
        content: "",
        toolName: "Bash",
        toolArgs: "npm run typecheck 2>&1 | head -20",
        toolOutput:
          `src/auth/session.ts:17:5 - error TS2345: Argument of type '{ userId: string; }'\n` +
          `is not assignable to parameter of type 'SessionData'.\n` +
          `  Property 'createdAt' is missing.\n` +
          `\n` +
          `src/auth/rateLimit.ts:4:11 - error TS2339: Property 'headers' does not exist\n` +
          `on type 'Request'.\n` +
          `\n` +
          `Found 2 errors in 2 files.`,
        toolTotalLines: 8,
        toolIsError: true,
      },
      {
        kind: "response",
        content:
          "Found **2 TypeScript errors**:\n\n" +
          "1. **`session.ts:17`** -- Missing `createdAt` in the object passed to `store.set()`. " +
          "The `SessionData` type requires it but it's not being included.\n\n" +
          "2. **`rateLimit.ts:4`** -- Using `req.headers` but the `Request` type doesn't have that property. " +
          "Likely needs to be typed as `IncomingMessage` from Node's `http` module instead.\n\n" +
          "Want me to fix both of these?",
      },
    ],
  },

  // -- General question -------------------------------------------------------
  {
    keywords: ["what", "how", "why", "explain", "tell", "describe"],
    cost: 0.008,
    contextDelta: 3,
    steps: [
      {
        kind: "thinking",
        content:
          "The user is asking a question. Let me provide a clear, structured answer.",
        thinkingDuration: 1.0,
      },
      {
        kind: "response",
        content:
          "Great question! Let me break this down.\n\n" +
          "The key thing to understand is how the **request lifecycle** works:\n\n" +
          "1. Request comes in and hits the rate limiter\n" +
          "2. If allowed, it's routed to the appropriate handler\n" +
          "3. The handler validates the session token\n" +
          "4. Business logic executes within the session context\n" +
          "5. Response is sent back with appropriate headers\n\n" +
          "Each step can fail independently, and errors propagate up through the `Result<T, E>` chain " +
          "rather than throwing exceptions. This makes error handling explicit and composable.\n\n" +
          "Would you like me to show you a specific part of this flow?",
      },
    ],
  },

  // -- Architecture / project overview ----------------------------------------
  {
    keywords: ["project", "architecture", "structure", "overview", "codebase"],
    cost: 0.032,
    contextDelta: 10,
    steps: [
      {
        kind: "thinking",
        content:
          "The user wants to understand the project structure. Let me scan the directory tree " +
          "and provide a high-level overview.",
        thinkingDuration: 2.5,
      },
      {
        kind: "tool_call",
        content: "",
        toolName: "Bash",
        toolArgs: "find src -type f -name '*.ts' | head -20",
        toolOutput:
          `src/index.ts\n` +
          `src/auth/session.ts\n` +
          `src/auth/rateLimit.ts\n` +
          `src/auth/types.ts\n` +
          `src/store/index.ts\n` +
          `src/store/memory.ts\n` +
          `src/store/redis.ts\n` +
          `src/middleware/cors.ts\n` +
          `src/middleware/logger.ts\n` +
          `src/routes/api.ts\n` +
          `src/routes/health.ts\n` +
          `src/__tests__/auth.test.ts\n` +
          `src/__tests__/store.test.ts`,
        toolTotalLines: 13,
      },
      {
        kind: "tool_call",
        content: "",
        toolName: "Read",
        toolArgs: "package.json",
        toolOutput:
          `1  {\n` +
          `2    "name": "my-project",\n` +
          `3    "version": "1.0.0",\n` +
          `4    "type": "module",\n` +
          `5    "scripts": {\n` +
          `6      "dev": "tsx watch src/index.ts",\n` +
          `7      "test": "vitest run",\n` +
          `8      "typecheck": "tsc --noEmit"\n` +
          `9    }\n` +
          `10 }`,
        toolTotalLines: 10,
      },
      {
        kind: "response",
        content:
          "Here's the project structure:\n\n" +
          "```\nsrc/\n  auth/        - Session management, rate limiting\n  store/       - Data persistence (memory + Redis backends)\n  middleware/  - CORS, logging\n  routes/      - API endpoints, health checks\n  __tests__/   - Test suite\n```\n\n" +
          "**Stack:** TypeScript + ESM, vitest for testing, tsx for dev.\n\n" +
          "The architecture follows a clean layered pattern: routes -> middleware -> auth -> store. " +
          "Each layer is independently testable.\n\n" +
          "There are 13 source files and the test coverage looks like it covers auth and store modules. " +
          "Want me to analyze any specific area?",
      },
    ],
  },
];

/**
 * Find the best matching response template for user input.
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

  // Fall back to general question template
  return bestMatch ?? RESPONSE_TEMPLATES[6]!;
}
