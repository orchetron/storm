/**
 * Form — multi-field form container with keyboard navigation.
 *
 * Renders a vertical list of labeled input fields with Tab/Enter
 * navigation. Handles text input directly via useInput (no TextInput
 * sub-component). Supports text, password, number, select, and checkbox field types.
 *
 * Features:
 * - `type: "select"` field with inline dropdown options
 * - `type: "checkbox"` field with toggle
 * - `initialValues` prop for pre-populating fields
 * - `onFieldChange` callback for individual field changes
 * - `onReset` prop + Escape key resets to initialValues
 */

import React, { useRef, useCallback, createContext, useContext } from "react";
import { useInput } from "../hooks/useInput.js";
import { useTui } from "../context/TuiContext.js";
import { useColors } from "../hooks/useColors.js";
import type { KeyEvent } from "../input/types.js";
import type { StormContainerStyleProps } from "../styles/styleProps.js";
import { mergeBoxStyles, pickStyleProps } from "../styles/applyStyles.js";
import { usePluginProps } from "../hooks/usePluginProps.js";

// ── Compound Component API ──────────────────────────────────────

export interface FormContextValue {
  values: Record<string, string>;
  setValue: (name: string, value: string) => void;
  errors: Map<string, string>;
  setError: (name: string, error: string | null) => void;
  activeField: string | null;
  setActiveField: (name: string | null) => void;
  submit: () => void;
}

export const FormContext = createContext<FormContextValue | null>(null);

export function useFormContext(): FormContextValue {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("Form sub-components must be used inside Form.Root");
  return ctx;
}

export interface FormRootProps {
  onSubmit?: (values: Record<string, string>) => void;
  initialValues?: Record<string, string>;
  children: React.ReactNode;
}

function FormRoot({ onSubmit, initialValues = {}, children }: FormRootProps): React.ReactElement {
  const colors = useColors();
  const { requestRender } = useTui();
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const valuesRef = useRef<Record<string, string>>({ ...initialValues });
  const errorsRef = useRef<Map<string, string>>(new Map());
  const activeFieldRef = useRef<string | null>(null);

  const ctx: FormContextValue = {
    values: valuesRef.current,
    setValue: (name: string, value: string) => {
      valuesRef.current[name] = value;
      requestRender();
    },
    errors: errorsRef.current,
    setError: (name: string, error: string | null) => {
      if (error) {
        errorsRef.current.set(name, error);
      } else {
        errorsRef.current.delete(name);
      }
      requestRender();
    },
    activeField: activeFieldRef.current,
    setActiveField: (name: string | null) => {
      activeFieldRef.current = name;
      requestRender();
    },
    submit: () => {
      onSubmitRef.current?.({ ...valuesRef.current });
    },
  };

  return React.createElement(
    FormContext.Provider,
    { value: ctx },
    React.createElement("tui-box", { flexDirection: "column" }, children),
  );
}

export interface FormCompoundFieldProps {
  name: string;
  type?: "text" | "password" | "number" | "select" | "checkbox" | "radio" | "switch";
  label?: string;
  validate?: (value: string) => string | null;
  children?: React.ReactNode;
}

