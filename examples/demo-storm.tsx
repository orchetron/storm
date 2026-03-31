#!/usr/bin/env npx tsx
/**
 * demo-storm.tsx — Storm identity demo.
 *
 * Arc-lit. Precise. Diamond-prefixed.
 * A complete chat interaction showing Storm's new visual identity.
 *
 * Run: npx tsx examples/demo-storm.tsx
 */

import React, { useState, useCallback, useRef } from "react";

import {
  render,
  Box,
  Text,
  ScrollView,
  TextInput,
  useInput,
  useTerminal,
  useTui,
  useCleanup,
  useTextCycler,
  useEasedInterval,
  useCollapsibleContent,
  useInlinePrompt,
  useModeCycler,
} from "../src/index.js";

// ── Colors ───────────────────────────────────────────────────────────
// Tokyo Night inspired. Arc blue is the only accent.

const C = {
  arcBlue:  "#82AAFF",
  textPri:  "#C0CAF5",
  dim:      "#565F89",
  divider:  "#565F89",
  bg:       "#000000",
} as const;

// ── Simulated Data ───────────────────────────────────────────────────

const TOOL_OUTPUT = `import { Store } from '../store';
import { createSub } from './sub';
export function useSession(config: SessionConfig) {
  const store = new Store(config.namespace);
  const sub = createSub(store);
  let cleanup: (() => void) | null = null;
  return {
    init() {
      cleanup = sub.listen((ev) => {
        store.dispatch(ev);
      });
    },
    destroy() {
      cleanup?.();
      cleanup = null;
      store.close();
    },
    get active() {
      return cleanup !== null;
    },
  };
}`;

// ── Types ────────────────────────────────────────────────────────────

type Phase =
  | "splash"
  | "idle"
  | "thinking"
  | "response-start"
  | "tool-read"
  | "tool-approval"
  | "tool-approved"
  | "responding"
  | "done";

interface ConversationEntry {
  id: number;
  kind: "system" | "user" | "thinking" | "assistant" | "tool-call" | "tool-output" | "approval";
  text: string;
  detail?: string;
  toolContent?: string;
}

let nextId = 1;
function makeId(): number {
  return nextId++;
}

// ── Pulse Loader ─────────────────────────────────────────────────────

const PULSE_FRAMES = ["\u25CC", "\u25CB", "\u25CE", "\u25CF", "\u25CE", "\u25CB"]; // ◌ ○ ◎ ● ◎ ○

// ── Storm App ────────────────────────────────────────────────────────

