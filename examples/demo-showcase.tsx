#!/usr/bin/env npx tsx
/**
 * storm showcase -- full-featured AI coding agent demo.
 *
 * Demonstrates Storm TUI widgets in a 3-panel layout:
 *   Sessions (left) | Chat (center) | Activity (right)
 *   Input bar + powerline StatusLine at bottom.
 *
 * Components showcased:
 *   DiffView, MessageBubble, ApprovalPrompt, StatusLine (powerline),
 *   ContextWindow, CostTracker (manual compact), OperationTree,
 *   Button, Badge, Toast, Collapsible, StreamingText, Spinner.
 *
 * Ctrl+C to exit.
 */

import React, { useState, useCallback, useRef } from "react";

import {
  render,
  Box,
  Text,
  ScrollView,
  ChatInput,
  Spinner,
  Separator,
  Collapsible,
  OperationTree,
  StreamingText,
  DiffView,
  Badge,
  Button,
  Toast,
  useInput,
  useTerminal,
  useTui,
  useInterval,
  // Widgets
  MessageBubble,
  ApprovalPrompt,
  StatusLine,
  ContextWindow,
} from "../src/index.js";

import type { OpNode, ToastItem } from "../src/index.js";
import { colors } from "../src/theme/colors.js";
import { fmtNum, fmtCost } from "../src/utils/format.js";

// ── Types ──────────────────────────────────────────────────────────────

interface Session {
  id: number;
  label: string;
  icon: string;
  active: boolean;
  unread: number;
}

// ── Sessions ────────────────────────────────────────────────────────────

const SESSIONS: Session[] = [
  { id: 1, label: "Auth fixes", icon: "\u{1F512}", active: true, unread: 0 },
  { id: 2, label: "Perf tuning", icon: "\u26A1", active: false, unread: 3 },
  { id: 3, label: "API design", icon: "\u25C6", active: false, unread: 0 },
  { id: 4, label: "DB migration", icon: "\u2584", active: false, unread: 12 },
  { id: 5, label: "Deploy fix", icon: "\u25B2", active: false, unread: 1 },
];

// ── Multi-file unified diff ──────────────────────────────────────────

const SESSION_DIFF = `diff --git a/src/auth/session.ts b/src/auth/session.ts
index 7a3f2c1..e8b4d9a 100644
--- a/src/auth/session.ts
+++ b/src/auth/session.ts
@@ -14,10 +14,14 @@ import { Store } from '../store';
 import { createSub } from './sub';

 export function useSession(
   key: string,
   store: Store
 ) {
   useEffect(() => {
-    store.subscribe(key, cb);
+    const unsub = store.subscribe(key, cb);
+    return () => unsub();
   }, [key]);
+
+  // Invalidate stale entries on reconnect
+  useEffect(() => {
+    const cleanup = store.onReconnect(() => store.invalidate(key));
+    return () => cleanup();
+  }, [key, store]);
 }
diff --git a/src/auth/rateLimit.ts b/src/auth/rateLimit.ts
index 3e1c8a0..f9d2b17 100644
--- a/src/auth/rateLimit.ts
+++ b/src/auth/rateLimit.ts
@@ -49,9 +49,15 @@ export class RateLimiter {
   private windowMs: number;
   private maxRequests: number;

-  check(req: Request): boolean {
-    const ip = req.headers["x-forwarded-for"];
-    return this.limiter.consume(ip);
+  check(req: Request): RateLimitResult {
+    // Use socket address, not spoofable header
+    const ip = req.socket.remoteAddress ?? "unknown";
+    const result = this.limiter.consume(ip);
+    if (!result.allowed) {
+      this.audit.log("rate_limit_exceeded", { ip, windowMs: this.windowMs });
+    }
+    return result;
   }
 }
diff --git a/src/auth/tokenRefresh.ts b/src/auth/tokenRefresh.ts
index 1a2b3c4..d5e6f78 100644
--- a/src/auth/tokenRefresh.ts
+++ b/src/auth/tokenRefresh.ts
@@ -22,7 +22,12 @@ export async function refreshToken(
   token: string,
   store: TokenStore
 ): Promise<TokenResult> {
-  const newToken = await store.refresh(token);
-  return { token: newToken };
+  try {
+    const newToken = await store.refresh(token);
+    return { token: newToken, refreshedAt: Date.now() };
+  } catch (err) {
+    await store.invalidate(token);
+    throw new TokenRefreshError("Refresh failed", { cause: err });
+  }
 }`;

