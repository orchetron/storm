/**
 * Stepper — step-by-step wizard progress indicator.
 *
 * Renders numbered steps connected by lines. Supports horizontal
 * and vertical orientations with completed/active/pending coloring.
 */

import React, { createContext, useContext } from "react";
import { useColors } from "../hooks/useColors.js";
import type { StormLayoutStyleProps } from "../styles/styleProps.js";
import { pickStyleProps } from "../styles/applyStyles.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

// ── Compound Component API ──────────────────────────────────────

export interface StepperContextValue {
  activeStep: number;
  orientation: "horizontal" | "vertical";
  completedColor: string | number;
  activeColor: string | number;
  pendingColor: string | number;
  stepCount: number;
  registerStep: () => number;
}

export const StepperContext = createContext<StepperContextValue | null>(null);

export function useStepperContext(): StepperContextValue {
  const ctx = useContext(StepperContext);
  if (!ctx) throw new Error("Stepper sub-components must be used inside Stepper.Root");
  return ctx;
}

export interface StepperRootProps {
  activeStep: number;
  orientation?: "horizontal" | "vertical";
  completedColor?: string | number;
  activeColor?: string | number;
  pendingColor?: string | number;
  children: React.ReactNode;
}

function StepperRoot({
  activeStep,
  orientation = "horizontal",
  completedColor: completedColorProp,
  activeColor: activeColorProp,
  pendingColor: pendingColorProp,
  children,
}: StepperRootProps): React.ReactElement {
  const colors = useColors();
  const completedColor = completedColorProp ?? colors.success;
  const activeColor = activeColorProp ?? colors.brand.primary;
  const pendingColor = pendingColorProp ?? colors.text.dim;
  const counterRef = { current: 0 };

  const ctx: StepperContextValue = {
    activeStep,
    orientation,
    completedColor,
    activeColor,
    pendingColor,
    stepCount: React.Children.count(children),
    registerStep: () => counterRef.current++,
  };

  return React.createElement(
    StepperContext.Provider,
    { value: ctx },
    React.createElement(
      "tui-box",
      { flexDirection: orientation === "vertical" ? "column" : "row" },
      children,
    ),
  );
}

export interface StepperStepProps {
  index: number;
  label: string;
  description?: string;
  children?: React.ReactNode;
}

function StepperStep({ index, label, description, children }: StepperStepProps): React.ReactElement {
  const colors = useColors();
  const { activeStep, orientation, completedColor, activeColor, pendingColor } = useStepperContext();
  const status = getStatus(index, activeStep);
  const stepColor = getColor(status, completedColor, activeColor, pendingColor);

  if (children) {
    return React.createElement("tui-box", { flexDirection: orientation === "vertical" ? "column" : "row" }, children);
  }

  if (orientation === "vertical") {
    let indicator: string;
    if (status === "completed") indicator = "\u2713";
    else if (status === "active") indicator = "\u25CF";
    else indicator = "\u25CB";

    const elements: React.ReactElement[] = [];
    elements.push(
      React.createElement(
        "tui-box",
        { key: "step", flexDirection: "row" },
        React.createElement("tui-text", { key: "ind", color: stepColor, bold: status === "active" }, `${indicator} `),
        React.createElement("tui-text", { key: "label", color: stepColor, bold: status === "active" }, label),
      ),
    );

    if (description) {
      elements.push(
        React.createElement(
          "tui-text",
          { key: "desc", color: status === "active" ? colors.text.secondary : colors.text.dim },
          `  ${description}`,
        ),
      );
    }

    return React.createElement("tui-box", { flexDirection: "column" }, ...elements);
  }

  // Horizontal
  return React.createElement(
    "tui-text",
    { color: stepColor, bold: status === "active" },
    `${circledNumber(index + 1)} ${label}`,
  );
}

// ── Recipe API (original) ───────────────────────────────────────

export interface StepDef {
  label: string;
  description?: string;
}

export interface StepperProps extends StormLayoutStyleProps {
  steps: StepDef[];
  activeStep: number;
  orientation?: "horizontal" | "vertical";
  completedColor?: string | number;
  activeColor?: string | number;
  pendingColor?: string | number;
  /** Custom render for each step. */
  renderStep?: (step: StepDef, state: { isActive: boolean; isCompleted: boolean; index: number }) => React.ReactNode;
}

type StepStatus = "completed" | "active" | "pending";

function getStatus(index: number, activeStep: number): StepStatus {
  if (index < activeStep) return "completed";
  if (index === activeStep) return "active";
  return "pending";
}

function getColor(
  status: StepStatus,
  completedColor: string | number,
  activeColor: string | number,
  pendingColor: string | number,
): string | number {
  if (status === "completed") return completedColor;
  if (status === "active") return activeColor;
  return pendingColor;
}

// Circled number characters for 1-20
const CIRCLED_NUMBERS = [
  "\u2460", "\u2461", "\u2462", "\u2463", "\u2464",
  "\u2465", "\u2466", "\u2467", "\u2468", "\u2469",
  "\u246A", "\u246B", "\u246C", "\u246D", "\u246E",
  "\u246F", "\u2470", "\u2471", "\u2472", "\u2473",
];