function FormCompoundField({ name, type = "text", label, validate, children }: FormCompoundFieldProps): React.ReactElement {
  const colors = useColors();
  const { values, setValue, errors, setError, activeField } = useFormContext();
  const value = values[name] ?? "";
  const error = errors.get(name);
  const isActive = activeField === name;
  const displayLabel = label ?? name;

  if (children) {
    return React.createElement("tui-box", { flexDirection: "column" }, children);
  }

  const elements: React.ReactElement[] = [];

  // Label + value
  const labelText = `${displayLabel}: `;
  let displayValue = value;
  if (type === "password") {
    displayValue = "\u2022".repeat(value.length);
  }
  if (type === "checkbox") {
    const isChecked = value === "true";
    const checkMark = isChecked ? "\u2713" : " ";
    elements.push(
      React.createElement(
        "tui-box",
        { key: "field", flexDirection: "row" },
        React.createElement("tui-text", { key: "ind", color: isActive ? colors.brand.primary : undefined }, isActive ? "\u276F " : "  "),
        React.createElement("tui-text", { key: "check", color: isChecked ? colors.success : colors.text.dim }, `[${checkMark}]`),
        React.createElement("tui-text", { key: "label", color: isActive ? colors.text.primary : colors.text.secondary, bold: isActive }, ` ${displayLabel}`),
      ),
    );
  } else {
    elements.push(
      React.createElement(
        "tui-box",
        { key: "field", flexDirection: "row" },
        React.createElement("tui-text", { key: "ind", color: isActive ? colors.brand.primary : undefined }, isActive ? "\u276F " : "  "),
        React.createElement("tui-text", { key: "label", color: colors.text.dim, bold: isActive }, labelText),
        React.createElement("tui-text", { key: "bo", color: isActive ? colors.input.borderActive : colors.input.border }, "["),
        React.createElement("tui-text", { key: "val", color: value.length === 0 ? colors.text.disabled : colors.text.primary }, displayValue || " "),
        React.createElement("tui-text", { key: "bc", color: isActive ? colors.input.borderActive : colors.input.border }, "]"),
      ),
    );
  }

  // Error
  if (error) {
    elements.push(
      React.createElement(
        "tui-box",
        { key: "err", flexDirection: "row" },
        React.createElement("tui-text", { color: colors.error }, `    \u2716 ${error}`),
      ),
    );
  }

  return React.createElement("tui-box", { flexDirection: "column" }, ...elements);
}

export interface FormCompoundSubmitProps {
  label?: string;
  children?: React.ReactNode;
}

function FormCompoundSubmit({ label = "Submit", children }: FormCompoundSubmitProps): React.ReactElement {
  const colors = useColors();
  const { submit } = useFormContext();

  if (children) {
    return React.createElement("tui-box", { flexDirection: "row", marginTop: 1 }, children);
  }

  return React.createElement(
    "tui-box",
    { flexDirection: "row", marginTop: 1 },
    React.createElement("tui-text", { key: "ind" }, "  "),
    React.createElement(
      "tui-text",
      { key: "btn", color: colors.brand.primary },
      `[ ${label} ]`,
    ),
  );
}

// ── Recipe API (original) ───────────────────────────────────────

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormField {
  key: string;
  label: string;
  type?: "text" | "password" | "number" | "select" | "checkbox" | "radio" | "switch";
  placeholder?: string;
  required?: boolean;
  validate?: (value: string) => string | null;
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  /** Options for select and radio field types. */
  options?: FormFieldOption[];
  /** On/Off labels for switch fields. */
  onLabel?: string;
  offLabel?: string;
  /** Async validation function called on blur (Tab away). Shows "validating..." while pending. */
  asyncValidate?: (value: string) => Promise<string | null>;
}

export interface FormProps extends StormContainerStyleProps {
  fields: FormField[];
  onSubmit?: (values: Record<string, string>) => void;
  isFocused?: boolean;
  submitLabel?: string;
  /** Initial values for pre-populating fields. */
  initialValues?: Record<string, string>;
  /** Callback fired when any individual field value changes. */
  onFieldChange?: (key: string, value: string) => void;
  /** Callback fired when form is reset (Escape key). */
  onReset?: () => void;
  /** Custom render for each form field row. */
  renderField?: (field: FormField, state: { value: string; error: string | null; isFocused: boolean }) => React.ReactNode;
  "aria-label"?: string;
}

