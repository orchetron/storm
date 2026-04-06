import React, { useRef, useCallback, createContext, useContext } from "react";
import { useInput } from "../../hooks/useInput.js";
import { useTui } from "../../context/TuiContext.js";
import { useColors } from "../../hooks/useColors.js";
import type { KeyEvent } from "../../input/types.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { usePersonality } from "../../core/personality.js";
import { pickLayoutProps } from "../../styles/applyStyles.js";
import { MONTH_NAMES, MONTH_SHORT, DAY_HEADERS_SUN, DAY_HEADERS_MON, getDaysInMonth, getFirstDayOfWeek } from "../../utils/date.js";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a Date according to a simple format string. */
function formatDate(date: Date, fmt: string): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return fmt
    .replace("YYYY", String(y))
    .replace("YY", String(y).slice(-2))
    .replace("MMMM", MONTH_NAMES[m - 1]!)
    .replace("MMM", MONTH_SHORT[m - 1]!)
    .replace("MM", pad2(m))
    .replace("DD", pad2(d));
}

/** Clamp a date to within min/max bounds. Returns the date unchanged if no bounds. */
function clampDate(date: Date, min?: Date, max?: Date): Date {
  let t = date.getTime();
  if (min && t < min.getTime()) t = min.getTime();
  if (max && t > max.getTime()) t = max.getTime();
  return new Date(t);
}

/** Check whether two dates represent the same calendar day. */
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export interface DatePickerProps extends StormLayoutStyleProps {
  /** Currently selected date. */
  value?: Date;
  /** Called when the user selects a date. */
  onChange?: (date: Date) => void;
  /** Display format string. Supports YYYY, YY, MMMM, MMM, MM, DD tokens. Default: "YYYY-MM-DD". */
  format?: string;
  /** Text shown when no date is selected. */
  placeholder?: string;
  /** Earliest selectable date. */
  minDate?: Date;
  /** Latest selectable date. */
  maxDate?: Date;
  /** Whether the picker is disabled (dimmed, no input). */
  disabled?: boolean;
  /** Whether the picker captures keyboard input (default true). */
  isFocused?: boolean;
  /** Controlled open state. Omit for uncontrolled. */
  isOpen?: boolean;
  /** Called when the dropdown open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Day the week starts on: 0 = Sunday (default), 1 = Monday. */
  weekStartsOn?: 0 | 1;
  /** Override today's date for highlighting. Auto-detected if omitted. */
  today?: Date;
  "aria-label"?: string;
}

export interface DatePickerContextValue {
  value: Date | undefined;
  viewYear: number;
  viewMonth: number;
  isOpen: boolean;
  disabled: boolean;
  format: string;
  placeholder: string;
  selectDate: (date: Date) => void;
  setOpen: (open: boolean) => void;
  changeMonth: (year: number, month: number) => void;
}

export const DatePickerContext = createContext<DatePickerContextValue | null>(null);

export function useDatePickerContext(): DatePickerContextValue {
  const ctx = useContext(DatePickerContext);
  if (!ctx) throw new Error("DatePicker sub-components must be used inside DatePicker.Root");
  return ctx;
}

export interface DatePickerRootProps {
  value?: Date;
  onChange?: (date: Date) => void;
  format?: string;
  placeholder?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

function DatePickerRoot({ value, onChange, format = "YYYY-MM-DD", placeholder = "Select date...", disabled = false, children }: DatePickerRootProps): React.ReactElement {
  const { requestRender } = useTui();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const openRef = useRef(false);
  const viewYearRef = useRef(value ? value.getFullYear() : new Date().getFullYear());
  const viewMonthRef = useRef(value ? value.getMonth() + 1 : new Date().getMonth() + 1);

  const ctx: DatePickerContextValue = {
    value,
    viewYear: viewYearRef.current,
    viewMonth: viewMonthRef.current,
    isOpen: openRef.current,
    disabled,
    format,
    placeholder,
    selectDate: (date: Date) => { onChangeRef.current?.(date); openRef.current = false; requestRender(); },
    setOpen: (open: boolean) => { openRef.current = open; requestRender(); },
    changeMonth: (y: number, m: number) => { viewYearRef.current = y; viewMonthRef.current = m; requestRender(); },
  };

  return React.createElement(DatePickerContext.Provider, { value: ctx }, children);
}

function DatePickerCompoundTrigger(): React.ReactElement {
  const colors = useColors();
  const { value, isOpen, disabled, format, placeholder } = useDatePickerContext();
  const displayText = value ? formatDate(value, format) : placeholder;
  const displayColor = value ? colors.text.primary : colors.text.dim;
  const icon = isOpen ? " \u25B2" : " \u25BC";

  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    React.createElement("tui-text", { color: disabled ? colors.text.disabled : displayColor, dim: disabled }, displayText),
    React.createElement("tui-text", { color: colors.text.dim }, disabled ? "" : icon),
  );
}

