import { useRef, useCallback } from "react";
import { useInput } from "../useInput.js";
import { useForceUpdate } from "../useForceUpdate.js";
import type { KeyEvent } from "../../input/types.js";

export interface FormBehaviorFieldOption {
  label: string;
  value: string;
}

export interface FormBehaviorField {
  key: string;
  label: string;
  type?: "text" | "password" | "number" | "select" | "checkbox" | "radio" | "switch";
  placeholder?: string;
  required?: boolean;
  validate?: (value: string) => string | null;
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  options?: FormBehaviorFieldOption[];
  /** On/Off labels for switch fields. */
  onLabel?: string;
  offLabel?: string;
  asyncValidate?: (value: string) => Promise<string | null>;
}

export interface UseFormBehaviorOptions {
  fields: FormBehaviorField[];
  onSubmit?: ((values: Record<string, string>) => void) | undefined;
  isActive?: boolean | undefined;
  initialValues?: Record<string, string> | undefined;
  onFieldChange?: ((key: string, value: string) => void) | undefined;
  onReset?: (() => void) | undefined;
}

export interface FormFieldState {
  value: string;
  error: string | undefined;
  isFocused: boolean;
  cursorPosition: number;
  isAsyncPending: boolean;
  isSelectOpen: boolean;
  selectHighlightIndex: number;
  isDirty: boolean;
}

export interface UseFormBehaviorResult {
  /** Current field values */
  values: Record<string, string>;
  /** Current validation errors (field key -> error message) */
  errors: ReadonlyMap<string, string>;
  /** Whether all fields pass validation */
  isValid: boolean;
  /** Index of the currently focused field (fields.length = submit button) */
  focusedIndex: number;
  /** Whether the submit button is focused */
  isSubmitFocused: boolean;
  /** Whether any field has been modified from its initial value */
  isDirty: boolean;
  /** Get props for a specific field */
  getFieldProps: (key: string) => FormFieldState;
  /** Submit the form */
  submit: () => boolean;
  /** Reset the form to initial values */
  reset: () => void;
  /** Undo the last text edit for a specific field (returns true if undo was performed) */
  undo: (key: string) => boolean;
}

