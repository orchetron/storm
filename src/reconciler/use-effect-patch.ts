import React from "react";

/**
 * Storm's custom reconciler doesn't reliably fire useEffect cleanup
 * functions. This is the #1 footgun for new users. We monkey-patch
 * React.useEffect to detect when a callback returns a cleanup function
 * and emit a warning pointing to useCleanup() instead.
 * Works in both dev and production, but production is quieter (max 3 warnings).
 */

const _warnedCallSites = new Set<string>();
let _useEffectPatched = false;
let _useEffectWarnCount = 0;
const _USE_EFFECT_MAX_PROD_WARNINGS = 3;

export function patchUseEffect(): void {
  if (_useEffectPatched) return;
  _useEffectPatched = true;

  const isProduction = process.env.NODE_ENV === "production";
  const originalUseEffect = React.useEffect;
  (React as unknown as Record<string, unknown>).useEffect = ( // React private API — monkey-patching useEffect
    callback: () => void | (() => void),
    deps?: readonly unknown[],
  ): void => {
    const wrappedCallback = () => {
      const result = callback();
      if (typeof result === "function") {
        // In production, limit warnings to first N occurrences
        if (isProduction) {
          _useEffectWarnCount++;
          if (_useEffectWarnCount <= _USE_EFFECT_MAX_PROD_WARNINGS) {
            process.stderr.write(
              "[storm] Warning: useEffect cleanup function detected. " +
              "Use useCleanup() instead. See docs/pitfalls.md#4\n",
            );
          }
          if (_useEffectWarnCount === _USE_EFFECT_MAX_PROD_WARNINGS) {
            process.stderr.write(
              "[storm] ... suppressing further useEffect cleanup warnings.\n",
            );
          }
          return result;
        }
        // Dev mode: warn once per call site
        let callSiteKey = "unknown";
        try {
          const stack = new Error().stack;
          if (stack) {
            const frames = stack.split("\n");
            callSiteKey = (frames[2] ?? frames[1] ?? "unknown").trim();
          }
        } catch {
          // Ignore — use default key
        }
        if (!_warnedCallSites.has(callSiteKey)) {
          _warnedCallSites.add(callSiteKey);
          process.stderr.write(
            "[storm] Warning: useEffect cleanup function detected. " +
            "In Storm's reconciler, useEffect cleanup may not fire reliably. " +
            "Use useCleanup() instead for timers, listeners, and subscriptions. " +
            "See docs/pitfalls.md#4\n",
          );
        }
        return result;
      }
      return result;
    };
    originalUseEffect(wrappedCallback, deps);
  };
}