// ── Activity operations ────────────────────────────────────────────────

function makeOperations(phase: number): OpNode[] {
  const ops: OpNode[][] = [
    [
      { id: "scan", label: "Scanning codebase (847 files)", status: "completed", durationMs: 1240 },
      { id: "index", label: "Building search index", status: "completed", durationMs: 890 },
      { id: "analyze", label: "Static analysis", status: "completed", durationMs: 2100 },
      { id: "read1", label: "Reading src/auth/session.ts", status: "running" },
      { id: "read2", label: "Reading src/auth/rateLimit.ts", status: "pending" },
      { id: "plan", label: "Planning changes", status: "pending" },
      { id: "apply", label: "Applying patches (3 files)", status: "pending" },
    ],
    [
      { id: "scan", label: "Scanning codebase (847 files)", status: "completed", durationMs: 1240 },
      { id: "index", label: "Building search index", status: "completed", durationMs: 890 },
      { id: "analyze", label: "Static analysis", status: "completed", durationMs: 2100 },
      { id: "read1", label: "Reading src/auth/session.ts", status: "completed", durationMs: 340 },
      { id: "read2", label: "Reading src/auth/rateLimit.ts", status: "completed", durationMs: 280 },
      { id: "plan", label: "Planning changes", status: "running" },
      { id: "apply", label: "Applying patches (3 files)", status: "pending" },
    ],
    [
      { id: "scan", label: "Scanning codebase (847 files)", status: "completed", durationMs: 1240 },
      { id: "index", label: "Building search index", status: "completed", durationMs: 890 },
      { id: "analyze", label: "Static analysis", status: "completed", durationMs: 2100 },
      { id: "read1", label: "Reading src/auth/session.ts", status: "completed", durationMs: 340 },
      { id: "read2", label: "Reading src/auth/rateLimit.ts", status: "completed", durationMs: 280 },
      { id: "plan", label: "Planning changes", status: "completed", durationMs: 560 },
      { id: "apply", label: "Applying patches (3 files)", status: "running" },
    ],
    [
      { id: "scan", label: "Scanning codebase (847 files)", status: "completed", durationMs: 1240 },
      { id: "index", label: "Building search index", status: "completed", durationMs: 890 },
      { id: "analyze", label: "Static analysis", status: "completed", durationMs: 2100 },
      { id: "read1", label: "Reading src/auth/session.ts", status: "completed", durationMs: 340 },
      { id: "read2", label: "Reading src/auth/rateLimit.ts", status: "completed", durationMs: 280 },
      { id: "plan", label: "Planning changes", status: "completed", durationMs: 560 },
      { id: "apply", label: "Applying patches (3 files)", status: "completed", durationMs: 1830 },
    ],
  ];
  return ops[phase % ops.length]!;
}

// ── Thinking text ──────────────────────────────────────────────────────

const THINKING_TEXT =
  "Scanning 847 files for useEffect hooks... Found 23 subscription patterns. " +
  "19 have proper cleanup returns. 4 are missing \u2014 the store.subscribe in " +
  "session.ts line 22 leaks ~2KB per navigation. The rateLimit.ts trusts " +
  "X-Forwarded-For without validation (CVE-2024-XXXX). tokenRefresh.ts has " +
  "no error handling on network timeout. Preparing 3-file patch.";

const ASSISTANT_MARKDOWN =
  "I found **3 issues** in the auth module:\n\n" +
  "1. **Memory leak** in `session.ts` \u2014 `store.subscribe()` never unsubscribed on unmount\n" +
  "2. **IP spoofing vulnerability** in `rateLimit.ts` \u2014 trusts `X-Forwarded-For` header\n" +
  "3. **Missing error handling** in `tokenRefresh.ts` \u2014 network timeout kills the session\n\n" +
  "Here are the fixes across all 3 files:";

// ── Files data ──────────────────────────────────────────────────────────

interface FileEntry {
  path: string;
  dir: string;
  name: string;
  status: string;
  added: number;
  removed: number;
}

