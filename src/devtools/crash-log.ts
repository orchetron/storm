/**
 * Crash log -- forensic dump on unhandled exceptions, rejections, and signals.
 *
 * Writes a synchronous JSON file containing the last N profiler snapshots,
 * the component tree, memory state, and error details. Uses writeFileSync
 * because the process is dying.
 *
 * Usage:
 * ```ts
 * const app = render(<App />);
 * const profiler = createProfiler(renderCtx);
 * profiler.start();
 * enableCrashLog(app, profiler, { dir: "./crashes" });
 * ```
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { TuiApp } from "../reconciler/render.js";
import type { Profiler, ProfilerSnapshot } from "./profiler.js";
import { serializeTree } from "./tree-view.js";

export interface CrashLogOptions {
  /** Directory to write crash logs. Default: process.cwd() */
  dir?: string;
  /** Number of frame snapshots to include. Default: 60 */
  frames?: number;
  /** Include component tree dump. Default: true */
  includeTree?: boolean;
}

export interface CrashLogData {
  timestamp: string;
  signal?: string;
  error?: { message: string; stack?: string; name?: string };
  lastFrames: ProfilerSnapshot[];
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  componentTree?: string;
  terminalSize: { width: number; height: number };
  nodeVersion: string;
  stormVersion: string;
}

const STORM_VERSION = "0.1.0";

function buildCrashData(
  app: TuiApp,
  profiler: Profiler,
  frames: number,
  includeTree: boolean,
  cause?: { error?: Error; signal?: string },
): CrashLogData {
  const mem = process.memoryUsage();
  const lastFrames = profiler.history(frames);

  let componentTree: string | undefined;
  if (includeTree) {
    try {
      componentTree = serializeTree(app.root, 50);
    } catch {
      componentTree = "<failed to serialize tree>";
    }
  }

  const data: CrashLogData = {
    timestamp: new Date().toISOString(),
    lastFrames,
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
    },
    terminalSize: {
      width: app.screen.width,
      height: app.screen.height,
    },
    nodeVersion: process.version,
    stormVersion: STORM_VERSION,
  };

  if (cause?.signal) {
    data.signal = cause.signal;
  }
  if (cause?.error) {
    data.error = {
      message: cause.error.message,
      ...(cause.error.stack ? { stack: cause.error.stack } : {}),
      ...(cause.error.name ? { name: cause.error.name } : {}),
    };
  }
  if (componentTree !== undefined) {
    data.componentTree = componentTree;
  }

  return data;
}

function writeCrashLog(dir: string, data: CrashLogData): string | null {
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const ts = data.timestamp.replace(/[:.]/g, "-");
    const filename = `storm-crash-${ts}.json`;
    const filepath = join(dir, filename);
    writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
    return filepath;
  } catch {
    // If we can't write the crash log, there's nothing more we can do
    return null;
  }
}

export function enableCrashLog(
  app: TuiApp,
  profiler: Profiler,
  options?: CrashLogOptions,
): () => void {
  const dir = options?.dir ?? process.cwd();
  const frames = options?.frames ?? 60;
  const includeTree = options?.includeTree !== false;
  let installed = true;

  const onUncaughtException = (err: Error): void => {
    if (!installed) return;
    const data = buildCrashData(app, profiler, frames, includeTree, { error: err });
    const path = writeCrashLog(dir, data);
    if (path) {
      try {
        process.stderr.write(`[storm] Crash log written: ${path}\n`);
      } catch {
        // stderr may be closed
      }
    }
    // Re-throw so the default handler can exit
    throw err;
  };

  const onUnhandledRejection = (reason: unknown): void => {
    if (!installed) return;
    const err = reason instanceof Error ? reason : new Error(String(reason));
    const data = buildCrashData(app, profiler, frames, includeTree, { error: err });
    writeCrashLog(dir, data);
  };

  const onSignal = (sig: NodeJS.Signals): void => {
    if (!installed) return;
    const data = buildCrashData(app, profiler, frames, includeTree, { signal: sig });
    const path = writeCrashLog(dir, data);
    if (path) {
      try {
        process.stderr.write(`[storm] Crash log written: ${path}\n`);
      } catch {
        // stderr may be closed
      }
    }
  };

  // Install handlers
  process.on("uncaughtException", onUncaughtException);
  process.on("unhandledRejection", onUnhandledRejection);
  process.on("SIGTERM", onSignal);
  process.on("SIGHUP", onSignal);

  // Return cleanup function
  return () => {
    installed = false;
    process.removeListener("uncaughtException", onUncaughtException);
    process.removeListener("unhandledRejection", onUnhandledRejection);
    process.removeListener("SIGTERM", onSignal);
    process.removeListener("SIGHUP", onSignal);
  };
}