export function useFormBehavior(options: UseFormBehaviorOptions): UseFormBehaviorResult {
  const {
    fields,
    onSubmit,
    isActive = true,
    initialValues,
    onFieldChange,
    onReset,
  } = options;

  const forceUpdate = useForceUpdate();

  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const onFieldChangeRef = useRef(onFieldChange);
  onFieldChangeRef.current = onFieldChange;
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;
  const initialValuesRef = useRef(initialValues);
  initialValuesRef.current = initialValues;

  const activeIndexRef = useRef(0);
  const valuesRef = useRef<Record<string, string>>({});
  const cursorsRef = useRef<Record<string, number>>({});
  const errorsRef = useRef<Map<string, string>>(new Map());
  const initializedRef = useRef(false);

  const selectOpenRef = useRef<string | null>(null);
  const selectHighlightRef = useRef<Record<string, number>>({});
  const asyncStateRef = useRef<Record<string, "pending" | string | null>>({});
  const asyncSeqRef = useRef<Record<string, number>>({});

  // Dirty tracking: track initial values snapshot for comparison
  const dirtyInitialRef = useRef<Record<string, string>>({});

  // Undo state for text fields: store previous value before each edit
  const undoStackRef = useRef<Record<string, string[]>>({});

  /** Validate a single field. */
  const validateField = (field: FormBehaviorField, value: string): string | null => {
    if (field.type === "checkbox" || field.type === "switch") return null;
    if (field.type === "radio") {
      if (field.required && value.length === 0) return `${field.label} is required`;
      return null;
    }
    if (field.type === "select") {
      if (field.required && value.length === 0) return `${field.label} is required`;
      return null;
    }
    if (field.required && value.length === 0) return `${field.label} is required`;
    if (field.minLength !== undefined && value.length > 0 && value.length < field.minLength) {
      return `Minimum ${field.minLength} characters`;
    }
    if (field.maxLength !== undefined && value.length > field.maxLength) {
      return `Maximum ${field.maxLength} characters`;
    }
    if (field.pattern !== undefined && value.length > 0 && !field.pattern.test(value)) {
      return `Invalid format`;
    }
    if (field.validate) return field.validate(value);
    return null;
  };

  for (const field of fields) {
    if (valuesRef.current[field.key] === undefined) {
      const initial = initialValues?.[field.key];
      if (field.type === "checkbox" || field.type === "switch") {
        valuesRef.current[field.key] = initial ?? "false";
      } else {
        valuesRef.current[field.key] = initial ?? "";
      }
    }
    if (cursorsRef.current[field.key] === undefined) {
      cursorsRef.current[field.key] = (valuesRef.current[field.key] ?? "").length;
    }
    if (selectHighlightRef.current[field.key] === undefined) {
      selectHighlightRef.current[field.key] = 0;
    }
    if (undoStackRef.current[field.key] === undefined) {
      undoStackRef.current[field.key] = [];
    }
  }

  if (!initializedRef.current && initialValues) {
    initializedRef.current = true;
    for (const [key, val] of Object.entries(initialValues)) {
      valuesRef.current[key] = val;
      cursorsRef.current[key] = val.length;
      dirtyInitialRef.current[key] = val;
    }
    // Also snapshot keys that weren't in initialValues
    for (const field of fields) {
      if (dirtyInitialRef.current[field.key] === undefined) {
        dirtyInitialRef.current[field.key] = valuesRef.current[field.key] ?? "";
      }
    }
  } else if (!initializedRef.current) {
    initializedRef.current = true;
    for (const field of fields) {
      dirtyInitialRef.current[field.key] = valuesRef.current[field.key] ?? "";
    }
  }

  const totalItems = fields.length + 1;

  /** Push the current value onto the undo stack for a field before modifying it. */
  const pushUndo = (key: string): void => {
    const stack = undoStackRef.current[key];
    if (stack) {
      stack.push(valuesRef.current[key] ?? "");
    }
  };

  /** Toggle a boolean string field between "true" and "false". */
  const toggleBoolField = (fieldKey: string): void => {
    const currentVal = valuesRef.current[fieldKey];
    const newVal = currentVal === "true" ? "false" : "true";
    valuesRef.current[fieldKey] = newVal;
    onFieldChangeRef.current?.(fieldKey, newVal);
    forceUpdate();
  };

  const handleInput = useCallback((event: KeyEvent) => {
    const idx = activeIndexRef.current;
    const isOnSubmit = idx >= fields.length;

    // Escape: close select dropdown or reset form
    if (event.key === "escape") {
      if (selectOpenRef.current !== null) {
        selectOpenRef.current = null;
        forceUpdate();
        return;
      }
      const initVals = initialValuesRef.current ?? {};
      for (const f of fields) {
        if (f.type === "checkbox" || f.type === "switch") {
          valuesRef.current[f.key] = initVals[f.key] ?? "false";
        } else {
          valuesRef.current[f.key] = initVals[f.key] ?? "";
        }
        cursorsRef.current[f.key] = (valuesRef.current[f.key] ?? "").length;
      }
      errorsRef.current.clear();
      onResetRef.current?.();
      forceUpdate();
      return;
    }

    // Select dropdown input
    if (selectOpenRef.current !== null) {
      const selectField = fields.find((f) => f.key === selectOpenRef.current);
      if (selectField && selectField.options) {
        const opts = selectField.options;
        const hIdx = selectHighlightRef.current[selectField.key] ?? 0;

        if (event.key === "up") {
          selectHighlightRef.current[selectField.key] = hIdx > 0 ? hIdx - 1 : opts.length - 1;
          forceUpdate();
        } else if (event.key === "down") {
          selectHighlightRef.current[selectField.key] = hIdx < opts.length - 1 ? hIdx + 1 : 0;
          forceUpdate();
        } else if (event.key === "return") {
          const opt = opts[selectHighlightRef.current[selectField.key] ?? 0];
          if (opt) {
            valuesRef.current[selectField.key] = opt.value;
            onFieldChangeRef.current?.(selectField.key, opt.value);
          }
          selectOpenRef.current = null;
          forceUpdate();
        }
        return;
      }
    }

    // Tab navigation
    if (event.key === "tab") {
      if (!isOnSubmit) {
        const blurField = fields[idx];
        if (blurField) {
          const val = valuesRef.current[blurField.key] ?? "";
          const err = validateField(blurField, val);
          if (err) {
            errorsRef.current.set(blurField.key, err);
          } else {
            errorsRef.current.delete(blurField.key);
          }
          // Async validation
          if (blurField.asyncValidate) {
            const seq = (asyncSeqRef.current[blurField.key] ?? 0) + 1;
            asyncSeqRef.current[blurField.key] = seq;
            asyncStateRef.current[blurField.key] = "pending";
            const fieldKey = blurField.key;
            blurField.asyncValidate(val).then(
              (result) => {
                if (asyncSeqRef.current[fieldKey] === seq) {
                  asyncStateRef.current[fieldKey] = result;
                  if (result) {
                    errorsRef.current.set(fieldKey, result);
                  } else {
                    const currentErr = errorsRef.current.get(fieldKey);
                    if (currentErr === "pending") errorsRef.current.delete(fieldKey);
                  }
                  forceUpdate();
                }
              },
              () => {
                if (asyncSeqRef.current[fieldKey] === seq) {
                  asyncStateRef.current[fieldKey] = "Validation failed";
                  errorsRef.current.set(fieldKey, "Validation failed");
                  forceUpdate();
                }
              },
            );
          }
        }
      }
      if (event.shift) {
        activeIndexRef.current = idx > 0 ? idx - 1 : totalItems - 1;
      } else {
        activeIndexRef.current = idx < totalItems - 1 ? idx + 1 : 0;
      }
      forceUpdate();
      return;
    }

    // Enter
    if (event.key === "return") {
      if (isOnSubmit) {
        let hasErrors = false;
        for (const f of fields) {
          const val = valuesRef.current[f.key] ?? "";
          const err = validateField(f, val);
          if (err) {
            errorsRef.current.set(f.key, err);
            hasErrors = true;
          } else {
            errorsRef.current.delete(f.key);
          }
        }
        if (hasErrors) { forceUpdate(); return; }
        onSubmitRef.current?.({ ...valuesRef.current });
        return;
      }

      const field = fields[idx];
      if (field) {
        if (field.type === "select") {
          if (selectOpenRef.current === field.key) {
            selectOpenRef.current = null;
          } else {
            selectOpenRef.current = field.key;
            const currentVal = valuesRef.current[field.key] ?? "";
            const optIdx = (field.options ?? []).findIndex((o) => o.value === currentVal);
            selectHighlightRef.current[field.key] = optIdx >= 0 ? optIdx : 0;
          }
          forceUpdate();
          return;
        }
        if (field.type === "checkbox") {
          toggleBoolField(field.key);
          return;
        }
        if (field.type === "switch") {
          toggleBoolField(field.key);
          return;
        }
        if (field.type === "radio") {
          const opts = field.options ?? [];
          const hIdx = selectHighlightRef.current[field.key] ?? 0;
          const opt = opts[hIdx];
          if (opt) {
            valuesRef.current[field.key] = opt.value;
            onFieldChangeRef.current?.(field.key, opt.value);
          }
          forceUpdate();
          return;
        }
      }
      activeIndexRef.current = idx + 1;
      forceUpdate();
      return;
    }

    if (isOnSubmit) return;

    const field = fields[idx];
    if (!field) return;

    // Checkbox toggle
    if (field.type === "checkbox") {
      if (event.key === "space" || event.char === " ") {
        toggleBoolField(field.key);
      }
      if (event.key === "up" && idx > 0) { activeIndexRef.current = idx - 1; forceUpdate(); }
      if (event.key === "down" && idx < totalItems - 1) { activeIndexRef.current = idx + 1; forceUpdate(); }
      return;
    }

    // Switch toggle
    if (field.type === "switch") {
      if (event.key === "space" || event.char === " ") {
        toggleBoolField(field.key);
      }
      if (event.key === "up" && idx > 0) { activeIndexRef.current = idx - 1; forceUpdate(); }
      if (event.key === "down" && idx < totalItems - 1) { activeIndexRef.current = idx + 1; forceUpdate(); }
      return;
    }

    // Radio navigation
    if (field.type === "radio") {
      const opts = field.options ?? [];
      const hIdx = selectHighlightRef.current[field.key] ?? 0;
      if (event.key === "up") {
        if (hIdx > 0) {
          selectHighlightRef.current[field.key] = hIdx - 1;
          forceUpdate();
        } else if (idx > 0) {
          activeIndexRef.current = idx - 1;
          forceUpdate();
        }
      } else if (event.key === "down") {
        if (hIdx < opts.length - 1) {
          selectHighlightRef.current[field.key] = hIdx + 1;
          forceUpdate();
        } else if (idx < totalItems - 1) {
          activeIndexRef.current = idx + 1;
          forceUpdate();
        }
      } else if (event.char === " ") {
        const opt = opts[hIdx];
        if (opt) {
          valuesRef.current[field.key] = opt.value;
          onFieldChangeRef.current?.(field.key, opt.value);
          forceUpdate();
        }
      }
      return;
    }

    // Select navigation (when dropdown is closed)
    if (field.type === "select") {
      if (event.key === "up" && idx > 0) { activeIndexRef.current = idx - 1; forceUpdate(); }
      else if (event.key === "down" && idx < totalItems - 1) { activeIndexRef.current = idx + 1; forceUpdate(); }
      return;
    }

    // Text input
    const currentValue = valuesRef.current[field.key] ?? "";
    const cursorPos = cursorsRef.current[field.key] ?? 0;

    if (event.key === "backspace") {
      if (cursorPos > 0) {
        pushUndo(field.key);
        const newVal = currentValue.slice(0, cursorPos - 1) + currentValue.slice(cursorPos);
        valuesRef.current[field.key] = newVal;
        cursorsRef.current[field.key] = cursorPos - 1;
        onFieldChangeRef.current?.(field.key, newVal);
        forceUpdate();
      }
      return;
    }
    if (event.key === "delete") {
      if (cursorPos < currentValue.length) {
        pushUndo(field.key);
        const newVal = currentValue.slice(0, cursorPos) + currentValue.slice(cursorPos + 1);
        valuesRef.current[field.key] = newVal;
        onFieldChangeRef.current?.(field.key, newVal);
        forceUpdate();
      }
      return;
    }
    if (event.key === "left") { if (cursorPos > 0) { cursorsRef.current[field.key] = cursorPos - 1; forceUpdate(); } return; }
    if (event.key === "right") { if (cursorPos < currentValue.length) { cursorsRef.current[field.key] = cursorPos + 1; forceUpdate(); } return; }
    if (event.key === "home") { cursorsRef.current[field.key] = 0; forceUpdate(); return; }
    if (event.key === "end") { cursorsRef.current[field.key] = currentValue.length; forceUpdate(); return; }
    if (event.key === "up" && idx > 0) { activeIndexRef.current = idx - 1; forceUpdate(); return; }
    if (event.key === "down" && idx < totalItems - 1) { activeIndexRef.current = idx + 1; forceUpdate(); return; }

    // Printable character
    if (event.char && event.char.length === 1 && !event.ctrl && !event.meta) {
      if (field.type === "number") {
        const newVal = currentValue.slice(0, cursorPos) + event.char + currentValue.slice(cursorPos);
        if (!/^-?\d*\.?\d*$/.test(newVal)) return;
      }
      pushUndo(field.key);
      const newVal = currentValue.slice(0, cursorPos) + event.char + currentValue.slice(cursorPos);
      valuesRef.current[field.key] = newVal;
      cursorsRef.current[field.key] = cursorPos + 1;
      onFieldChangeRef.current?.(field.key, newVal);
      forceUpdate();
    }
  }, [fields, totalItems, forceUpdate]);

  useInput(handleInput, { isActive });

  let isValid = true;
  for (const field of fields) {
    const val = valuesRef.current[field.key] ?? "";
    if (validateField(field, val) !== null) { isValid = false; break; }
  }

  let isDirty = false;
  for (const field of fields) {
    const current = valuesRef.current[field.key] ?? "";
    const initial = dirtyInitialRef.current[field.key] ?? "";
    if (current !== initial) { isDirty = true; break; }
  }

  const submit = useCallback((): boolean => {
    let hasErrors = false;
    for (const f of fields) {
      const val = valuesRef.current[f.key] ?? "";
      const err = validateField(f, val);
      if (err) {
        errorsRef.current.set(f.key, err);
        hasErrors = true;
      } else {
        errorsRef.current.delete(f.key);
      }
    }
    if (hasErrors) {
      forceUpdate();
      return false;
    }
    onSubmitRef.current?.({ ...valuesRef.current });
    return true;
  }, [fields, forceUpdate]);

  const reset = useCallback(() => {
    const initVals = initialValuesRef.current ?? {};
    for (const f of fields) {
      if (f.type === "checkbox" || f.type === "switch") {
        valuesRef.current[f.key] = initVals[f.key] ?? "false";
      } else {
        valuesRef.current[f.key] = initVals[f.key] ?? "";
      }
      cursorsRef.current[f.key] = (valuesRef.current[f.key] ?? "").length;
      undoStackRef.current[f.key] = [];
    }
    errorsRef.current.clear();
    onResetRef.current?.();
    forceUpdate();
  }, [fields, forceUpdate]);

  const undo = useCallback((key: string): boolean => {
    const stack = undoStackRef.current[key];
    if (!stack || stack.length === 0) return false;
    const prevValue = stack.pop()!;
    valuesRef.current[key] = prevValue;
    cursorsRef.current[key] = prevValue.length;
    onFieldChangeRef.current?.(key, prevValue);
    forceUpdate();
    return true;
  }, [forceUpdate]);

  const getFieldProps = useCallback((key: string): FormFieldState => {
    const fieldIndex = fields.findIndex((f) => f.key === key);
    const current = valuesRef.current[key] ?? "";
    const initial = dirtyInitialRef.current[key] ?? "";
    return {
      value: current,
      error: errorsRef.current.get(key),
      isFocused: fieldIndex === activeIndexRef.current,
      cursorPosition: cursorsRef.current[key] ?? 0,
      isAsyncPending: asyncStateRef.current[key] === "pending",
      isSelectOpen: selectOpenRef.current === key,
      selectHighlightIndex: selectHighlightRef.current[key] ?? 0,
      isDirty: current !== initial,
    };
  }, [fields]);

  return {
    values: valuesRef.current,
    errors: errorsRef.current,
    isValid,
    focusedIndex: activeIndexRef.current,
    isSubmitFocused: activeIndexRef.current >= fields.length,
    isDirty,
    getFieldProps,
    submit,
    reset,
    undo,
  };
}
