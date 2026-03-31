/**
 * useIsScreenReaderEnabled — detects screen reader / accessibility mode.
 *
 * Checks environment variables commonly set when a screen reader
 * or accessibility tool is active.
 */

export function useIsScreenReaderEnabled(): boolean {
  return (
    process.env["ACCESSIBILITY"] === "1" ||
    process.env["SCREEN_READER"] === "1" ||
    false
  );
}