function StormApp(): React.ReactElement {
  const { width, height } = useTerminal();
  const { flushSync, exit } = useTui();

  // -- Core state -------------------------------------------------------
  const [entries, setEntries] = useState<ConversationEntry[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("splash");
  const [cost, setCost] = useState(0.0);
  const [contextPct, setContextPct] = useState(0);

  const cleanupRef = useRef<(() => void) | null>(null);

  useCleanup(() => {
    cleanupRef.current?.();
  });

  // -- Splash timer: hold for 1.5s then transition to idle ----------------
  const splashDoneRef = useRef(false);
  if (phase === "splash" && !splashDoneRef.current) {
    splashDoneRef.current = true;
    setTimeout(() => {
      flushSync(() => {
        setEntries([
          { id: makeId(), kind: "system", text: "Session started" },
        ]);
        setPhase("idle");
      });
    }, 1500);
  }

  // -- Hook: useTextCycler — thinking verbs ------------------------------
  const { text: thinkingVerb } = useTextCycler({
    texts: ["analyzing", "scanning", "reasoning", "inspecting", "tracing"],
    intervalMs: 1400,
    order: "sequential",
    active: phase === "thinking",
  });

  // -- Hook: useEasedInterval — pulse loader -----------------------------
  const pulseFrameRef = useRef(0);
  useEasedInterval({
    durations: [150, 150, 150, 150, 150, 150],
    onTick: (frame) => {
      pulseFrameRef.current = frame;
    },
    active: phase === "thinking",
  });

  const pulseChar =
    phase === "thinking"
      ? PULSE_FRAMES[pulseFrameRef.current % PULSE_FRAMES.length]!
      : "";

  // -- Hook: useCollapsibleContent — tool output -------------------------
  const latestToolContent =
    entries.filter((e) => e.kind === "tool-output" && e.toolContent).pop()?.toolContent ?? "";
  const { displayText: collapsedTool, hint: collapseHint } = useCollapsibleContent({
    content: latestToolContent,
    maxLines: 3,
    toggleKey: { key: "o", ctrl: true },
    isActive: latestToolContent.length > 0,
  });

  // -- Hook: useInlinePrompt — tool approval -----------------------------
  const {
    selected: approvalChoice,
    reset: resetApproval,
  } = useInlinePrompt<"yes" | "no" | "always">({
    choices: { y: "yes", n: "no", a: "always" },
    isActive: phase === "tool-approval",
  });

  // -- Hook: useModeCycler — permission mode -----------------------------
  const { mode: permMode } = useModeCycler({
    modes: ["ask", "auto-edit", "auto-all"] as const,
    cycleKey: { key: "tab", shift: true },
    initial: "ask" as const,
  });

  // -- Handle approval result (checked via ref, acted on via timeout) ------
  const prevApprovalRef = useRef<string | null>(null);
  const approvalHandledRef = useRef(false);
  if (approvalChoice !== null && approvalChoice !== prevApprovalRef.current && !approvalHandledRef.current) {
    prevApprovalRef.current = approvalChoice;
    approvalHandledRef.current = true;
    // Defer to avoid state-update-during-render warning
    setTimeout(() => {
      approvalHandledRef.current = false;
      if (approvalChoice === "yes" || approvalChoice === "always") {
        flushSync(() => setPhase("tool-approved"));
        setTimeout(() => {
          flushSync(() => {
            setEntries((prev) => [
              ...prev,
              { id: makeId(), kind: "assistant", text: "Fixed. Added cleanup return in useEffect." },
            ]);
            setCost((c) => c + 0.018);
            setContextPct((p) => Math.min(p + 8, 100));
            setPhase("done");
          });
          setTimeout(() => {
            flushSync(() => { setPhase("idle"); resetApproval(); prevApprovalRef.current = null; });
          }, 500);
        }, 800);
      } else {
        flushSync(() => {
          setEntries((prev) => [...prev, { id: makeId(), kind: "system", text: "Edit denied." }]);
          setPhase("idle"); resetApproval(); prevApprovalRef.current = null;
        });
      }
    }, 0);
  }

  // -- Simulate agent flow -----------------------------------------------
  const runAgent = useCallback(
    (userText: string) => {
      flushSync(() => {
        setEntries((prev) => [
          ...prev,
          { id: makeId(), kind: "user", text: userText },
        ]);
        setPhase("thinking");
        setCost((c) => c + 0.024);
        setContextPct((p) => Math.min(p + 7, 100));
      });

      // Phase 1: thinking for 2s, then show response start + tool calls
      const t1 = setTimeout(() => {
        flushSync(() => {
          setEntries((prev) => [
            ...prev,
            {
              id: makeId(),
              kind: "thinking",
              text: "analyzing the auth module for memory leaks...",
              detail: "need to check useEffect cleanup patterns...",
            },
            {
              id: makeId(),
              kind: "assistant",
              text: "I'll scan the auth module. Let me read the files.",
            },
            {
              id: makeId(),
              kind: "tool-call",
              text: "read_file src/auth/session.ts",
            },
            {
              id: makeId(),
              kind: "tool-output",
              text: "import { Store } from '../store';",
              detail: "import { createSub } from './sub';",
              toolContent: TOOL_OUTPUT,
            },
          ]);
          setPhase("tool-read");
        });

        // Phase 2: show edit tool call + approval prompt
        const t2 = setTimeout(() => {
          flushSync(() => {
            setEntries((prev) => [
              ...prev,
              {
                id: makeId(),
                kind: "tool-call",
                text: "edit_file src/auth/session.ts",
              },
            ]);
            setPhase("tool-approval");
            resetApproval();
            prevApprovalRef.current = null;
          });
        }, 600);

        cleanupRef.current = () => clearTimeout(t2);
      }, 2000);

      cleanupRef.current = () => clearTimeout(t1);
    },
    [flushSync, resetApproval, thinkingVerb],
  );

  // -- Input handling ----------------------------------------------------
  const handleInputChange = useCallback(
    (value: string) => {
      flushSync(() => setInput(value));
    },
    [flushSync],
  );

  const handleSubmit = useCallback(
    (text: string) => {
      if (phase !== "idle" && phase !== "done") return;
      const trimmed = text.trim();
      if (!trimmed) return;

      if (trimmed === "/exit" || trimmed === "/quit") {
        cleanupRef.current?.();
        exit();
        return;
      }

      flushSync(() => setInput(""));
      runAgent(trimmed);
    },
    [phase, flushSync, exit, runAgent],
  );

  // -- Keyboard shortcuts ------------------------------------------------
  useInput(
    useCallback(
      (e) => {
        if (e.key === "c" && e.ctrl) {
          cleanupRef.current?.();
          exit();
        }
      },
      [exit],
    ),
  );

  // -- Render: Splash screen ---------------------------------------------
  if (phase === "splash") {
    return (
      <Box flexDirection="column" width={width} height={height} paddingLeft={2} paddingTop={1}>
        <Box flexDirection="row">
          <Text color={C.arcBlue} bold>{"\u25C6 "}</Text>
          <Text color={C.arcBlue} bold>storm</Text>
        </Box>
        <Box paddingLeft={2}>
          <Text color={C.dim}>{process.cwd()}</Text>
        </Box>
        <Box paddingLeft={2}>
          <Text color={C.dim}>qwen-2.5-coder-32b {"\u00B7"} 128K context</Text>
        </Box>
      </Box>
    );
  }

  // -- Render: Main chat -------------------------------------------------
  const contentWidth = Math.min(width, 90);

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* ── Conversation scroll area ──────────────────────────── */}
      <ScrollView flexGrow={1} flexShrink={1} flexBasis={0} stickToBottom>
        <Box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1}>
          {entries.map((entry) => {
            switch (entry.kind) {
              // │ Session started
              case "system":
                return (
                  <Box key={entry.id} height={1} flexDirection="row">
                    <Text color={C.dim}>{"\u2502 "}</Text>
                    <Text color={C.dim}>{entry.text}</Text>
                  </Box>
                );

              // › fix the memory leak in auth
              case "user":
                return (
                  <Box key={entry.id} flexDirection="row" paddingTop={1}>
                    <Text color={C.dim}>{"\u203A "}</Text>
                    <Text color={C.textPri} bold>{entry.text}</Text>
                  </Box>
                );

              //   ∴ analyzing the auth module...
              case "thinking":
                return (
                  <Box key={entry.id} flexDirection="column" paddingTop={1}>
                    <Box flexDirection="row">
                      <Text color={C.dim}>{"  \u2234 "}</Text>
                      <Text color={C.dim} italic>{entry.text}</Text>
                    </Box>
                    {entry.detail ? (
                      <Box flexDirection="row">
                        <Text color={C.dim}>{"    "}</Text>
                        <Text color={C.dim} italic>{entry.detail}</Text>
                      </Box>
                    ) : null}
                  </Box>
                );

              // ◆ I'll scan the auth module...
              case "assistant":
                return (
                  <Box key={entry.id} flexDirection="row" paddingTop={1}>
                    <Text color={C.arcBlue} bold>{"\u25C6 "}</Text>
                    <Text color={C.textPri}>{entry.text}</Text>
                  </Box>
                );

              //   ▸ read_file src/auth/session.ts
              case "tool-call":
                return (
                  <Box key={entry.id} flexDirection="row" paddingTop={1}>
                    <Text color={C.arcBlue}>{"  \u25B8 "}</Text>
                    <Text color={C.arcBlue}>{entry.text}</Text>
                  </Box>
                );

              //   ◂ import { Store } from '../store';
              case "tool-output":
                return (
                  <Box key={entry.id} flexDirection="column">
                    {latestToolContent.length > 0 ? (
                      <Box flexDirection="column" paddingLeft={2}>
                        {collapsedTool.split("\n").map((line, i) => (
                          <Box key={i} height={1} flexDirection="row">
                            <Text color={C.dim}>{i === 0 ? "\u25C2 " : "  "}</Text>
                            <Text color={C.dim}>{line}</Text>
                          </Box>
                        ))}
                        {collapseHint ? (
                          <Box height={1} flexDirection="row" paddingLeft={2}>
                            <Text color={C.dim} dim>{collapseHint}</Text>
                          </Box>
                        ) : null}
                      </Box>
                    ) : (
                      <Box flexDirection="row" paddingLeft={2}>
                        <Text color={C.dim}>{"\u25C2 "}</Text>
                        <Text color={C.dim}>{entry.text}</Text>
                      </Box>
                    )}
                  </Box>
                );

              default:
                return null;
            }
          })}

          {/* ── Thinking indicator with pulse loader ──────────── */}
          {phase === "thinking" ? (
            <Box flexDirection="row" paddingTop={1}>
              <Text color={C.arcBlue}>{"  "}{pulseChar}{" "}</Text>
              <Text color={C.dim} italic>{thinkingVerb}...</Text>
            </Box>
          ) : null}

          {/* ── Inline approval prompt ────────────────────────── */}
          {phase === "tool-approval" ? (
            <Box flexDirection="row" paddingLeft={4} paddingTop={0}>
              <Text color={C.dim}>{"Allow? "}</Text>
              <Text color={C.textPri}>{"[y]"}</Text>
              <Text color={C.dim}>{" yes  "}</Text>
              <Text color={C.textPri}>{"[n]"}</Text>
              <Text color={C.dim}>{" no  "}</Text>
              <Text color={C.textPri}>{"[a]"}</Text>
              <Text color={C.dim}>{" always"}</Text>
            </Box>
          ) : null}

          {/* ── Pulse divider on approval ─────────────────────── */}
          {phase === "tool-approved" ? (
            <Box paddingTop={1}>
              <Text color={C.arcBlue}>
                {"\u2501".repeat(Math.min(contentWidth - 4, 20))}
              </Text>
            </Box>
          ) : null}

          {/* No bottom spacer — tight layout */}
        </Box>
      </ScrollView>

      {/* ── Input prompt ──────────────────────────────────────── */}
      <Box flexDirection="row" height={1} paddingLeft={2}>
        <Text color={C.dim}>{"\u203A "}</Text>
        <Box flexGrow={1}>
          <TextInput
            value={input}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            focus={phase === "idle" || phase === "done"}
            color={C.textPri}
            placeholderColor={C.dim}
            placeholder=""
          />
        </Box>
      </Box>

      {/* ── Divider ───────────────────────────────────────────── */}
      <Box height={1} paddingLeft={2}>
        <Text color={C.dim}>
          {"\u2500".repeat(Math.max(0, width - 4))}
        </Text>
      </Box>

      {/* ── Status bar ────────────────────────────────────────── */}
      <Box height={1} paddingLeft={2} flexDirection="row">
        <Text color={C.dim}>qwen-2.5-coder-32b</Text>
        <Text color={C.dim}>{"  $"}{cost.toFixed(3)}</Text>
        <Text color={C.dim}>{"  "}{contextPct}{"% ctx"}</Text>
        <Text color={C.dim}>{"  "}{String(permMode)}{" mode"}</Text>
      </Box>
    </Box>
  );
}

// ── Entry ────────────────────────────────────────────────────────────

const app = render(<StormApp />);
await app.waitUntilExit();