function circledNumber(n: number): string {
  if (n >= 1 && n <= 20) return CIRCLED_NUMBERS[n - 1]!;
  return `(${n})`;
}

function renderHorizontal(
  steps: StepDef[],
  activeStep: number,
  completedColor: string | number,
  activeColor: string | number,
  pendingColor: string | number,
  colors: import("../theme/colors.js").StormColors,
): React.ReactElement {
  const elements: React.ReactElement[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const status = getStatus(i, activeStep);
    const stepColor = getColor(status, completedColor, activeColor, pendingColor);

    // Step circle + label
    elements.push(
      React.createElement(
        "tui-text",
        {
          key: `step-${i}`,
          color: stepColor,
          bold: status === "active",
        },
        `${circledNumber(i + 1)} ${step.label}`,
      ),
    );

    // Connector line (not after last step)
    if (i < steps.length - 1) {
      const connectorColor =
        i < activeStep ? completedColor : pendingColor;
      elements.push(
        React.createElement(
          "tui-text",
          { key: `conn-${i}`, color: connectorColor },
          " \u2500\u2500\u2500 ", // ───
        ),
      );
    }
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    ...elements,
  );
}

function renderVertical(
  steps: StepDef[],
  activeStep: number,
  completedColor: string | number,
  activeColor: string | number,
  pendingColor: string | number,
  colors: import("../theme/colors.js").StormColors,
): React.ReactElement {
  const elements: React.ReactElement[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const status = getStatus(i, activeStep);
    const stepColor = getColor(status, completedColor, activeColor, pendingColor);

    // Status indicator
    let indicator: string;
    if (status === "completed") {
      indicator = "\u2713"; // check mark
    } else if (status === "active") {
      indicator = "\u25CF"; // filled circle
    } else {
      indicator = "\u25CB"; // empty circle
    }

    // Step row: indicator + label
    const stepChildren: React.ReactElement[] = [];
    stepChildren.push(
      React.createElement(
        "tui-text",
        { key: "ind", color: stepColor, bold: status === "active" },
        `${indicator} `,
      ),
    );
    stepChildren.push(
      React.createElement(
        "tui-text",
        { key: "label", color: stepColor, bold: status === "active" },
        step.label,
      ),
    );

    elements.push(
      React.createElement(
        "tui-box",
        { key: `step-${i}`, flexDirection: "row" },
        ...stepChildren,
      ),
    );

    // Description (if present)
    if (step.description) {
      elements.push(
        React.createElement(
          "tui-text",
          {
            key: `desc-${i}`,
            color: status === "active" ? colors.text.secondary : colors.text.dim,
          },
          `  ${step.description}`,
        ),
      );
    }

    // Vertical connector line (not after last step)
    if (i < steps.length - 1) {
      const lineColor =
        i < activeStep ? completedColor : pendingColor;
      elements.push(
        React.createElement(
          "tui-text",
          { key: `line-${i}`, color: lineColor },
          "\u2502", // │
        ),
      );
    }
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    ...elements,
  );
}

const StepperBase = React.memo(function Stepper(rawProps: StepperProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Stepper", rawProps as unknown as Record<string, unknown>) as unknown as StepperProps;
  const {
    steps,
    activeStep: rawActiveStep,
    orientation = "horizontal",
    completedColor = colors.success,
    activeColor = colors.brand.primary,
    pendingColor = colors.text.dim,
  } = props;

  const layoutProps = pickStyleProps(props as unknown as Record<string, unknown>);

  // Allow activeStep >= steps.length to indicate all completed
  const activeStep = steps.length > 0
    ? Math.max(0, rawActiveStep)
    : 0;

  const outerBoxProps: Record<string, unknown> = {
    flexDirection: "column",
    role: "group",
    ...layoutProps,
  };

  // Custom render delegate for each step
  if (props.renderStep) {
    const stepElements = steps.map((step, i) => {
      const status = getStatus(i, activeStep);
      return React.createElement(
        React.Fragment,
        { key: `step-${i}` },
        props.renderStep!(step, { isActive: status === "active", isCompleted: status === "completed", index: i }),
      );
    });
    const customInner = React.createElement(
      "tui-box",
      { flexDirection: orientation === "vertical" ? "column" : "row" },
      ...stepElements,
    );
    if (Object.keys(layoutProps).length === 0) return customInner;
    return React.createElement("tui-box", outerBoxProps, customInner);
  }

  const inner = orientation === "vertical"
    ? renderVertical(steps, activeStep, completedColor, activeColor, pendingColor, colors)
    : renderHorizontal(steps, activeStep, completedColor, activeColor, pendingColor, colors);

  // If no layout style props provided, return inner directly to avoid an extra wrapper
  if (Object.keys(layoutProps).length === 0) {
    return inner;
  }

  return React.createElement("tui-box", outerBoxProps, inner);
});

// ── Static compound assignments ─────────────────────────────────
export const Stepper = Object.assign(StepperBase, {
  Root: StepperRoot,
  Step: StepperStep,
});