const FILES: FileEntry[] = [
  { path: "src/auth/session.ts", dir: "src/auth/", name: "session.ts", status: "M", added: 4, removed: 1 },
  { path: "src/auth/rateLimit.ts", dir: "src/auth/", name: "rateLimit.ts", status: "M", added: 9, removed: 3 },
  { path: "src/auth/tokenRefresh.ts", dir: "src/auth/", name: "tokenRefresh.ts", status: "M", added: 5, removed: 2 },
];

// ── Banner ──────────────────────────────────────────────────────────────

const STORM_LOGO = [
  "        \u28E0\u28FE\u28FF\u28FF\u28FF\u28F7\u2844        ",
  "      \u28F4\u28FF\u28FF\u287F\u2809\u2809\u28BF\u28FF\u28FF\u28E6      ",
  "    \u28F0\u28FF\u28FF\u280F\u2800    \u2808\u283B\u28FF\u28FF\u28C6    ",
  "   \u28FC\u28FF\u287F\u2800  \u26A1 storm  \u2808\u28BF\u28FF\u28A7   ",
  "  \u28FE\u28FF\u279F        \u2809\u2809    \u28BB\u28FF\u28F7  ",
  "  \u28FF\u28FF\u2847   cell-diff \u00B7   \u28F8\u28FF\u28FF  ",
  "  \u28FF\u28FF\u2847   zero-flicker   \u28F8\u28FF\u28FF  ",
  "  \u28BB\u28FF\u28F7\u28C0    18K FPS    \u28C0\u28FE\u28FF\u279F  ",
  "   \u28BB\u28FF\u28FF\u28E6\u28C0        \u28C0\u28F4\u28FF\u28FF\u279F   ",
  "    \u2819\u28FF\u28FF\u28FF\u28F6\u28E4\u28C0\u28C0\u28E4\u28F6\u28FF\u28FF\u28FF\u280B    ",
  "      \u2819\u28BF\u28FF\u28FF\u28FF\u28FF\u28FF\u28FF\u287F\u280B      ",
  "        \u2808\u2809\u2819\u283B\u283B\u2809\u2809\u2808        ",
];

const SHIMMER_COLORS = ["#332200", "#554400", "#886600", "#BB8800", "#FFB800", "#FFD54F", "#FFB800", "#BB8800"];

