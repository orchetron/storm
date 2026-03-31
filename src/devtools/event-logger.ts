/**
 * Event logger — ring buffer of recent input events for DevTools inspection.
 *
 * Tracks keyboard, mouse, paste, and resize events with timestamps.
 * Maintains a fixed-size buffer (default 20) of the most recent events,
 * newest first.
 */

export interface LoggedEvent {
  type: "key" | "mouse" | "paste" | "resize";
  detail: string;
  timestamp: number;
}

/**
 * Creates an event logger with a fixed-capacity ring buffer.
 *
 * @param maxEvents - Maximum number of events to retain (default: 20).
 */
export function createEventLogger(maxEvents?: number): {
  log: (event: LoggedEvent) => void;
  getEvents: () => readonly LoggedEvent[];
  clear: () => void;
} {
  const capacity = maxEvents ?? 20;
  const buffer: LoggedEvent[] = [];

  return {
    log(event: LoggedEvent) {
      buffer.unshift(event);
      if (buffer.length > capacity) {
        buffer.length = capacity;
      }
    },

    getEvents(): readonly LoggedEvent[] {
      return buffer;
    },

    clear() {
      buffer.length = 0;
    },
  };
}
