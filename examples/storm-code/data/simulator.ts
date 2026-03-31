/**
 * Storm Code CLI — Mock simulation engine.
 *
 * Takes user input, finds a matching response template, and plays it back
 * as a sequence of message events with realistic delays.
 */

import type { Message } from "./types.js";
import { findResponseTemplate, type ResponseStep } from "./mock-responses.js";

let nextId = 1000;
function makeId(): number {
  return nextId++;
}

// ── Callback Types ─────────────────────────────────────────────────────

export interface SimulatorCallbacks {
  /** Called when the agent starts thinking. Content streams word-by-word. */
  onThinking: (text: string) => void;
  /** Called for memory operations. */
  onMemoryOp: (action: string, content: string) => void;
  /** Called when the agent wants to use a tool. Returns a Promise that resolves to true (approved) or false (denied). */
  onToolCall: (name: string, params: Record<string, unknown>, riskLevel: string) => Promise<boolean>;
  /** Called with tool results after approval. */
  onToolResult: (result: string) => void;
  /** Called for the assistant response. Content streams word-by-word. */
  onResponse: (text: string) => void;
  /** Called when the full sequence is complete. */
  onComplete: (messages: Message[]) => void;
}

// ── Word-by-Word Streaming ─────────────────────────────────────────────

function streamWords(
  text: string,
  onWord: (accumulated: string) => void,
  intervalMs: number,
  onDone: () => void,
): ReturnType<typeof setInterval> {
  const words = text.split(/(\s+)/);
  let i = 0;
  let accumulated = "";
  const timer = setInterval(() => {
    if (i >= words.length) {
      clearInterval(timer);
      onDone();
      return;
    }
    accumulated += words[i]!;
    i++;
    onWord(accumulated);
  }, intervalMs);
  return timer;
}

// ── Simulator ──────────────────────────────────────────────────────────

export function simulate(
  userInput: string,
  callbacks: SimulatorCallbacks,
): () => void {
  const template = findResponseTemplate(userInput);
  const steps = [...template.steps];
  const collectedMessages: Message[] = [];
  const timers: Array<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>> = [];
  let cancelled = false;

  // Add the user message
  collectedMessages.push({
    id: makeId(),
    type: "user",
    content: userInput,
    timestamp: Date.now(),
  });

  async function runSteps() {
    let delay = 0;

    for (const step of steps) {
      if (cancelled) return;

      switch (step.kind) {
        case "thinking":
          await runThinking(step, delay);
          delay = 100;
          break;
        case "memory_op":
          await runMemoryOp(step, delay);
          delay = 100;
          break;
        case "function_call":
          await runFunctionCall(step, delay);
          delay = 100;
          break;
        case "function_return":
          await runFunctionReturn(step, delay);
          delay = 100;
          break;
        case "response":
          await runResponse(step, delay);
          delay = 0;
          break;
      }
    }

    if (!cancelled) {
      callbacks.onComplete(collectedMessages);
    }
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      timers.push(t);
    });
  }

  async function runThinking(step: ResponseStep, initialDelay: number) {
    await wait(initialDelay + 300);
    if (cancelled) return;

    return new Promise<void>((resolve) => {
      const timer = streamWords(
        step.content,
        (accumulated) => {
          if (!cancelled) callbacks.onThinking(accumulated);
        },
        40,
        () => {
          collectedMessages.push({
            id: makeId(),
            type: "thinking",
            content: step.content,
            timestamp: Date.now(),
          });
          resolve();
        },
      );
      timers.push(timer);
    });
  }

  async function runMemoryOp(step: ResponseStep, initialDelay: number) {
    await wait(initialDelay + 200);
    if (cancelled) return;

    callbacks.onMemoryOp(step.memoryAction ?? "unknown", step.content);
    collectedMessages.push({
      id: makeId(),
      type: "memory_op",
      content: step.content,
      memoryAction: step.memoryAction,
      timestamp: Date.now(),
    });
  }

  async function runFunctionCall(step: ResponseStep, initialDelay: number) {
    await wait(initialDelay + 500);
    if (cancelled) return;

    const toolName = step.toolName ?? "unknown_tool";
    const toolParams = step.toolParams ?? {};
    const riskLevel = step.riskLevel ?? "low";

    collectedMessages.push({
      id: makeId(),
      type: "function_call",
      content: step.content,
      toolName,
      toolParams,
      riskLevel,
      timestamp: Date.now(),
    });

    // Request approval
    const approved = await callbacks.onToolCall(toolName, toolParams, riskLevel);
    if (!approved || cancelled) {
      collectedMessages.push({
        id: makeId(),
        type: "function_return",
        content: "[Tool call denied by user]",
        timestamp: Date.now(),
      });
      return;
    }
  }

  async function runFunctionReturn(step: ResponseStep, initialDelay: number) {
    await wait(initialDelay + 200);
    if (cancelled) return;

    callbacks.onToolResult(step.content);
    collectedMessages.push({
      id: makeId(),
      type: "function_return",
      content: step.content,
      timestamp: Date.now(),
    });
  }

  async function runResponse(step: ResponseStep, initialDelay: number) {
    await wait(initialDelay + 200);
    if (cancelled) return;

    return new Promise<void>((resolve) => {
      const wordDelay = 30 + Math.floor(Math.random() * 20);
      const timer = streamWords(
        step.content,
        (accumulated) => {
          if (!cancelled) callbacks.onResponse(accumulated);
        },
        wordDelay,
        () => {
          collectedMessages.push({
            id: makeId(),
            type: "assistant",
            content: step.content,
            timestamp: Date.now(),
          });
          resolve();
        },
      );
      timers.push(timer);
    });
  }

  // Kick off
  runSteps().catch(() => {
    // Swallow errors from cancellation
  });

  // Return cleanup function
  return () => {
    cancelled = true;
    for (const t of timers) clearInterval(t);
    timers.length = 0;
  };
}
