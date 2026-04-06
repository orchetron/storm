import React, { useRef, createContext, useContext } from "react";
import { useTui } from "../../context/TuiContext.js";
import { useColors } from "../../hooks/useColors.js";
import type { StormContainerStyleProps } from "../../styles/styleProps.js";
import { mergeBoxStyles, pickStyleProps } from "../../styles/applyStyles.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { useFormBehavior } from "../../hooks/headless/useFormBehavior.js";
import type { FormFieldState } from "../../hooks/headless/useFormBehavior.js";

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
  const props = usePluginProps("Form", rawProps);
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

  const userStyles = pickStyleProps(props);

  const form = useFormBehavior({
    fields,
    onSubmit,
    isActive: isFocused,
    initialValues,
    onFieldChange,
    onReset,
  });

  // --- Per-field-type render functions (consume state from hook) ---

  const renderCheckboxField = (field: FormField, fieldState: FormFieldState): React.ReactElement => {
    const { value, isFocused: isActive } = fieldState;
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

    return React.createElement(
      "tui-box",
      { key: field.key, flexDirection: "row" },
      ...children,
    );
  };

  const renderSwitchField = (field: FormField, fieldState: FormFieldState): React.ReactElement => {
    const { value, isFocused: isActive } = fieldState;
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

    return React.createElement(
      "tui-box",
      { key: field.key, flexDirection: "row" },
      ...children,
    );
  };

  const renderRadioField = (field: FormField, fieldState: FormFieldState, rows: React.ReactElement[]): void => {
    const { value, isFocused: isActive, selectHighlightIndex: hIdx, error: radioError } = fieldState;
    const opts = field.options ?? [];

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
  };

  const renderSelectField = (field: FormField, fieldState: FormFieldState, rows: React.ReactElement[]): void => {
    const { value, isFocused: isActive, isSelectOpen, selectHighlightIndex: hIdx, isAsyncPending, error: fieldError } = fieldState;
    const opts = field.options ?? [];
    const selectedOpt = opts.find((o) => o.value === value);
    const displayLabel = selectedOpt ? selectedOpt.label : field.placeholder ?? "Select...";

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

    if (isSelectOpen) {
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
    if (isAsyncPending) {
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
    if (fieldError && !isAsyncPending) {
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
  };

  const renderPasswordField = (field: FormField, fieldState: FormFieldState): React.ReactElement => {
    return renderTextLikeField(field, fieldState, "\u2022".repeat(fieldState.value.length));
  };

  const renderTextField = (field: FormField, fieldState: FormFieldState): React.ReactElement => {
    return renderTextLikeField(field, fieldState, fieldState.value);
  };

  const renderTextLikeField = (field: FormField, fieldState: FormFieldState, displayValue: string): React.ReactElement => {
    const { value, isFocused: isActive, cursorPosition: cursorPos } = fieldState;
    // Show placeholder if empty
    const showPlaceholder = value.length === 0 && field.placeholder;

    const labelText = field.label + (field.required ? " *" : "") + ": ";

    let valueDisplay: string;
    if (showPlaceholder) {
      valueDisplay = field.placeholder!;
    } else if (isActive) {
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

    return React.createElement(
      "tui-box",
      { key: field.key, flexDirection: "row" },
      ...children,
    );
  };

  const renderFieldValidationStatus = (field: FormField, fieldState: FormFieldState, rows: React.ReactElement[]): void => {
    const { isAsyncPending, error: fieldError } = fieldState;
    // Show async validation loading indicator
    if (isAsyncPending) {
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
    if (fieldError && !isAsyncPending) {
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
  };

  const rows: React.ReactElement[] = [];

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]!;
    const fieldState = form.getFieldProps(field.key);

    // Custom field render delegate
    if (props.renderField) {
      rows.push(
        React.createElement(
          "tui-box",
          { key: field.key, flexDirection: "column" },
          props.renderField(field, { value: fieldState.value, error: fieldState.error ?? null, isFocused: fieldState.isFocused }),
        ),
      );
      continue;
    }

    if (field.type === "checkbox") {
      rows.push(renderCheckboxField(field, fieldState));
      continue;
    }
    if (field.type === "switch") {
      rows.push(renderSwitchField(field, fieldState));
      continue;
    }
    if (field.type === "radio") {
      renderRadioField(field, fieldState, rows);
      continue;
    }
    if (field.type === "select") {
      renderSelectField(field, fieldState, rows);
      continue;
    }

    // Text / password / number fields
    if (field.type === "password") {
      rows.push(renderPasswordField(field, fieldState));
    } else {
      rows.push(renderTextField(field, fieldState));
    }
    renderFieldValidationStatus(field, fieldState, rows);
  }

  // Submit button row
  const isSubmitActive = form.isSubmitFocused;
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

export const Form = Object.assign(FormBase, {
  Root: FormRoot,
  Field: FormCompoundField,
  Submit: FormCompoundSubmit,
});