function Banner({ width, frame }: { width: number; frame: number }) {
  const padLeft = Math.max(0, Math.floor((width - 34) / 2));
  const pad = " ".repeat(padLeft);
  const colorIdx = frame % SHIMMER_COLORS.length;

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      {STORM_LOGO.map((line, i) => {
        const c = SHIMMER_COLORS[(colorIdx + i) % SHIMMER_COLORS.length]!;
        return (
          <Box key={i} flexDirection="row">
            <Text color={c}>{pad}{line}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

// ── Sessions Panel ──────────────────────────────────────────────────────

function SessionsPanel({
  sessions,
  activeSession,
  height,
  focused,
}: {
  sessions: Session[];
  activeSession: number;
  height: number;
  focused: boolean;
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={focused ? colors.brand.primary : colors.divider}
      height={height}
      overflow="hidden"
    >
      <Box height={1} paddingX={1}>
        <Text bold color={focused ? colors.brand.primary : colors.text.secondary} wrap="truncate">Sessions</Text>
        <Box flex={1} />
        <Text color={colors.text.dim}>{sessions.length}</Text>
      </Box>
      <Separator style="line" color={colors.divider} />

      <Box flexDirection="column" paddingX={1} flex={1} overflow="hidden">
        {sessions.map((s) => {
          const isActive = s.id === activeSession;
          return (
            <Box key={s.id} height={1} flexDirection="row">
              <Text color={isActive ? colors.brand.primary : colors.text.dim}>
                {isActive ? "\u25CF " : "  "}
              </Text>
              <Text
                bold={isActive}
                color={isActive ? colors.text.primary : colors.text.secondary}
              >
                {"#"}{s.id}{" "}
              </Text>
              <Text color={isActive ? colors.text.dim : colors.text.disabled}>{s.icon} </Text>
              <Text
                color={isActive ? colors.text.primary : colors.text.dim}
                wrap="truncate"
              >
                {s.label}
              </Text>
              <Box flex={1} />
              {s.unread > 0 && !isActive ? (
                <Badge label="unread" mode="count" count={s.unread} variant="warning" />
              ) : null}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ── Chat Header ─────────────────────────────────────────────────────────

function ChatHeader({ width, isStreaming }: { width: number; isStreaming: boolean }) {
  return (
    <Box height={1} flexDirection="row" paddingX={1} width={width} backgroundColor={colors.surface.raised}>
      {isStreaming ? (
        <Spinner type="flywheel" color={colors.brand.primary} />
      ) : (
        <Text bold color={colors.brand.primary}>{"\u28FF"}</Text>
      )}
      <Text bold color={colors.brand.primary}>{" storm"}</Text>
      <Text bold color={colors.text.primary}>{" agent"}</Text>
      <Text color={colors.text.dim}>{" \u00B7 "}</Text>
      <Text color={colors.text.dim}>{"\u25C6 qwen-2.5-72b"}</Text>
      <Box flex={1} />
      <Text color={colors.success}>{"\u25CF "}</Text>
      <Text color={colors.text.secondary}>connected</Text>
    </Box>
  );
}

// ── Files Panel Section ─────────────────────────────────────────────────

function FilesSection({ files }: { files: FileEntry[] }) {
  // Group by directory
  const dirs = new Map<string, FileEntry[]>();
  for (const f of files) {
    const list = dirs.get(f.dir) ?? [];
    list.push(f);
    dirs.set(f.dir, list);
  }

  return (
    <Box flexDirection="column" overflow="hidden">
      {Array.from(dirs.entries()).map(([dir, entries]) => (
        <Box key={dir} flexDirection="column" overflow="hidden">
          <Box height={1} flexDirection="row" overflow="hidden">
            <Text bold color={colors.text.secondary} wrap="truncate">{dir}</Text>
          </Box>
          {entries.map((f, i) => {
            const isLast = i === entries.length - 1;
            const connector = isLast ? "\u2514\u2500" : "\u251C\u2500";
            return (
              <Box key={f.path} height={1} flexDirection="row" overflow="hidden">
                <Text color={colors.text.disabled}>{" "}{connector}{" "}</Text>
                <Text color={colors.text.primary} wrap="truncate">{f.name}</Text>
                <Box flex={1} />
                <Text color={colors.warning} wrap="truncate">{f.status}</Text>
                <Text color={colors.diff.added} wrap="truncate">{" +"}{f.added}</Text>
                <Text color={colors.diff.removed} wrap="truncate">{" -"}{f.removed}</Text>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

// ── Activity Panel (RIGHT) ──────────────────────────────────────────────

function ActivityPanel({
  height,
  ops,
  inputTokens,
  outputTokens,
  tokenHistory,
}: {
  height: number;
  ops: OpNode[];
  inputTokens: number;
  outputTokens: number;
  tokenHistory: number[];
}) {
  const totalCost = ((inputTokens / 1_000_000) * 15) + ((outputTokens / 1_000_000) * 75);

  // Bottom stats section: 4 rows (Input, Output, Cost, Context bar)
  const STATS_HEIGHT = 4;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.divider}
      height={height}
      overflow="hidden"
    >
      {/* Panel title */}
      <Box height={1} paddingX={1} overflow="hidden">
        <Text bold color={colors.text.secondary} wrap="truncate">Activity</Text>
        <Box flex={1} />
        <Badge label="live" mode="dot" variant="success" />
      </Box>
      <Separator style="line" color={colors.divider} />

      {/* Top section: Files + Operations split equally */}
      <Box flex={1} flexDirection="column" overflow="hidden">
        {/* Files — takes half the available space */}
        <Box flex={1} flexDirection="column" paddingX={1} overflow="hidden">
          <Box height={1} overflow="hidden">
            <Text bold color={colors.text.secondary} wrap="truncate">Files</Text>
          </Box>
          <ScrollView flex={1} scrollSpeed={1}>
            <FilesSection files={FILES} />
          </ScrollView>
        </Box>

        <Separator style="line" color={colors.divider} />

        {/* Operations — takes the other half */}
        <Box flex={1} flexDirection="column" paddingX={1} overflow="hidden">
          <Box height={1} overflow="hidden">
            <Text bold color={colors.text.secondary} wrap="truncate">Operations</Text>
          </Box>
          <ScrollView flex={1} scrollSpeed={1}>
            <OperationTree nodes={ops} showDuration={true} />
          </ScrollView>
        </Box>
      </Box>

      {/* Bottom section: fixed stats (flexShrink=0) */}
      <Separator style="line" color={colors.divider} />
      <Box flexDirection="column" paddingX={1} overflow="hidden" flexShrink={0} height={STATS_HEIGHT}>
        {/* Input tokens */}
        <Box height={1} flexDirection="row" overflow="hidden">
          <Text color={colors.text.secondary} wrap="truncate">Input</Text>
          <Box flex={1} />
          <Text bold color={colors.text.primary} wrap="truncate">{fmtNum(inputTokens)} tok</Text>
        </Box>
        {/* Output tokens */}
        <Box height={1} flexDirection="row" overflow="hidden">
          <Text color={colors.text.secondary} wrap="truncate">Output</Text>
          <Box flex={1} />
          <Text bold color={colors.text.primary} wrap="truncate">{fmtNum(outputTokens)} tok</Text>
        </Box>
        {/* Cost */}
        <Box height={1} flexDirection="row" overflow="hidden">
          <Text color={colors.text.secondary} wrap="truncate">Cost</Text>
          <Box flex={1} />
          <Text bold color={totalCost >= 1 ? colors.error : totalCost >= 0.1 ? colors.warning : colors.success} wrap="truncate">
            {fmtCost(totalCost)}
          </Text>
        </Box>
        {/* Context window */}
        <Box height={1} flexDirection="row" overflow="hidden">
          <Text color={colors.text.secondary} wrap="truncate">Context </Text>
          <ContextWindow
            used={inputTokens + outputTokens}
            limit={1000000}
            compact={true}
            barWidth={12}
          />
        </Box>
      </Box>
    </Box>
  );
}

// ── Input Bar ───────────────────────────────────────────────────────────

function InputBar({
  input,
  setInput,
  onSubmit,
  historyList,
  availableWidth,
  focus,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (v: string) => void;
  historyList: string[];
  availableWidth: number;
  focus: boolean;
}) {
  const wrapWidth = Math.max(10, availableWidth - 6);
  return (
    <Box borderStyle="round" borderColor={colors.brand.glow} flexDirection="row" paddingX={1}>
      <Text color={colors.brand.primary} bold>{"\u276F "}</Text>
      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={onSubmit}
        placeholder="Type a message..."
        placeholderColor={colors.text.dim}
        color={colors.text.primary}
        history={historyList}
        flex={1}
        maxRows={4}
        width={wrapWidth}
        focus={focus}
      />
    </Box>
  );
}

// ── Main App ────────────────────────────────────────────────────────────

function App() {
  const { width, height, exit } = useTerminal();
  const { flushSync } = useTui();

  // ── State ──────────────────────────────────────────────────────────
  const [activeSession, setActiveSession] = useState(1);
  const [focusPanel, setFocusPanel] = useState<"sessions" | "chat">("chat");
  const [showSessions, setShowSessions] = useState(true);
  const [showActivity, setShowActivity] = useState(true);

  const [input, setInput] = useState("");
  const [historyList, setHistoryList] = useState<string[]>([]);
  const [userMessages, setUserMessages] = useState<{ role: "user" | "assistant"; content: string; streaming?: boolean }[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [bannerFrame, setBannerFrame] = useState(0);
  const [showBanner, setShowBanner] = useState(true);
  const [opPhase, setOpPhase] = useState(3);
  const [inputTokens, setInputTokens] = useState(12400);
  const [outputTokens, setOutputTokens] = useState(3200);
  const [tokenHistory] = useState([2100, 4800, 7200, 9500, 11800, 12400, 15600]);

  // Demo: banner → idle. User sends message → thinking → response → diff → approval
  const [phase, setPhase] = useState<"banner" | "idle" | "thinking" | "responding" | "done">("banner");
  const [thinkingText, setThinkingText] = useState("");
  const [responseText, setResponseText] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [approvalVisible, setApprovalVisible] = useState(false);

  // Toast state
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);

  function addToast(message: string, type: "info" | "success" | "warning" | "error" = "success") {
    const id = String(++toastIdRef.current);
    flushSync(() => {
      setToasts((prev) => [...prev, { id, message, type, durationMs: 4000 }]);
    });
  }

  function removeToast(id: string) {
    flushSync(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    });
  }

  // ── Banner animation ──────────────────────────────────────────────
  useInterval(() => {
    if (showBanner) flushSync(() => setBannerFrame((f) => f + 1));
  }, 200);

  // Auto-dismiss banner → idle (waiting for user input)
  useInterval(() => {
    if (showBanner && bannerFrame > 25) {
      flushSync(() => {
        setShowBanner(false);
        setPhase("idle");
      });
    }
  }, 100);

  // ── Thinking word-by-word stream ─────────────────────────────────
  const thinkingWordsRef = useRef(THINKING_TEXT.split(" "));
  const thinkingIdxRef = useRef(0);

  useInterval(() => {
    if (phase !== "thinking") return;
    const words = thinkingWordsRef.current;
    thinkingIdxRef.current += 2;
    if (thinkingIdxRef.current >= words.length) {
      flushSync(() => {
        setThinkingText(words.join(" "));
        setPhase("responding");
      });
    } else {
      flushSync(() => {
        setThinkingText(words.slice(0, thinkingIdxRef.current).join(" "));
      });
    }
  }, 40);

  // ── Response word-by-word stream ─────────────────────────────────
  const responseWordsRef = useRef(ASSISTANT_MARKDOWN.split(" "));
  const responseIdxRef = useRef(0);

  useInterval(() => {
    if (phase !== "responding") return;
    const words = responseWordsRef.current;
    responseIdxRef.current += 1;
    if (responseIdxRef.current >= words.length) {
      flushSync(() => {
        setResponseText(words.join(" "));
        setIsStreaming(false);
        setShowDiff(true);
        setApprovalVisible(true);
        setPhase("done");
      });
    } else {
      flushSync(() => {
        setIsStreaming(true);
        setResponseText(words.slice(0, responseIdxRef.current).join(" "));
      });
    }
  }, 50);

  // Cycle operations during thinking/responding
  useInterval(() => {
    if (phase === "thinking" || phase === "responding") {
      flushSync(() => setOpPhase((p) => p + 1));
    }
  }, 800);

  // ── Global shortcuts ──────────────────────────────────────────────
  useInput(
    useCallback(
      (e) => {
        if (e.key === "c" && e.ctrl) exit();
        if (e.char === "[") {
          flushSync(() => setShowSessions((p) => !p));
          return;
        }
        if (e.char === "]") {
          flushSync(() => setShowActivity((p) => !p));
          return;
        }
        if (e.key === "tab") {
          flushSync(() =>
            setFocusPanel((prev) => prev === "sessions" ? "chat" : "sessions"),
          );
          return;
        }
        if (focusPanel === "sessions") {
          if (e.key === "up") {
            flushSync(() => setActiveSession((prev) => Math.max(1, prev - 1)));
            return;
          }
          if (e.key === "down") {
            flushSync(() => setActiveSession((prev) => Math.min(SESSIONS.length, prev + 1)));
            return;
          }
        }
      },
      [exit, flushSync, focusPanel],
    ),
  );

  // ── Streaming simulation (for user-submitted messages) ───────────
  const SIMULATED_RESPONSES = [
    "I'll take a look at that. Scanning the codebase for relevant files... Found 12 matches. The issue appears to be in the event handler registration. I've prepared a fix that properly cleans up listeners on unmount.",
    "Good question. After analyzing the module structure, I can see three potential improvements: better error boundaries, proper memoization of the callback, and a cleanup function for the subscription. Let me apply those changes.",
    "I've reviewed the configuration and found the root cause. The timeout value was set too low for production workloads. I've updated it to use an adaptive strategy based on request complexity.",
  ];
  let simResponseIdx = useRef(0);

  const simulateResponse = useCallback(() => {
    const responseText = SIMULATED_RESPONSES[simResponseIdx.current % SIMULATED_RESPONSES.length]!;
    simResponseIdx.current++;
    const words = responseText.split(" ");
    let wordIndex = 0;

    flushSync(() => {
      setUserMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", streaming: true },
      ]);
      setIsStreaming(true);
    });

    const streamInterval = setInterval(() => {
      wordIndex++;
      if (wordIndex >= words.length) {
        clearInterval(streamInterval);
        flushSync(() => {
          setUserMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1]!;
            updated[updated.length - 1] = {
              ...last,
              content: words.join(" "),
              streaming: false,
            };
            return updated;
          });
          setIsStreaming(false);
          setOutputTokens((t) => t + 380 + Math.floor(Math.random() * 600));
        });
        return;
      }
      flushSync(() => {
        setUserMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1]!;
          updated[updated.length - 1] = {
            ...last,
            content: words.slice(0, wordIndex).join(" "),
          };
          return updated;
        });
      });
    }, 30 + Math.random() * 40);
  }, [flushSync]);

  // ── Submit handler ────────────────────────────────────────────────
  const firstSubmitRef = useRef(true);
  const [showcaseUserMsg, setShowcaseUserMsg] = useState("");
  const handleSubmit = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;
      flushSync(() => {
        setHistoryList((prev) => [...prev, text]);
        setInput("");
        setInputTokens((t) => t + text.split(" ").length * 4);
        setFocusPanel("chat");
      });

      if (firstSubmitRef.current) {
        // First message: store separately for showcase flow (thinking → response → diff)
        firstSubmitRef.current = false;
        flushSync(() => {
          setShowcaseUserMsg(text);
          setOpPhase(0);
          setPhase("thinking");
        });
      } else {
        // Subsequent messages: add to userMessages and simulate response
        flushSync(() => {
          setUserMessages((prev) => [...prev, { role: "user", content: text }]);
        });
        setTimeout(simulateResponse, 300 + Math.random() * 400);
      }
    },
    [flushSync, isStreaming, simulateResponse],
  );

  // ── Approval handler ──────────────────────────────────────────────
  const handleApproval = useCallback(
    (key: string) => {
      if (key === "y") {
        addToast("Changes applied to 3 files", "success");
        flushSync(() => {
          setApprovalVisible(false);
          setOutputTokens((t) => t + 800);
        });
      } else if (key === "n") {
        addToast("Changes rejected", "warning");
        flushSync(() => {
          setApprovalVisible(false);
        });
      } else if (key === "a") {
        addToast("Changes applied \u2014 auto-approve enabled for this session", "info");
        flushSync(() => {
          setApprovalVisible(false);
          setOutputTokens((t) => t + 800);
        });
      }
    },
    [flushSync],
  );

  // ── Layout calculations ───────────────────────────────────────────
  const sessionsPanelWidth = Math.max(18, Math.floor(width * 0.15));
  const activityPanelWidth = Math.max(30, Math.floor(width * 0.26));
  const effectiveSessionsWidth = showSessions ? sessionsPanelWidth : 0;
  const effectiveActivityWidth = showActivity ? activityPanelWidth : 0;
  const chatWidth = width - effectiveSessionsWidth - effectiveActivityWidth;
  const ops = makeOperations(opPhase);
  const panelHeight = height - 6;

  // Powerline status segments
  const totalCost = ((inputTokens / 1_000_000) * 15) + ((outputTokens / 1_000_000) * 75);
  const statusSegments = [
    { text: "\u28FF storm", color: "#FFFFFF", bg: colors.brand.primary },
    { text: "qwen-2.5-72b", color: "#FFFFFF", bg: "#334155" },
    { text: `${((inputTokens + outputTokens) / 1000).toFixed(1)}K tokens`, color: "#FFFFFF", bg: "#475569" },
    { text: `$${totalCost.toFixed(4)}`, color: "#FFFFFF", bg: "#1E293B" },
    { text: "Tab:focus  [:sessions  ]:activity  C-c:exit", color: colors.text.disabled },
  ];

  const pastBanner = phase !== "banner";
  const showThinking = phase === "thinking" || phase === "responding" || phase === "done";
  const showResponse = phase === "responding" || phase === "done";

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* ── Top header bar ─────────────────────────────────────────── */}
      <ChatHeader width={width} isStreaming={isStreaming} />

      {/* ── 3-panel main content ───────────────────────────────────── */}
      <Box flex={1} flexDirection="row">
        {/* Left: Sessions panel */}
        {showSessions ? (
          <Box width={sessionsPanelWidth} overflow="hidden">
            <SessionsPanel
              sessions={SESSIONS}
              activeSession={activeSession}
              height={panelHeight}
              focused={focusPanel === "sessions"}
            />
          </Box>
        ) : null}

        {/* Center: Chat */}
        <Box flex={1} flexDirection="column" overflow="hidden">
          <ScrollView flex={1} scrollSpeed={3} stickToBottom={true}>
            <Box flexDirection="column" gap={1} paddingY={1}>
              {/* Banner */}
              {showBanner ? <Banner width={chatWidth} frame={bannerFrame} /> : null}

              {/* System message */}
              {pastBanner ? (
                <Box justifyContent="center">
                  <Text italic color={colors.text.dim}>{"    "}Session started {"\u00B7"} qwen-2.5-72b {"\u00B7"} 128K context</Text>
                </Box>
              ) : null}

              {/* Showcase: user's first message (rendered once, before thinking) */}
              {showcaseUserMsg ? (
                <MessageBubble role="user">
                  {showcaseUserMsg}
                </MessageBubble>
              ) : null}

              {/* Thinking collapsible — streams word by word */}
              {showThinking ? (
                <Box paddingLeft={2}>
                  <Collapsible
                    title={phase === "thinking" ? "Thinking..." : "Thought for 4.2s"}
                    expanded={phase === "thinking"}
                    color={colors.text.dim}
                  >
                    <Box flexDirection="row" gap={1} paddingLeft={1}>
                      {phase === "thinking" ? (
                        <Spinner type="flywheel" color={colors.text.dim} />
                      ) : null}
                      <Text dim italic color={colors.text.dim}>{thinkingText}</Text>
                    </Box>
                  </Collapsible>
                </Box>
              ) : null}

              {/* Assistant response — streams word by word */}
              {showResponse ? (
                <MessageBubble
                  role="assistant"
                  markdown={phase === "done"}
                  meta={phase === "done" ? "4.2s \u00B7 3,200 tokens" : undefined}
                  timestamp={phase === "done" ? "12:34" : undefined}
                >
                  {phase === "responding" ? (
                    <StreamingText text={responseText} streaming={true} color={colors.text.primary} />
                  ) : (
                    ASSISTANT_MARKDOWN
                  )}
                </MessageBubble>
              ) : null}

              {/* DiffView showing multi-file changes */}
              {showDiff ? (
                <Box paddingLeft={4} paddingRight={2} flexDirection="column" gap={1} overflow="hidden">
                  <DiffView
                    diff={SESSION_DIFF}
                    showLineNumbers={true}
                    wordDiff={true}
                    contextLines={3}
                    width={Math.max(30, chatWidth - 8)}
                  />
                </Box>
              ) : null}

              {/* ApprovalPrompt with risk + timeout */}
              {approvalVisible ? (
                <Box paddingLeft={2}>
                  <ApprovalPrompt
                    tool="Edit (3 files)"
                    risk="medium"
                    params={{
                      files: "session.ts, rateLimit.ts, tokenRefresh.ts",
                      additions: 18,
                      deletions: 5,
                    }}
                    onSelect={handleApproval}
                    timeout={30000}
                  />
                </Box>
              ) : null}

              {/* User-submitted messages + streamed responses */}
              {userMessages.map((msg, i) => (
                <MessageBubble key={`msg-${i}`} role={msg.role} markdown={msg.role === "assistant"}>
                  {msg.streaming ? (
                    <StreamingText text={msg.content} streaming={true} color={colors.text.primary} />
                  ) : (
                    msg.content
                  )}
                </MessageBubble>
              ))}
            </Box>
          </ScrollView>
        </Box>

        {/* Right: Activity panel */}
        {showActivity ? (
          <Box width={activityPanelWidth} overflow="hidden">
            <ActivityPanel
              height={panelHeight}
              ops={ops}
              inputTokens={inputTokens}
              outputTokens={outputTokens}
              tokenHistory={tokenHistory}
            />
          </Box>
        ) : null}
      </Box>

      {/* ── Separator above input ──────────────────────────────────── */}
      <Separator style="line" color={colors.divider} width={width} />

      {/* ── Full-width input bar ───────────────────────────────────── */}
      <InputBar
        input={input}
        setInput={(v: string) => { flushSync(() => setInput(v)); }}
        onSubmit={handleSubmit}
        historyList={historyList}
        availableWidth={width}
        focus={focusPanel === "chat"}
      />

      {/* ── Powerline StatusLine ───────────────────────────────────── */}
      <StatusLine segments={statusSegments} />

      {/* ── Toast notifications ────────────────────────────────────── */}
      {toasts.length > 0 ? (
        <Box flexDirection="column" paddingX={2}>
          {toasts.map((t) => (
            <Toast
              key={t.id}
              message={t.message}
              type={t.type}
              visible={true}
              durationMs={t.durationMs}
              onDismiss={() => removeToast(t.id)}
              animated={true}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

// ── Entry ──────────────────────────────────────────────────────────────

const app = render(<App />);
await app.waitUntilExit();
