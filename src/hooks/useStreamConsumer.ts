import { useRef } from "react";
import { useCleanup } from "./useCleanup.js";
import { useForceUpdate } from "./useForceUpdate.js";

export interface UseStreamConsumerOptions {
  /** Call start() to begin consuming */
  autoStart?: boolean;
}

export interface UseStreamConsumerResult {
  text: string; // accumulated text so far
  isStreaming: boolean;
  isDone: boolean;
  error: string | null;
  start: (stream: AsyncIterable<string>) => void;
  cancel: () => void;
  reset: () => void;
}

export function useStreamConsumer(
  _options: UseStreamConsumerOptions = {},
): UseStreamConsumerResult {
  const forceUpdate = useForceUpdate();

  const textRef = useRef("");
  const streamingRef = useRef(false);
  const doneRef = useRef(false);
  const errorRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (streamingRef.current) {
      streamingRef.current = false;
      doneRef.current = true;
      forceUpdate();
    }
  };

  const reset = () => {
    cancel();
    textRef.current = "";
    streamingRef.current = false;
    doneRef.current = false;
    errorRef.current = null;
    forceUpdate();
  };

  const start = (stream: AsyncIterable<string>) => {
    textRef.current = "";
    errorRef.current = null;
    doneRef.current = false;
    streamingRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;
    forceUpdate();

    (async () => {
      try {
        for await (const chunk of stream) {
          if (controller.signal.aborted) return;
          textRef.current += chunk;
          forceUpdate();
        }
        if (!controller.signal.aborted) {
          streamingRef.current = false;
          doneRef.current = true;
          forceUpdate();
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        streamingRef.current = false;
        doneRef.current = true;
        errorRef.current = err instanceof Error ? err.message : String(err);
        forceUpdate();
      }
    })();
  };

  useCleanup(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  });

  return {
    text: textRef.current,
    isStreaming: streamingRef.current,
    isDone: doneRef.current,
    error: errorRef.current,
    start,
    cancel,
    reset,
  };
}
