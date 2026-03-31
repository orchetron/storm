/**
 * useStepperBehavior — headless behavior hook for step-by-step wizards.
 *
 * Extracts active step, completed steps, and navigation from the Stepper component.
 * The Stepper component itself is purely presentational with no keyboard input,
 * so this hook provides programmatic step management.
 *
 * Returns state + props objects with no JSX.
 */

import { useRef, useCallback } from "react";
import { useTui } from "../../context/TuiContext.js";

export interface StepBehaviorDef {
  label: string;
  description?: string;
}

export type StepStatus = "completed" | "active" | "pending";

export interface UseStepperBehaviorOptions {
  steps: StepBehaviorDef[];
  activeStep: number;
  onStepChange?: (step: number) => void;
}

export interface UseStepperBehaviorResult {
  /** The current active step index */
  activeStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Check if a step at the given index is complete */
  isComplete: (index: number) => boolean;
  /** Get the status of a step ("completed" | "active" | "pending") */
  getStatus: (index: number) => StepStatus;
  /** Go to the next step */
  next: () => void;
  /** Go to the previous step */
  prev: () => void;
  /** Go to a specific step */
  goTo: (step: number) => void;
  /** Whether all steps are complete */
  isAllComplete: boolean;
  /** Get props for a step by its index */
  stepProps: (index: number) => {
    status: StepStatus;
    isComplete: boolean;
    isActive: boolean;
    isPending: boolean;
    label: string;
    description: string | undefined;
    index: number;
  };
}

export function useStepperBehavior(options: UseStepperBehaviorOptions): UseStepperBehaviorResult {
  const {
    steps,
    activeStep: rawActiveStep,
    onStepChange,
  } = options;

  const { requestRender } = useTui();

  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;

  // Allow activeStep >= steps.length to indicate all completed
  const activeStep = steps.length > 0
    ? Math.max(0, rawActiveStep)
    : 0;

  const isComplete = useCallback((index: number): boolean => {
    return index < activeStep;
  }, [activeStep]);

  const getStatus = useCallback((index: number): StepStatus => {
    if (index < activeStep) return "completed";
    if (index === activeStep) return "active";
    return "pending";
  }, [activeStep]);

  const next = useCallback(() => {
    const cb = onStepChangeRef.current;
    if (cb) {
      cb(activeStep + 1);
    }
  }, [activeStep]);

  const prev = useCallback(() => {
    const cb = onStepChangeRef.current;
    if (cb && activeStep > 0) {
      cb(activeStep - 1);
    }
  }, [activeStep]);

  const goTo = useCallback((step: number) => {
    const cb = onStepChangeRef.current;
    if (cb) {
      cb(Math.max(0, step));
    }
  }, []);

  const stepProps = useCallback((index: number) => {
    const status = getStatus(index);
    const step = steps[index];
    return {
      status,
      isComplete: index < activeStep,
      isActive: index === activeStep,
      isPending: index > activeStep,
      label: step?.label ?? "",
      description: step?.description,
      index,
    };
  }, [steps, activeStep, getStatus]);

  return {
    activeStep,
    totalSteps: steps.length,
    isComplete,
    getStatus,
    next,
    prev,
    goTo,
    isAllComplete: activeStep >= steps.length,
    stepProps,
  };
}
