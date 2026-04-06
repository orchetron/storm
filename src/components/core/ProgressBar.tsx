import React, { useId, useRef } from "react";
import { useTui } from "../../context/TuiContext.js";
import { useColors } from "../../hooks/useColors.js";
import { useCleanup } from "../../hooks/useCleanup.js";
import { useMeasure } from "../../hooks/useMeasure.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { DEFAULTS } from "../../styles/defaults.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { pickLayoutProps } from "../../styles/applyStyles.js";

export interface ProgressBarProps extends StormLayoutStyleProps {
  /** Progress value 0-100. Pass undefined or -1 for indeterminate mode. */
  value: number | undefined;
  /** Override: must be numeric for bar width calculation. */
  width?: number;
  trackColor?: string | number;
  showPercent?: boolean;
  label?: string;
  /** Start timestamp (Date.now()). When provided, enables ETA display. */
  startTime?: number;
  /** When true (and startTime provided), show items/second or %/second rate. */
  showRate?: boolean;
  /** Custom renderer for the label/percentage display. */
  renderLabel?: (percent: number, label?: string) => React.ReactNode;
}

function formatDuration(ms: number): string {
  if (ms < 0) return "0s";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return `${hours}h ${remainMinutes}m`;
}

function formatRate(percentPerSecond: number): string {
  if (percentPerSecond >= 10) return `${Math.round(percentPerSecond)}%/s`;
  if (percentPerSecond >= 1) return `${percentPerSecond.toFixed(1)}%/s`;
  return `${percentPerSecond.toFixed(2)}%/s`;
}

export const ProgressBar = React.memo(function ProgressBar(rawProps: ProgressBarProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("ProgressBar", rawProps);
  const {
    value,
    width: widthProp,
    height,
    color = colors.brand.primary,
    trackColor = colors.text.dim,
    showPercent = false,
    label,
    startTime,
    showRate = false,
  } = props;

  // Auto-measure width from layout when not explicitly provided
  const measureId = useId();
  const autoMeasure = widthProp === undefined;
  const measured = useMeasure(autoMeasure ? `progressbar-${measureId}` : "");
  const width = widthProp ?? measured?.width ?? DEFAULTS.progressBar.width;

  const { requestRender } = useTui();
  const indeterminatePosRef = useRef(0);
  const indeterminateDirRef = useRef(1);
  const indeterminateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up indeterminate timer on unmount — useEffect cleanup doesn't fire
  useCleanup(() => {
    if (indeterminateTimerRef.current !== null) {
      clearInterval(indeterminateTimerRef.current);
      indeterminateTimerRef.current = null;
    }
  });

  const isIndeterminate = value === undefined || value === -1;

  // Indeterminate bounce animation
  if (isIndeterminate) {
    if (indeterminateTimerRef.current === null) {
      const indicatorWidth = Math.max(1, Math.floor(width / 5));
      indeterminateTimerRef.current = setInterval(() => {
        indeterminatePosRef.current += indeterminateDirRef.current;
        if (indeterminatePosRef.current >= width - indicatorWidth) {
          indeterminatePosRef.current = width - indicatorWidth;
          indeterminateDirRef.current = -1;
        } else if (indeterminatePosRef.current <= 0) {
          indeterminatePosRef.current = 0;
          indeterminateDirRef.current = 1;
        }
        requestRender();
      }, 80);
    }

    const indicatorWidth = Math.max(1, Math.floor(width / 5));
    const pos = indeterminatePosRef.current;
    const before = DEFAULTS.progressBar.emptyChar.repeat(pos);
    const indicator = DEFAULTS.progressBar.filledChar.repeat(indicatorWidth);
    const after = DEFAULTS.progressBar.emptyChar.repeat(Math.max(0, width - pos - indicatorWidth));

    const indChildren: React.ReactElement[] = [];
    if (label !== undefined) {
      indChildren.push(
        React.createElement("tui-text", { key: "label" }, label + " "),
      );
    }
    indChildren.push(
      React.createElement("tui-text", { key: "before", color: trackColor }, before),
    );
    indChildren.push(
      React.createElement("tui-text", { key: "indicator", color }, indicator),
    );
    indChildren.push(
      React.createElement("tui-text", { key: "after", color: trackColor }, after),
    );

    const { width: _w, height: _h, ...layoutRest } = pickLayoutProps(props);
    const indBoxProps: Record<string, unknown> = {
      role: "progressbar",
      flexDirection: "row",
      height: height ?? 1,
      overflow: "hidden",
      flexShrink: 0,
      ...layoutRest,
    };

    if (autoMeasure) {
      return React.createElement(
        "tui-box",
        { _measureId: `progressbar-${measureId}`, flex: 1 },
        React.createElement("tui-box", indBoxProps, ...indChildren),
      );
    }
    return React.createElement("tui-box", indBoxProps, ...indChildren);
  }

  if (indeterminateTimerRef.current !== null) {
    clearInterval(indeterminateTimerRef.current);
    indeterminateTimerRef.current = null;
  }

  const clamped = Math.max(0, Math.min(100, value));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;

  const filledStr = DEFAULTS.progressBar.filledChar.repeat(filled);
  const emptyStr = DEFAULTS.progressBar.emptyChar.repeat(empty);

  const children: React.ReactElement[] = [];

  if (props.renderLabel) {
    children.push(
      React.createElement(
        "tui-box",
        { key: "custom-label", flexDirection: "row" },
        props.renderLabel(clamped, label),
      ),
    );
  } else {
    if (label !== undefined) {
      children.push(
        React.createElement("tui-text", { key: "label" }, label + " "),
      );
    }
  }

  children.push(
    React.createElement("tui-text", { key: "filled", color }, filledStr),
  );
  children.push(
    React.createElement("tui-text", { key: "empty", color: trackColor }, emptyStr),
  );

  if (showPercent && !props.renderLabel) {
    children.push(
      React.createElement("tui-text", { key: "pct" }, ` ${Math.round(clamped)}%`),
    );
  }

  // ETA and rate display
  if (startTime !== undefined) {
    const now = Date.now();
    const elapsed = now - startTime;
    const timeParts: string[] = [];

    // Elapsed time
    timeParts.push(`Elapsed: ${formatDuration(elapsed)}`);

    if (clamped > 0 && clamped < 100) {
      // ETA calculation: remaining = (elapsed / clamped) * (100 - clamped)
      const estimatedTotal = (elapsed / clamped) * 100;
      const remaining = estimatedTotal - elapsed;
      timeParts.push(`ETA: ${formatDuration(remaining)}`);
    } else if (clamped >= 100) {
      timeParts.push("Done");
    }

    // Rate display
    if (showRate && elapsed > 0) {
      const elapsedSeconds = elapsed / 1000;
      const percentPerSecond = clamped / elapsedSeconds;
      timeParts.push(formatRate(percentPerSecond));
    }

    children.push(
      React.createElement(
        "tui-text",
        { key: "eta", color: colors.text.dim },
        "  " + timeParts.join("  "),
      ),
    );
  }

  const { width: _w2, height: _h2, ...layoutRest2 } = pickLayoutProps(props);
  const outerBoxProps: Record<string, unknown> = {
    role: "progressbar",
    flexDirection: "row",
    height: height ?? 1,
    overflow: "hidden",
    flexShrink: 0,
    ...layoutRest2,
  };

  const inner = React.createElement(
    "tui-box",
    outerBoxProps,
    ...children,
  );

  if (autoMeasure) {
    return React.createElement(
      "tui-box",
      { _measureId: `progressbar-${measureId}`, flex: 1 },
      inner,
    );
  }
  return inner;
});
