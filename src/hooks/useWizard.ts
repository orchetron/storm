/**
 * useWizard — multi-step flow with per-step validation.
 *
 * Behavior only. Manages current step, validation errors, and
 * navigation between steps. Calls onComplete when advancing
 * past the last step.
 *
 * Uses useRef + forceUpdate().
 */

import { useRef } from "react";
import { useForceUpdate } from "./useForceUpdate.js";

export interface WizardStep {
  key: string;
  label: string;
  validate?: () => string | null; // return error string or null
}

export interface UseWizardOptions {
  steps: WizardStep[];
  onComplete?: () => void;
}

export interface UseWizardResult {
  currentStep: number;
  currentKey: string;
  isFirst: boolean;
  isLast: boolean;
  error: string | null;
  next: () => boolean; // returns false if validation fails
  prev: () => void;
  goTo: (step: number) => void;
  isComplete: boolean;
}

export function useWizard(options: UseWizardOptions): UseWizardResult {
  const { steps, onComplete } = options;
  const forceUpdate = useForceUpdate();

  const stepRef = useRef(0);
  const errorRef = useRef<string | null>(null);
  const completeRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const next = (): boolean => {
    if (completeRef.current) return false;

    const currentSteps = stepsRef.current;
    const current = currentSteps[stepRef.current];
    if (current?.validate) {
      const validationError = current.validate();
      if (validationError !== null) {
        errorRef.current = validationError;
        forceUpdate();
        return false;
      }
    }

    errorRef.current = null;

    if (stepRef.current >= currentSteps.length - 1) {
      // Last step — mark complete
      completeRef.current = true;
      forceUpdate();
      onCompleteRef.current?.();
      return true;
    }

    stepRef.current += 1;
    forceUpdate();
    return true;
  };

  const prev = () => {
    if (stepRef.current > 0) {
      stepRef.current -= 1;
      errorRef.current = null;
      forceUpdate();
    }
  };

  const goTo = (step: number) => {
    if (step >= 0 && step < stepsRef.current.length) {
      stepRef.current = step;
      errorRef.current = null;
      completeRef.current = false;
      forceUpdate();
    }
  };

  const idx = stepRef.current;
  const safeIdx = steps.length > 0 ? Math.min(idx, steps.length - 1) : 0;

  return {
    currentStep: safeIdx,
    currentKey: steps.length > 0 ? steps[safeIdx]!.key : "",
    isFirst: safeIdx === 0,
    isLast: safeIdx === steps.length - 1,
    error: errorRef.current,
    next,
    prev,
    goTo,
    isComplete: completeRef.current,
  };
}
