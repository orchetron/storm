/**
 * ShowcaseFeedback -- "Feedback & Status" showcase template.
 *
 * Demos 9 feedback/status components with headings and live rendered examples.
 */

import React, { useState, useRef } from "react";
import { useColors } from "../../hooks/useColors.js";
import { useTui } from "../../context/TuiContext.js";
import { useInput } from "../../hooks/useInput.js";
import { useCleanup } from "../../hooks/useCleanup.js";
import { ScrollView } from "../../components/ScrollView.js";
import { Spinner } from "../../components/Spinner.js";
import { ProgressBar } from "../../components/ProgressBar.js";
import { GradientProgress } from "../../components/GradientProgress.js";
import { Gauge } from "../../components/Gauge.js";
import { Toast } from "../../components/Toast.js";
import { Timer } from "../../components/Timer.js";
import { Stopwatch } from "../../components/Stopwatch.js";
import { StatusMessage } from "../../components/StatusMessage.js";
import { Alert } from "../../components/Alert.js";

export interface ShowcaseFeedbackProps {
  title?: string;
}

function heading(label: string, key: string): React.ReactElement {
  const colors = useColors();
  return React.createElement("tui-text", {
    key, bold: true, color: colors.brand.primary,
  }, `  ${label}`);
}

function blank(key: string): React.ReactElement {
  const colors = useColors();
  return React.createElement("tui-text", { key }, "");
}

export function ShowcaseFeedback(props: ShowcaseFeedbackProps): React.ReactElement {
  const colors = useColors();
  const { title = "Feedback & Status" } = props;
  const { flushSync, exit } = useTui();

  // Timer countdown state: 60 seconds from now
  const [timerStart] = useState(() => Date.now());

  useInput((event) => {
    if (event.key === "q" || event.char === "q") exit();
  });

  return React.createElement(ScrollView, { flex: 1 },
    // Title
    React.createElement("tui-text", {
      key: "title", bold: true, color: colors.brand.light,
    }, `  === ${title} ===`),
    blank("b0"),

    // 1. Spinner (3 styles side by side)
    heading("Spinner", "h-spin"),
    blank("b1a"),
    React.createElement("tui-box", { key: "d-spin", flexDirection: "row", marginLeft: 2, gap: 4 },
      React.createElement(Spinner, { type: "dots", label: "dots" }),
      React.createElement(Spinner, { type: "line", label: "line" }),
      React.createElement(Spinner, { type: "storm", label: "storm" }),
    ),
    blank("b1b"),

    // 2. ProgressBar at 65%
    heading("ProgressBar", "h-prog"),
    blank("b2a"),
    React.createElement("tui-box", { key: "d-prog", marginLeft: 2 },
      React.createElement(ProgressBar, { value: 65, showPercent: true, label: "Upload" }),
    ),
    blank("b2b"),

    // 3. GradientProgress at 45%
    heading("GradientProgress", "h-gprog"),
    blank("b3a"),
    React.createElement("tui-box", { key: "d-gprog", marginLeft: 2 },
      React.createElement(GradientProgress, {
        value: 45,
        showPercentage: true,
        label: "Processing",
      }),
    ),
    blank("b3b"),

    // 4. Gauge at 78%
    heading("Gauge", "h-gauge"),
    blank("b4a"),
    React.createElement("tui-box", { key: "d-gauge", marginLeft: 2 },
      React.createElement(Gauge, { value: 78, label: "CPU" }),
    ),
    blank("b4b"),

    // 5. Toast
    heading("Toast", "h-toast"),
    blank("b5a"),
    React.createElement("tui-box", { key: "d-toast", marginLeft: 2 },
      React.createElement(Toast, {
        message: "Operation completed",
        type: "success",
        visible: true,
        durationMs: 0,
      }),
    ),
    blank("b5b"),

    // 6. Timer (counting down from 60s)
    heading("Timer", "h-timer"),
    blank("b6a"),
    React.createElement("tui-box", { key: "d-timer", marginLeft: 2 },
      React.createElement(Timer, {
        startTime: timerStart,
        duration: 60000,
        prefix: "Countdown: ",
        running: true,
      }),
    ),
    blank("b6b"),

    // 7. Stopwatch (counting up)
    heading("Stopwatch", "h-sw"),
    blank("b7a"),
    React.createElement("tui-box", { key: "d-sw", marginLeft: 2 },
      React.createElement(Stopwatch, { running: true, format: "mm:ss" }),
    ),
    blank("b7b"),

    // 8. StatusMessage (all 4 types)
    heading("StatusMessage", "h-status"),
    blank("b8a"),
    React.createElement("tui-box", { key: "d-status", flexDirection: "column", marginLeft: 2, gap: 0 },
      React.createElement(StatusMessage, { type: "success", message: "Build passed" }),
      React.createElement(StatusMessage, { type: "warning", message: "Deprecated API" }),
      React.createElement(StatusMessage, { type: "error", message: "Test failed" }),
      React.createElement(StatusMessage, { type: "info", message: "3 updates available" }),
    ),
    blank("b8b"),

    // 9. Alert
    heading("Alert", "h-alert"),
    blank("b9a"),
    React.createElement("tui-box", { key: "d-alert", marginLeft: 2 },
      React.createElement(Alert, {
        type: "warning",
        title: "Caution",
        children: React.createElement("tui-text", null, "This action cannot be undone."),
      }),
    ),
    blank("b9b"),

    // Footer
    React.createElement("tui-text", { key: "footer", dim: true },
      "  [q] Quit"),
  );
}