const FormBase = React.memo(function Form(rawProps: FormProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Form", rawProps as unknown as Record<string, unknown>) as unknown as FormProps;
  const {
    fields,
    onSubmit,
    isFocused = true,
    submitLabel = "Submit",
    color = colors.brand.primary,
    initialValues,
    onFieldChange,
    onReset,
  } = props;

  const userStyles = pickStyleProps(props as unknown as Record<string, unknown>);

  const { requestRender } = useTui();

  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const onFieldChangeRef = useRef(onFieldChange);
  onFieldChangeRef.current = onFieldChange;
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;
  const initialValuesRef = useRef(initialValues);
  initialValuesRef.current = initialValues;

  // activeIndex: 0..fields.length-1 = field, fields.length = submit button
  const activeIndexRef = useRef(0);
  const valuesRef = useRef<Record<string, string>>({});
  const cursorsRef = useRef<Record<string, number>>({});
  const errorsRef = useRef<Map<string, string>>(new Map());
  // Track whether values have been initialized
  const initializedRef = useRef(false);

  // For select fields: track which select dropdown is open
  const selectOpenRef = useRef<string | null>(null);
  const selectHighlightRef = useRef<Record<string, number>>({});
  // Async validation state per field: "pending" | error string | null (valid)
  const asyncStateRef = useRef<Record<string, "pending" | string | null>>({});
  // Counter to ignore stale async results
  const asyncSeqRef = useRef<Record<string, number>>({});

  /** Validate a single field. Returns error message or null. */
  const validateField = (field: FormField, value: string): string | null => {
    if (field.type === "checkbox" || field.type === "switch") return null; // toggle fields don't validate
    if (field.type === "radio") {
      if (field.required && value.length === 0) {
        return `${field.label} is required`;
      }
      return null;
    }
    if (field.type === "select") {
      if (field.required && value.length === 0) {
        return `${field.label} is required`;
      }
      return null;
    }
    if (field.required && value.length === 0) {
      return `${field.label} is required`;
    }
    if (field.minLength !== undefined && value.length > 0 && value.length < field.minLength) {
      return `Minimum ${field.minLength} characters`;
    }
    if (field.maxLength !== undefined && value.length > field.maxLength) {
      return `Maximum ${field.maxLength} characters`;
    }
    if (field.pattern !== undefined && value.length > 0 && !field.pattern.test(value)) {
      return `Invalid format`;
    }
    if (field.validate) {
      return field.validate(value);
    }
    return null;
  };

  // Initialize values and cursors for new fields
  for (const field of fields) {
    if (valuesRef.current[field.key] === undefined) {
      // Use initialValues if available
      const initial = initialValues?.[field.key];
      if (field.type === "checkbox" || field.type === "switch") {
        valuesRef.current[field.key] = initial ?? "false";
      } else {
        valuesRef.current[field.key] = initial ?? "";
      }
    }
    if (cursorsRef.current[field.key] === undefined) {
      const val = valuesRef.current[field.key] ?? "";
      cursorsRef.current[field.key] = val.length;
    }
    if (selectHighlightRef.current[field.key] === undefined) {
      selectHighlightRef.current[field.key] = 0;
    }
  }

  // Apply initialValues on first render if not yet initialized
  if (!initializedRef.current && initialValues) {
    initializedRef.current = true;
    for (const [key, val] of Object.entries(initialValues)) {
      valuesRef.current[key] = val;
      cursorsRef.current[key] = val.length;
    }
  }

  const totalItems = fields.length + 1; // fields + submit button

  const handleInput = useCallback((event: KeyEvent) => {
    const idx = activeIndexRef.current;
    const isOnSubmit = idx >= fields.length;

    // Escape: if a select dropdown is open, close it. Otherwise reset form.
    if (event.key === "escape") {
      if (selectOpenRef.current !== null) {
        selectOpenRef.current = null;
        requestRender();
        return;
      }
      // Reset to initialValues
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
      requestRender();
      return;
    }

    // If a select dropdown is open, handle its input
    if (selectOpenRef.current !== null) {
      const selectField = fields.find((f) => f.key === selectOpenRef.current);
      if (selectField && selectField.options) {
        const opts = selectField.options;
        const hIdx = selectHighlightRef.current[selectField.key] ?? 0;

        if (event.key === "up") {
          selectHighlightRef.current[selectField.key] = hIdx > 0 ? hIdx - 1 : opts.length - 1;
          requestRender();
        } else if (event.key === "down") {
          selectHighlightRef.current[selectField.key] = hIdx < opts.length - 1 ? hIdx + 1 : 0;
          requestRender();
        } else if (event.key === "return") {
          const opt = opts[selectHighlightRef.current[selectField.key] ?? 0];
          if (opt) {
            valuesRef.current[selectField.key] = opt.value;
            onFieldChangeRef.current?.(selectField.key, opt.value);
          }
          selectOpenRef.current = null;
          requestRender();
        }
        return;
      }
    }

    // Tab / shift-tab navigation
    if (event.key === "tab") {
      // Validate current field on blur (Tab away)
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
          // Trigger async validation if present
          if (blurField.asyncValidate) {
            const seq = (asyncSeqRef.current[blurField.key] ?? 0) + 1;
            asyncSeqRef.current[blurField.key] = seq;
            asyncStateRef.current[blurField.key] = "pending";
            const fieldKey = blurField.key;
            const asyncFn = blurField.asyncValidate;
            asyncFn(val).then(
              (result) => {
                // Only apply if this is still the latest async call for this field
                if (asyncSeqRef.current[fieldKey] === seq) {
                  asyncStateRef.current[fieldKey] = result;
                  if (result) {
                    errorsRef.current.set(fieldKey, result);
                  } else {
                    // Only clear error if sync validation also passes
                    const currentSyncErr = errorsRef.current.get(fieldKey);
                    if (currentSyncErr && currentSyncErr === "pending") {
                      errorsRef.current.delete(fieldKey);
                    }
                  }
                  requestRender();
                }
              },
              () => {
                if (asyncSeqRef.current[fieldKey] === seq) {
                  asyncStateRef.current[fieldKey] = "Validation failed";
                  errorsRef.current.set(fieldKey, "Validation failed");
                  requestRender();
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
      requestRender();
      return;
    }

    // Enter on submit button
    if (event.key === "return") {
      if (isOnSubmit) {
        // Validate all fields before submit
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
          requestRender();
          return;
        }
        const cb = onSubmitRef.current;
        if (cb) {
          cb({ ...valuesRef.current });
        }
        return;
      }

      // Handle field-specific Enter behavior
      const field = fields[idx];
      if (field) {
        if (field.type === "select") {
          // Toggle select dropdown
          if (selectOpenRef.current === field.key) {
            selectOpenRef.current = null;
          } else {
            selectOpenRef.current = field.key;
            // Sync highlight to current value
            const currentVal = valuesRef.current[field.key] ?? "";
            const optIdx = (field.options ?? []).findIndex((o) => o.value === currentVal);
            selectHighlightRef.current[field.key] = optIdx >= 0 ? optIdx : 0;
          }
          requestRender();
          return;
        }
        if (field.type === "checkbox") {
          // Toggle checkbox
          const currentVal = valuesRef.current[field.key];
          const newVal = currentVal === "true" ? "false" : "true";
          valuesRef.current[field.key] = newVal;
          onFieldChangeRef.current?.(field.key, newVal);
          requestRender();
          return;
        }
        if (field.type === "switch") {
          // Toggle switch
          const currentVal = valuesRef.current[field.key];
          const newVal = currentVal === "true" ? "false" : "true";
          valuesRef.current[field.key] = newVal;
          onFieldChangeRef.current?.(field.key, newVal);
          requestRender();
          return;
        }
        if (field.type === "radio") {
          // Select the highlighted radio option
          const opts = field.options ?? [];
          const hIdx = selectHighlightRef.current[field.key] ?? 0;
          const opt = opts[hIdx];
          if (opt) {
            valuesRef.current[field.key] = opt.value;
            onFieldChangeRef.current?.(field.key, opt.value);
          }
          requestRender();
          return;
        }
      }

      // Enter on text field moves to next
      activeIndexRef.current = idx + 1;
      requestRender();
      return;
    }

    // If on submit button, ignore other keys
    if (isOnSubmit) return;

    const field = fields[idx];
    if (!field) return;

    // Checkbox: Space toggles
    if (field.type === "checkbox") {
      if (event.key === "space" || event.char === " ") {
        const currentVal = valuesRef.current[field.key];
        const newVal = currentVal === "true" ? "false" : "true";
        valuesRef.current[field.key] = newVal;
        onFieldChangeRef.current?.(field.key, newVal);
        requestRender();
      }
      if (event.key === "up") {
        if (idx > 0) {
          activeIndexRef.current = idx - 1;
          requestRender();
        }
      }
      if (event.key === "down") {
        if (idx < totalItems - 1) {
          activeIndexRef.current = idx + 1;
          requestRender();
        }
      }
      return;
    }

    // Switch: Space/Enter toggles
    if (field.type === "switch") {
      if (event.key === "space" || event.char === " ") {
        const currentVal = valuesRef.current[field.key];
        const newVal = currentVal === "true" ? "false" : "true";
        valuesRef.current[field.key] = newVal;
        onFieldChangeRef.current?.(field.key, newVal);
        requestRender();
      }
      if (event.key === "up") {
        if (idx > 0) {
          activeIndexRef.current = idx - 1;
          requestRender();
        }
      }
      if (event.key === "down") {
        if (idx < totalItems - 1) {
          activeIndexRef.current = idx + 1;
          requestRender();
        }
      }
      return;
    }

    // Radio: Up/Down cycles options within the group, Space selects
    if (field.type === "radio") {
      const opts = field.options ?? [];
      const hIdx = selectHighlightRef.current[field.key] ?? 0;
      if (event.key === "up") {
        if (hIdx > 0) {
          selectHighlightRef.current[field.key] = hIdx - 1;
          requestRender();
        } else if (idx > 0) {
          // At top of radio options: move to previous form field
          activeIndexRef.current = idx - 1;
          requestRender();
        }
      } else if (event.key === "down") {
        if (hIdx < opts.length - 1) {
          selectHighlightRef.current[field.key] = hIdx + 1;
          requestRender();
        } else if (idx < totalItems - 1) {
          // At bottom of radio options: move to next form field
          activeIndexRef.current = idx + 1;
          requestRender();
        }
      } else if (event.char === " ") {
        const opt = opts[hIdx];
        if (opt) {
          valuesRef.current[field.key] = opt.value;
          onFieldChangeRef.current?.(field.key, opt.value);
          requestRender();
        }
      }
      return;
    }

    // Select type: arrow keys don't type, they navigate
    if (field.type === "select") {
      if (event.key === "up") {
        if (idx > 0) {
          activeIndexRef.current = idx - 1;
          requestRender();
        }
      } else if (event.key === "down") {
        if (idx < totalItems - 1) {
          activeIndexRef.current = idx + 1;
          requestRender();
        }
      }
      return;
    }

    // Text/password/number field handling
    const currentValue = valuesRef.current[field.key] ?? "";
    const cursorPos = cursorsRef.current[field.key] ?? 0;

    if (event.key === "backspace") {
      if (cursorPos > 0) {
        const newVal = currentValue.slice(0, cursorPos - 1) + currentValue.slice(cursorPos);
        valuesRef.current[field.key] = newVal;
        cursorsRef.current[field.key] = cursorPos - 1;
        onFieldChangeRef.current?.(field.key, newVal);
        requestRender();
      }
      return;
    }

    if (event.key === "delete") {
      if (cursorPos < currentValue.length) {
        const newVal = currentValue.slice(0, cursorPos) + currentValue.slice(cursorPos + 1);
        valuesRef.current[field.key] = newVal;
        onFieldChangeRef.current?.(field.key, newVal);
        requestRender();
      }
      return;
    }

    if (event.key === "left") {
      if (cursorPos > 0) {
        cursorsRef.current[field.key] = cursorPos - 1;
        requestRender();
      }
      return;
    }

    if (event.key === "right") {
      if (cursorPos < currentValue.length) {
        cursorsRef.current[field.key] = cursorPos + 1;
        requestRender();
      }
      return;
    }

    if (event.key === "home") {
      cursorsRef.current[field.key] = 0;
      requestRender();
      return;
    }

    if (event.key === "end") {
      cursorsRef.current[field.key] = currentValue.length;
      requestRender();
      return;
    }

    if (event.key === "up") {
      if (idx > 0) {
        activeIndexRef.current = idx - 1;
        requestRender();
      }
      return;
    }

    if (event.key === "down") {
      if (idx < totalItems - 1) {
        activeIndexRef.current = idx + 1;
        requestRender();
      }
      return;
    }

    // Printable character input
    if (event.char && event.char.length === 1 && !event.ctrl && !event.meta) {
      // Number fields: validate the entire resulting value, not individual chars
      if (field.type === "number") {
        const newVal = currentValue.slice(0, cursorPos) + event.char + currentValue.slice(cursorPos);
        if (!/^-?\d*\.?\d*$/.test(newVal)) return;
      }
      const newVal = currentValue.slice(0, cursorPos) + event.char + currentValue.slice(cursorPos);
      valuesRef.current[field.key] = newVal;
      cursorsRef.current[field.key] = cursorPos + 1;
      onFieldChangeRef.current?.(field.key, newVal);
      requestRender();
    }
  }, [fields, totalItems, requestRender]);

  useInput(handleInput, { isActive: isFocused });

  // Render field rows
  const rows: React.ReactElement[] = [];

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]!;
    const isActive = i === activeIndexRef.current;
    const value = valuesRef.current[field.key] ?? "";
    const cursorPos = cursorsRef.current[field.key] ?? 0;

    // Custom field render delegate
    if (props.renderField) {
      const fieldError = errorsRef.current.get(field.key) ?? null;
      rows.push(
        React.createElement(
          "tui-box",
          { key: field.key, flexDirection: "column" },
          props.renderField(field, { value, error: fieldError, isFocused: isActive }),
        ),
      );
      continue;
    }

    // Checkbox field rendering
    if (field.type === "checkbox") {
      const isChecked = value === "true";
      const checkMark = isChecked ? "\u2713" : " ";
      const checkColor = isChecked ? colors.success : colors.text.dim;

      const children: React.ReactElement[] = [];
      children.push(
        React.createElement(
          "tui-text",
          { key: "ind", color: isActive ? color : undefined },
          isActive ? "\u276F " : "  ",
        ),
      );
      children.push(
        React.createElement(
          "tui-text",
          { key: "check", color: checkColor },
          `[${checkMark}]`,
        ),
      );
      children.push(
        React.createElement(
          "tui-text",
          { key: "label", color: isActive ? colors.text.primary : colors.text.secondary, bold: isActive },
          ` ${field.label}`,
        ),
      );

      rows.push(
        React.createElement(
          "tui-box",
          { key: field.key, flexDirection: "row" },
          ...children,
        ),
      );
      continue;
    }

    // Switch field rendering
    if (field.type === "switch") {
      const isChecked = value === "true";
      const trackChar = "\u2501"; // ━
      const dotChar = "\u25CF";   // ●
      const trackLen = 3;
      const padLen = 2;
      const trackStr = trackChar.repeat(trackLen);
      const padStr = " ".repeat(padLen);
      const switchVisual = isChecked
        ? `[${padStr}${trackStr}${dotChar}]`
        : `[${dotChar}${trackStr}${padStr}]`;
      const switchColor = isChecked ? colors.success : colors.text.dim;
      const statusLabel = isChecked ? (field.onLabel ?? "ON") : (field.offLabel ?? "OFF");

      const children: React.ReactElement[] = [];
      children.push(
        React.createElement(
          "tui-text",
          { key: "ind", color: isActive ? color : undefined },
          isActive ? "\u276F " : "  ",
        ),
      );
      children.push(
        React.createElement(
          "tui-text",
          { key: "switch", color: switchColor },
          switchVisual,
        ),
      );
      children.push(
        React.createElement(
          "tui-text",
          { key: "status", ...(isChecked ? { color: switchColor } : { dim: true }) },
          ` ${statusLabel}`,
        ),
      );
      children.push(
        React.createElement(
          "tui-text",
          { key: "label", color: isActive ? colors.text.primary : colors.text.secondary, bold: isActive },
          `  ${field.label}`,
        ),
      );

      rows.push(
        React.createElement(
          "tui-box",
          { key: field.key, flexDirection: "row" },
          ...children,
        ),
      );
      continue;
    }

    // Radio field rendering
    if (field.type === "radio") {
      const opts = field.options ?? [];
      const hIdx = selectHighlightRef.current[field.key] ?? 0;

      // Label row
      rows.push(
        React.createElement(
          "tui-box",
          { key: `${field.key}-label`, flexDirection: "row" },
          React.createElement(
            "tui-text",
            { color: isActive ? color : undefined },
            isActive ? "\u276F " : "  ",
          ),
          React.createElement(
            "tui-text",
            { color: colors.text.dim, bold: isActive },
            `${field.label}${field.required ? " *" : ""}:`,
          ),
        ),
      );

      // Radio options
      for (let oi = 0; oi < opts.length; oi++) {
        const opt = opts[oi]!;
        const isOptHighlighted = isActive && oi === hIdx;
        const isOptSelected = opt.value === value;
        const indicator = isOptSelected ? "\u25CF" : "\u25CB"; // ● or ○
        const indicatorColor = isOptSelected ? color : colors.text.dim;

        rows.push(
          React.createElement(
            "tui-box",
            { key: `${field.key}-opt-${opt.value}`, flexDirection: "row" },
            React.createElement(
              "tui-text",
              { color: isOptHighlighted ? color : undefined },
              isOptHighlighted ? "    \u25B6 " : "      ",
            ),
            React.createElement(
              "tui-text",
              { color: indicatorColor },
              `${indicator} `,
            ),
            React.createElement(
              "tui-text",
              {
                color: isOptHighlighted ? color : isOptSelected ? colors.text.primary : colors.text.secondary,
                bold: isOptHighlighted,
              },
              opt.label,
            ),
          ),
        );
      }

      // Show validation error below radio group if present
      const radioError = errorsRef.current.get(field.key);
      if (radioError) {
        rows.push(
          React.createElement(
            "tui-box",
            { key: `${field.key}-err`, flexDirection: "row" },
            React.createElement(
              "tui-text",
              { color: colors.error },
              `    \u2716 ${radioError}`,
            ),
          ),
        );
      }
      continue;
    }

    // Select field rendering
    if (field.type === "select") {
      const opts = field.options ?? [];
      const selectedOpt = opts.find((o) => o.value === value);
      const displayLabel = selectedOpt ? selectedOpt.label : field.placeholder ?? "Select...";
      const isSelectOpen = selectOpenRef.current === field.key;

      const children: React.ReactElement[] = [];
      children.push(
        React.createElement(
          "tui-text",
          { key: "ind", color: isActive ? color : undefined },
          isActive ? "\u276F " : "  ",
        ),
      );
      children.push(
        React.createElement(
          "tui-text",
          { key: "label", color: colors.text.dim, bold: isActive },
          `${field.label}${field.required ? " *" : ""}: `,
        ),
      );
      children.push(
        React.createElement(
          "tui-text",
          { key: "bo", color: isActive ? colors.input.borderActive : colors.input.border },
          "[",
        ),
      );
      children.push(
        React.createElement(
          "tui-text",
          {
            key: "val",
            color: selectedOpt ? colors.text.primary : colors.text.disabled,
          },
          displayLabel,
        ),
      );
      children.push(
        React.createElement(
          "tui-text",
          { key: "bc", color: isActive ? colors.input.borderActive : colors.input.border },
          "]",
        ),
      );
      children.push(
        React.createElement(
          "tui-text",
          { key: "arrow", color: colors.text.dim },
          isSelectOpen ? " \u25B2" : " \u25BC",
        ),
      );

      rows.push(
        React.createElement(
          "tui-box",
          { key: field.key, flexDirection: "row" },
          ...children,
        ),
      );

      // Render dropdown options when open
      if (isSelectOpen) {
        const hIdx = selectHighlightRef.current[field.key] ?? 0;
        for (let oi = 0; oi < opts.length; oi++) {
          const opt = opts[oi]!;
          const isOptActive = oi === hIdx;
          const isOptSelected = opt.value === value;
          rows.push(
            React.createElement(
              "tui-box",
              { key: `${field.key}-opt-${opt.value}`, flexDirection: "row" },
              React.createElement(
                "tui-text",
                { color: isOptActive ? color : colors.text.dim },
                isOptActive ? "    \u25B6 " : "      ",
              ),
              React.createElement(
                "tui-text",
                {
                  color: isOptActive ? color : isOptSelected ? colors.text.primary : colors.text.secondary,
                  bold: isOptActive,
                },
                opt.label,
              ),
            ),
          );
        }
      }

      // Show async validation loading indicator
      const selectAsyncState = asyncStateRef.current[field.key];
      if (selectAsyncState === "pending") {
        rows.push(
          React.createElement(
            "tui-box",
            { key: `${field.key}-async`, flexDirection: "row" },
            React.createElement(
              "tui-text",
              { color: colors.text.dim },
              `    \u23F3 validating...`,
            ),
          ),
        );
      }

      // Show validation error below field if present
      const fieldError = errorsRef.current.get(field.key);
      if (fieldError && selectAsyncState !== "pending") {
        rows.push(
          React.createElement(
            "tui-box",
            { key: `${field.key}-err`, flexDirection: "row" },
            React.createElement(
              "tui-text",
              { color: colors.error },
              `    \u2716 ${fieldError}`,
            ),
          ),
        );
      }
      continue;
    }

    // Text / password / number field rendering
    // Display value (mask password)
    let displayValue = value;
    if (field.type === "password") {
      displayValue = "\u2022".repeat(value.length); // bullet
    }

    // Show placeholder if empty
    const showPlaceholder = value.length === 0 && field.placeholder;

    // Build the label
    const labelText = field.label + (field.required ? " *" : "") + ": ";

    // Build display text with cursor
    let valueDisplay: string;
    if (showPlaceholder) {
      valueDisplay = field.placeholder!;
    } else if (isActive) {
      // Insert cursor indicator
      const before = displayValue.slice(0, cursorPos);
      const cursorChar = cursorPos < displayValue.length ? displayValue[cursorPos] : " ";
      const after = displayValue.slice(cursorPos + 1);
      valueDisplay = before + "\u2588" + after; // block cursor approximation
    } else {
      valueDisplay = displayValue || " ";
    }

    const children: React.ReactElement[] = [];

    // Active indicator
    children.push(
      React.createElement(
        "tui-text",
        { key: "ind", color: isActive ? color : undefined },
        isActive ? "\u276F " : "  ",
      ),
    );

    // Label
    children.push(
      React.createElement(
        "tui-text",
        { key: "label", color: colors.text.dim, bold: isActive },
        labelText,
      ),
    );

    // Border bracket open
    children.push(
      React.createElement(
        "tui-text",
        { key: "bo", color: isActive ? colors.input.borderActive : colors.input.border },
        "[",
      ),
    );

    // Value
    children.push(
      React.createElement(
        "tui-text",
        {
          key: "val",
          color: showPlaceholder
            ? colors.text.disabled
            : isActive
              ? colors.text.primary
              : colors.text.secondary,
        },
        valueDisplay,
      ),
    );

    // Border bracket close
    children.push(
      React.createElement(
        "tui-text",
        { key: "bc", color: isActive ? colors.input.borderActive : colors.input.border },
        "]",
      ),
    );

    rows.push(
      React.createElement(
        "tui-box",
        { key: field.key, flexDirection: "row" },
        ...children,
      ),
    );

    // Show async validation loading indicator
    const asyncState = asyncStateRef.current[field.key];
    if (asyncState === "pending") {
      rows.push(
        React.createElement(
          "tui-box",
          { key: `${field.key}-async`, flexDirection: "row" },
          React.createElement(
            "tui-text",
            { color: colors.text.dim },
            `    \u23F3 validating...`,
          ),
        ),
      );
    }

    // Show validation error below field if present
    const fieldError = errorsRef.current.get(field.key);
    if (fieldError && asyncState !== "pending") {
      rows.push(
        React.createElement(
          "tui-box",
          { key: `${field.key}-err`, flexDirection: "row" },
          React.createElement(
            "tui-text",
            { color: colors.error },
            `    \u2716 ${fieldError}`,
          ),
        ),
      );
    }
  }

  // Submit button row
  const isSubmitActive = activeIndexRef.current >= fields.length;
  rows.push(
    React.createElement(
      "tui-box",
      { key: "__submit", flexDirection: "row", marginTop: 1 },
      React.createElement(
        "tui-text",
        { key: "ind", color: isSubmitActive ? color : undefined },
        isSubmitActive ? "\u276F " : "  ",
      ),
      React.createElement(
        "tui-text",
        {
          key: "btn",
          bold: isSubmitActive,
          color: isSubmitActive ? color : colors.text.secondary,
        },
        `[ ${submitLabel} ]`,
      ),
    ),
  );

  const boxProps = mergeBoxStyles(
    { flexDirection: "column", role: "form", "aria-label": props["aria-label"] },
    userStyles,
  );

  return React.createElement(
    "tui-box",
    boxProps,
    ...rows,
  );
});

// ── Static compound assignments ─────────────────────────────────
export const Form = Object.assign(FormBase, {
  Root: FormRoot,
  Field: FormCompoundField,
  Submit: FormCompoundSubmit,
});
