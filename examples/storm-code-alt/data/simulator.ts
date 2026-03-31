/**
 * Storm Code CLI -- Mock simulation engine.
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

// -- Callback Types -----------------------------------------------------------

export interface SimulatorCallbacks {
  /** Called when the agent starts thinking. Content streams word-by-word. */
  onThinking: (text: string) => void;
  /** Called when a tool call starts (shows the tool header). */
  onToolCall: (
    name: string,
    args: string,
    needsApproval: boolean,
  ) => Promise<boolean>;
  /** Called with tool output after the tool call is approved/auto-approved. */
  onToolOutput: (
    name: string,
    args: string,
    output: string,
    totalLines: number,
    isError: boolean,
  ) => void;
  /** Called for the assistant response. Content streams word-by-word. */
  onResponse: (text: string) => void;
  /** Called when the full sequence is complete. */
  onComplete: (messages: Message[], cost: number, contextDelta: number) => void;
}

// -- Word-by-Word Streaming ---------------------------------------------------

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

// -- Simulator ----------------------------------------------------------------

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
        case "tool_call":
          await runToolCall(step, delay);
          delay = 100;
          break;
        case "response":
          await runResponse(step, delay);
          delay = 0;
          break;
      }
    }

    if (!cancelled) {
      callbacks.onComplete(collectedMessages, template.cost, template.contextDelta);
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
            thinkingDuration: step.thinkingDuration,
          });
          resolve();
        },
      );
      timers.push(timer);
    });
  }

  async function runToolCall(step: ResponseStep, initialDelay: number) {
    await wait(initialDelay + 400);
    if (cancelled) return;

    const toolName = step.toolName ?? "Unknown";
    const toolArgs = step.toolArgs ?? "";
    const needsApproval = step.needsApproval ?? false;
    const toolOutput = step.toolOutput ?? "";
    const toolTotalLines = step.toolTotalLines ?? toolOutput.split("\n").length;
    const toolIsError = step.toolIsError ?? false;

    // Request approval if needed
    const approved = await callbacks.onToolCall(toolName, toolArgs, needsApproval);
    if (!approved || cancelled) {
      collectedMessages.push({
        id: makeId(),
        type: "tool_call",
        content: "",
        timestamp: Date.now(),
        toolCall: {
          name: toolName,
          args: toolArgs,
          output: "[Tool call denied by user]",
          totalLines: 1,
          expanded: false,
          isError: true,
        },
      });
      return;
    }

    // Show tool output with a small delay
    await wait(300);
    if (cancelled) return;

    callbacks.onToolOutput(toolName, toolArgs, toolOutput, toolTotalLines, toolIsError);

    collectedMessages.push({
      id: makeId(),
      type: "tool_call",
      content: "",
      timestamp: Date.now(),
      toolCall: {
        name: toolName,
        args: toolArgs,
        output: toolOutput,
        totalLines: toolTotalLines,
        expanded: false,
        isError: toolIsError,
      },
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
