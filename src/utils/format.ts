/**
 * Shared formatting utilities for Storm TUI widgets.
 *
 * Centralizes number, duration, and cost formatting to avoid
 * duplicating the same helpers across multiple widget files.
 *
 * @module
 */

/**
 * Format a number with K/M suffixes.
 * e.g. 1500 -> "1.5K", 2000000 -> "2.0M"
 */
export function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Format milliseconds to human-readable duration.
 * e.g. 500 -> "500ms", 1500 -> "1.5s", 90000 -> "1m30s"
 */
export function fmtDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1_000);
  return `${mins}m${secs}s`;
}

/**
 * Format a cost value with currency symbol.
 * Shows more decimal places for small amounts.
 */
export function fmtCost(cost: number, currency: string = "$"): string {
  if (cost < 0.01) return `${currency}${cost.toFixed(4)}`;
  if (cost < 1) return `${currency}${cost.toFixed(2)}`;
  return `${currency}${cost.toFixed(2)}`;
}

/**
 * Format bytes to human-readable file size.
 * e.g. 1234 -> "1.2 KB", 3456789 -> "3.3 MB"
 */
export function fmtBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}

/**
 * Format a timestamp to a relative time string.
 * e.g. 2 seconds ago -> "2s ago", 3 minutes ago -> "3m ago"
 */
export function fmtRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Format a value as a percentage string.
 * e.g. 0.425 -> "42.5%", 1.0 -> "100.0%"
 */
export function fmtPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