function DatePickerCompoundCalendar(): React.ReactElement | null {
  const colors = useColors();
  const personality = usePersonality();
  const { isOpen } = useDatePickerContext();
  if (!isOpen) return null;

  return React.createElement(
    "tui-box",
    {
      flexDirection: "column",
      borderStyle: personality.borders.default,
      borderColor: colors.brand.primary,
    },
    React.createElement("tui-text", { color: colors.text.dim }, "Calendar content via compound API"),
  );
}

const DatePickerBase = React.memo(function DatePicker(rawProps: DatePickerProps): React.ReactElement {
  const colors = useColors();
  const personality = usePersonality();
  const props = usePluginProps("DatePicker", rawProps);
  const {
    value,
    onChange,
    format: fmt = "YYYY-MM-DD",
    placeholder = "Select date...",
    minDate,
    maxDate,
    disabled = false,
    isFocused = true,
    isOpen,
    onOpenChange,
    weekStartsOn = 0,
    today: todayProp,
    color = colors.brand.primary,
  } = props;

  const { requestRender } = useTui();

  // ── Refs for imperative state ──────────────────────────────────

  const internalOpenRef = useRef(false);
  const isControlled = props.isOpen !== undefined;
  const effectiveIsOpen = isControlled ? isOpen : internalOpenRef.current;

  // View state: which month/year is displayed in the calendar grid
  const now = new Date();
  const initialYear = value ? value.getFullYear() : now.getFullYear();
  const initialMonth = value ? value.getMonth() + 1 : now.getMonth() + 1;
  const viewYearRef = useRef(initialYear);
  const viewMonthRef = useRef(initialMonth);

  // Focused day within the calendar grid (cursor position)
  const focusedDayRef = useRef(value ? value.getDate() : 1);

  // Latest-prop refs
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;
  const isOpenRef = useRef(effectiveIsOpen);
  isOpenRef.current = effectiveIsOpen;
  const minDateRef = useRef(minDate);
  minDateRef.current = minDate;
  const maxDateRef = useRef(maxDate);
  maxDateRef.current = maxDate;

  // ── Date constraint helpers ────────────────────────────────────

  const isDateDisabled = (year: number, month: number, day: number): boolean => {
    const d = new Date(year, month - 1, day);
    if (minDateRef.current) {
      const min = new Date(minDateRef.current.getFullYear(), minDateRef.current.getMonth(), minDateRef.current.getDate());
      if (d.getTime() < min.getTime()) return true;
    }
    if (maxDateRef.current) {
      const max = new Date(maxDateRef.current.getFullYear(), maxDateRef.current.getMonth(), maxDateRef.current.getDate());
      if (d.getTime() > max.getTime()) return true;
    }
    return false;
  };

  /** Can the calendar navigate to the given month? */
  const canNavigateToMonth = (year: number, month: number): boolean => {
    const daysInMonth = getDaysInMonth(year, month);
    if (minDateRef.current) {
      const lastDayOfMonth = new Date(year, month - 1, daysInMonth);
      const min = new Date(minDateRef.current.getFullYear(), minDateRef.current.getMonth(), minDateRef.current.getDate());
      if (lastDayOfMonth.getTime() < min.getTime()) return false;
    }
    if (maxDateRef.current) {
      const firstDayOfMonth = new Date(year, month - 1, 1);
      const max = new Date(maxDateRef.current.getFullYear(), maxDateRef.current.getMonth(), maxDateRef.current.getDate());
      if (firstDayOfMonth.getTime() > max.getTime()) return false;
    }
    return true;
  };

  // ── Sync view to value when opening ────────────────────────────

  if (effectiveIsOpen && value) {
    viewYearRef.current = value.getFullYear();
    viewMonthRef.current = value.getMonth() + 1;
    focusedDayRef.current = value.getDate();
  }

  // ── Navigate month helper ──────────────────────────────────────

  const navigateMonth = (direction: -1 | 1): void => {
    let y = viewYearRef.current;
    let m = viewMonthRef.current + direction;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    if (!canNavigateToMonth(y, m)) return;
    viewYearRef.current = y;
    viewMonthRef.current = m;
    // Clamp focused day to new month
    const daysInNew = getDaysInMonth(y, m);
    if (focusedDayRef.current > daysInNew) focusedDayRef.current = daysInNew;
    while (isDateDisabled(y, m, focusedDayRef.current) && focusedDayRef.current > 1) {
      focusedDayRef.current--;
    }
    requestRender();
  };

  const navigateYear = (direction: -1 | 1): void => {
    const y = viewYearRef.current + direction;
    const m = viewMonthRef.current;
    if (!canNavigateToMonth(y, m)) return;
    viewYearRef.current = y;
    const daysInNew = getDaysInMonth(y, m);
    if (focusedDayRef.current > daysInNew) focusedDayRef.current = daysInNew;
    requestRender();
  };

  // ── Keyboard handling ──────────────────────────────────────────

  const handleInput = useCallback((event: KeyEvent) => {
    if (disabled) return;

    if (isOpenRef.current) {
      const y = viewYearRef.current;
      const m = viewMonthRef.current;
      const daysInMonth = getDaysInMonth(y, m);

      if (event.key === "escape") {
        if (!isControlledRef.current) {
          internalOpenRef.current = false;
          requestRender();
        }
        onOpenChangeRef.current?.(false);
        return;
      }

      if (event.key === "return") {
        const day = focusedDayRef.current;
        if (!isDateDisabled(y, m, day)) {
          const selected = new Date(y, m - 1, day);
          onChangeRef.current?.(selected);
          if (!isControlledRef.current) {
            internalOpenRef.current = false;
            requestRender();
          }
          onOpenChangeRef.current?.(false);
        }
        return;
      }

      // Arrow navigation
      if (event.key === "left") {
        let next = focusedDayRef.current - 1;
        if (next < 1) {
          // Go to previous month, last day
          navigateMonth(-1);
          const newDays = getDaysInMonth(viewYearRef.current, viewMonthRef.current);
          focusedDayRef.current = newDays;
          requestRender();
          return;
        }
        while (next >= 1 && isDateDisabled(y, m, next)) next--;
        if (next >= 1) {
          focusedDayRef.current = next;
          requestRender();
        }
        return;
      }

      if (event.key === "right") {
        let next = focusedDayRef.current + 1;
        if (next > daysInMonth) {
          navigateMonth(1);
          focusedDayRef.current = 1;
          requestRender();
          return;
        }
        while (next <= daysInMonth && isDateDisabled(y, m, next)) next++;
        if (next <= daysInMonth) {
          focusedDayRef.current = next;
          requestRender();
        }
        return;
      }

      if (event.key === "up") {
        const next = focusedDayRef.current - 7;
        if (next < 1) {
          navigateMonth(-1);
          const newDays = getDaysInMonth(viewYearRef.current, viewMonthRef.current);
          focusedDayRef.current = Math.min(newDays, newDays + next); // next is negative
          requestRender();
          return;
        }
        if (!isDateDisabled(y, m, next)) {
          focusedDayRef.current = next;
          requestRender();
        }
        return;
      }

      if (event.key === "down") {
        const next = focusedDayRef.current + 7;
        if (next > daysInMonth) {
          navigateMonth(1);
          focusedDayRef.current = Math.min(getDaysInMonth(viewYearRef.current, viewMonthRef.current), next - daysInMonth);
          requestRender();
          return;
        }
        if (!isDateDisabled(y, m, next)) {
          focusedDayRef.current = next;
          requestRender();
        }
        return;
      }

      // PageUp/PageDown — month navigation; with Shift — year navigation
      if (event.key === "pageup") {
        if (event.shift) {
          navigateYear(-1);
        } else {
          navigateMonth(-1);
        }
        return;
      }
      if (event.key === "pagedown") {
        if (event.shift) {
          navigateYear(1);
        } else {
          navigateMonth(1);
        }
        return;
      }

      // 't' or 'T' — jump to today
      if (event.char === "t" || event.char === "T") {
        const today = new Date();
        const ty = today.getFullYear();
        const tm = today.getMonth() + 1;
        const td = today.getDate();
        if (!isDateDisabled(ty, tm, td)) {
          viewYearRef.current = ty;
          viewMonthRef.current = tm;
          focusedDayRef.current = td;
          requestRender();
        }
        return;
      }
    } else {
      // Closed — Enter to open
      if (event.key === "return") {
        const anchor = valueRef.current ?? new Date();
        viewYearRef.current = anchor.getFullYear();
        viewMonthRef.current = anchor.getMonth() + 1;
        focusedDayRef.current = anchor.getDate();

        if (!isControlledRef.current) {
          internalOpenRef.current = true;
          requestRender();
        }
        onOpenChangeRef.current?.(true);
      }
    }
  }, [disabled, requestRender]);

  useInput(handleInput, { isActive: isFocused && !disabled });

  // ── Today reference ────────────────────────────────────────────

  const todayDate = todayProp ?? new Date();
  const viewYear = viewYearRef.current;
  const viewMonth = viewMonthRef.current;
  const isCurrentMonth = todayDate.getFullYear() === viewYear && todayDate.getMonth() + 1 === viewMonth;
  const todayDay = isCurrentMonth ? todayDate.getDate() : -1;

  // ── Layout props ───────────────────────────────────────────────

  const boxProps: Record<string, unknown> = {
    flexDirection: "column",
    role: "dialog",
    "aria-label": props["aria-label"] ?? "Date picker",
    ...pickLayoutProps(props),
  };

  // ── Render: trigger row ────────────────────────────────────────

  const displayText = value ? formatDate(value, fmt) : placeholder;
  const displayColor = disabled
    ? colors.text.disabled
    : value
      ? colors.text.primary
      : colors.text.dim;
  const arrow = effectiveIsOpen ? " \u25B2" : " \u25BC";

  const triggerRow = React.createElement(
    "tui-box",
    { key: "trigger", flexDirection: "row" },
    React.createElement("tui-text", { color: displayColor, dim: disabled }, displayText),
    React.createElement("tui-text", { color: colors.text.dim }, disabled ? "" : arrow),
  );

  if (!effectiveIsOpen) {
    return React.createElement("tui-box", boxProps, triggerRow);
  }

  // ── Render: calendar overlay ───────────────────────────────────

  const calendarChildren: React.ReactElement[] = [];

  // Month/year header with navigation arrows
  const monthName = MONTH_NAMES[viewMonth - 1] ?? "";
  const canPrev = canNavigateToMonth(viewMonth === 1 ? viewYear - 1 : viewYear, viewMonth === 1 ? 12 : viewMonth - 1);
  const canNext = canNavigateToMonth(viewMonth === 12 ? viewYear + 1 : viewYear, viewMonth === 12 ? 1 : viewMonth + 1);

  calendarChildren.push(
    React.createElement(
      "tui-box",
      { key: "cal-header", flexDirection: "row" },
      React.createElement("tui-text", { color: canPrev ? colors.text.secondary : colors.text.disabled }, "\u25C0 "),
      React.createElement("tui-text", { bold: true, color: colors.text.primary }, `${monthName} ${viewYear}`),
      React.createElement("tui-text", { color: canNext ? colors.text.secondary : colors.text.disabled }, " \u25B6"),
    ),
  );

  // Day-of-week headers
  const dayHeaders = weekStartsOn === 1 ? DAY_HEADERS_MON : DAY_HEADERS_SUN;
  calendarChildren.push(
    React.createElement("tui-text", { key: "day-headers", color: colors.text.secondary }, dayHeaders),
  );

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const rawFirstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const firstDay = weekStartsOn === 1
    ? (rawFirstDay === 0 ? 6 : rawFirstDay - 1)
    : rawFirstDay;

  const focusedDay = focusedDayRef.current;
  const selectedDay = value
    && value.getFullYear() === viewYear
    && value.getMonth() + 1 === viewMonth
    ? value.getDate()
    : -1;

  let dayOfWeek = firstDay;

  for (let d = 1; d <= daysInMonth; ) {
    const weekKey = `week-${d}`;
    const weekChildren: React.ReactElement[] = [];

    // Leading spaces for first row
    if (d === 1 && firstDay > 0) {
      weekChildren.push(
        React.createElement("tui-text", { key: "pad" }, "   ".repeat(firstDay)),
      );
    }

    const daysLeftInWeek = 7 - dayOfWeek;
    const weekEndDay = Math.min(daysInMonth, d + daysLeftInWeek - 1);

    for (let wd = d; wd <= weekEndDay; wd++) {
      const ds = String(wd).padStart(2, " ");
      const dayDisabled = isDateDisabled(viewYear, viewMonth, wd);
      const isFocusedDay = wd === focusedDay;
      const isSelectedDay = wd === selectedDay;
      const isTodayDay = wd === todayDay;

      if (dayDisabled) {
        weekChildren.push(
          React.createElement("tui-text", { key: `d${wd}`, color: colors.text.disabled, dim: true }, ds),
        );
      } else if (isSelectedDay && isFocusedDay) {
        // Selected + focused: bold inverse with underline
        weekChildren.push(
          React.createElement("tui-text", { key: `d${wd}`, bold: true, inverse: true, underline: true, color }, ds),
        );
      } else if (isSelectedDay) {
        weekChildren.push(
          React.createElement("tui-text", { key: `d${wd}`, bold: true, inverse: true, color }, ds),
        );
      } else if (isFocusedDay) {
        // Focused but not selected: inverse with brand color
        weekChildren.push(
          React.createElement("tui-text", { key: `d${wd}`, inverse: true, color }, ds),
        );
      } else if (isTodayDay) {
        weekChildren.push(
          React.createElement("tui-text", { key: `d${wd}`, underline: true, color: colors.text.primary }, ds),
        );
      } else {
        weekChildren.push(
          React.createElement("tui-text", { key: `d${wd}`, color: colors.text.primary }, ds),
        );
      }

      // Spacing between day cells
      if (wd < weekEndDay || (weekEndDay < daysInMonth && dayOfWeek + (wd - d) < 6)) {
        weekChildren.push(
          React.createElement("tui-text", { key: `s${wd}` }, " "),
        );
      }
    }

    calendarChildren.push(
      React.createElement("tui-box", { key: weekKey, flexDirection: "row" }, ...weekChildren),
    );

    d = weekEndDay + 1;
    dayOfWeek = 0;
  }

  // Hint row
  calendarChildren.push(
    React.createElement(
      "tui-text",
      { key: "hints", color: colors.text.dim, dim: true },
      "\u2190\u2191\u2192\u2193 navigate  Enter select  T today  Esc close",
    ),
  );

  const calendarOverlay = React.createElement(
    "tui-box",
    {
      key: "calendar",
      flexDirection: "column",
      borderStyle: personality.borders.default,
      borderColor: color,
    },
    ...calendarChildren,
  );

  return React.createElement("tui-box", boxProps, triggerRow, calendarOverlay);
});

export const DatePicker = Object.assign(DatePickerBase, {
  Root: DatePickerRoot,
  Trigger: DatePickerCompoundTrigger,
  Calendar: DatePickerCompoundCalendar,
});
