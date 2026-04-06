
import React, { useRef, useCallback, createContext, useContext } from "react";
import { useInput } from "../../hooks/useInput.js";
import { useTui } from "../../context/TuiContext.js";
import { useColors } from "../../hooks/useColors.js";
import type { KeyEvent } from "../../input/types.js";
import type { StormLayoutStyleProps } from "../../styles/styleProps.js";
import { usePluginProps } from "../../hooks/usePluginProps.js";
import { pickLayoutProps } from "../../styles/applyStyles.js";
import { MONTH_NAMES, DAY_HEADERS_SUN, DAY_HEADERS_MON, getDaysInMonth, getFirstDayOfWeek } from "../../utils/date.js";

export interface CalendarProps extends StormLayoutStyleProps {
  year: number;
  month: number;
  selectedDay?: number;
  onSelect?: (day: number) => void;
  onMonthChange?: (year: number, month: number) => void;
  selectedColor?: string | number;
  /** Override today's date for highlighting. Auto-detected if omitted. */
  today?: Date;
  isFocused?: boolean;
  /** Start of date range to highlight. */
  rangeStart?: Date;
  /** End of date range to highlight. */
  rangeEnd?: Date;
  /** Predicate that returns true for dates that should be disabled (dimmed, unselectable). */
  disabledDates?: (date: Date) => boolean;
  /** Day the week starts on: 0 = Sunday (default), 1 = Monday. */
  weekStartsOn?: 0 | 1;
  /** Custom render for each day cell. */
  renderDay?: (day: number, state: { isSelected: boolean; isToday: boolean; isDisabled: boolean; isInRange: boolean }) => React.ReactNode;
  "aria-label"?: string;
}

export interface CalendarContextValue {
  year: number;
  month: number;
  selectedDay: number | undefined;
  focusedDay: number | undefined;
  selectDay: (day: number) => void;
  changeMonth: (year: number, month: number) => void;
}

export const CalendarContext = createContext<CalendarContextValue | null>(null);

export function useCalendarContext(): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error("Calendar sub-components must be used inside Calendar.Root");
  return ctx;
}

export interface CalendarRootProps {
  year: number;
  month: number;
  selectedDay?: number;
  focusedDay?: number;
  onSelect?: (day: number) => void;
  onMonthChange?: (year: number, month: number) => void;
  children: React.ReactNode;
}

function CalendarRoot({ year, month, selectedDay, focusedDay, onSelect, onMonthChange, children }: CalendarRootProps): React.ReactElement {
  const colors = useColors();
  const { requestRender } = useTui();
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onMonthChangeRef = useRef(onMonthChange);
  onMonthChangeRef.current = onMonthChange;

  const ctx: CalendarContextValue = {
    year,
    month,
    selectedDay,
    focusedDay,
    selectDay: (day: number) => { onSelectRef.current?.(day); requestRender(); },
    changeMonth: (y: number, m: number) => { onMonthChangeRef.current?.(y, m); requestRender(); },
  };

  return React.createElement(
    CalendarContext.Provider,
    { value: ctx },
    React.createElement("tui-box", { flexDirection: "column" }, children),
  );
}

function CalendarCompoundHeader(): React.ReactElement {
  const colors = useColors();
  const { year, month, changeMonth } = useCalendarContext();
  const monthName = MONTH_NAMES[Math.max(0, Math.min(11, month - 1))] ?? "";

  return React.createElement(
    "tui-box",
    { flexDirection: "row" },
    React.createElement("tui-text", { color: colors.text.dim }, "< "),
    React.createElement("tui-text", { bold: true, color: colors.text.primary }, `${monthName} ${year}`),
    React.createElement("tui-text", { color: colors.text.dim }, " >"),
  );
}

export interface CalendarCompoundGridProps {
  weekStartsOn?: 0 | 1;
  children?: React.ReactNode;
}

function CalendarCompoundGrid({ weekStartsOn = 0, children }: CalendarCompoundGridProps): React.ReactElement {
  const colors = useColors();
  const dayHeaders = weekStartsOn === 1 ? "Mo Tu We Th Fr Sa Su" : "Su Mo Tu We Th Fr Sa";
  return React.createElement(
    "tui-box",
    { flexDirection: "column" },
    React.createElement("tui-text", { color: colors.text.secondary }, dayHeaders),
    children,
  );
}

export interface CalendarCompoundDayProps {
  day: number;
  children?: React.ReactNode;
}

function CalendarCompoundDay({ day, children }: CalendarCompoundDayProps): React.ReactElement {
  const colors = useColors();
  const { selectedDay, focusedDay, selectDay } = useCalendarContext();
  const isSelected = day === selectedDay;
  const isFocused = day === focusedDay;
  const ds = String(day).padStart(2, " ");

  if (children) {
    return React.createElement("tui-box", null, children);
  }

  return React.createElement(
    "tui-text",
    {
      ...(isSelected ? { bold: true, inverse: true, color: colors.brand.primary } : {}),
      ...(isFocused && !isSelected ? { underline: true } : {}),
    },
    ds,
  );
}

const CalendarBase = React.memo(function Calendar(rawProps: CalendarProps): React.ReactElement {
  const colors = useColors();
  const props = usePluginProps("Calendar", rawProps);
  const {
    year,
    month: rawMonth,
    selectedDay: rawSelectedDay,
    onSelect,
    onMonthChange,
    color = colors.text.primary,
    selectedColor = colors.brand.primary,
    today: todayProp,
    isFocused = true,
    rangeStart,
    rangeEnd,
    disabledDates,
    weekStartsOn = 0,
  } = props;

  // Clamp month to 1-12
  const month = Math.max(1, Math.min(12, rawMonth));

  // Clamp selectedDay to valid range for this month
  const maxDay = getDaysInMonth(year, month);
  const selectedDay = rawSelectedDay !== undefined
    ? Math.max(1, Math.min(maxDay, rawSelectedDay))
    : undefined;

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onMonthChangeRef = useRef(onMonthChange);
  onMonthChangeRef.current = onMonthChange;
  const selectedDayRef = useRef(selectedDay);
  selectedDayRef.current = selectedDay;
  const yearRef = useRef(year);
  yearRef.current = year;
  const monthRef = useRef(month);
  monthRef.current = month;
  const disabledDatesRef = useRef(disabledDates);
  disabledDatesRef.current = disabledDates;

  /** Check if a day is disabled */
  const isDayDisabled = (day: number): boolean => {
    if (!disabledDatesRef.current) return false;
    return disabledDatesRef.current(new Date(yearRef.current, monthRef.current - 1, day));
  };

  const handleInput = useCallback((event: KeyEvent) => {
    const cb = onSelectRef.current;
    const day = selectedDayRef.current;
    if (!cb || day === undefined) return;

    const daysInMonth = getDaysInMonth(yearRef.current, monthRef.current);

    // Helper: find next non-disabled day in direction
    const findNextDay = (start: number, direction: 1 | -1, step: number): number => {
      let next = start + step * direction;
      if (next < 1 || next > daysInMonth) return start; // out of bounds, stay
      let attempts = 0;
      while (isDayDisabled(next) && attempts < daysInMonth) {
        next += direction;
        if (next < 1 || next > daysInMonth) return start;
        attempts++;
      }
      return next;
    };

    const prevMonth = (y: number, m: number): [number, number] =>
      m === 1 ? [y - 1, 12] : [y, m - 1];
    const nextMonth = (y: number, m: number): [number, number] =>
      m === 12 ? [y + 1, 1] : [y, m + 1];

    if (event.key === "left") {
      const next = day > 1 ? findNextDay(day, -1, 1) : daysInMonth;
      if (!isDayDisabled(next)) cb(next);
    } else if (event.key === "right") {
      const next = day < daysInMonth ? findNextDay(day, 1, 1) : 1;
      if (!isDayDisabled(next)) cb(next);
    } else if (event.key === "up") {
      if (day > 7) {
        const next = findNextDay(day, -1, 7);
        if (!isDayDisabled(next)) cb(next);
      } else {
        // In first week — go to previous month if callback exists
        const mcb = onMonthChangeRef.current;
        if (mcb) {
          const [py, pm] = prevMonth(yearRef.current, monthRef.current);
          mcb(py, pm);
        }
      }
    } else if (event.key === "down") {
      if (day + 7 <= daysInMonth) {
        const next = findNextDay(day, 1, 7);
        if (!isDayDisabled(next)) cb(next);
      } else {
        // Past month end — go to next month if callback exists
        const mcb = onMonthChangeRef.current;
        if (mcb) {
          const [ny, nm] = nextMonth(yearRef.current, monthRef.current);
          mcb(ny, nm);
        }
      }
    } else if (event.key === "pageup") {
      const mcb = onMonthChangeRef.current;
      if (mcb) {
        const [py, pm] = prevMonth(yearRef.current, monthRef.current);
        mcb(py, pm);
      }
    } else if (event.key === "pagedown") {
      const mcb = onMonthChangeRef.current;
      if (mcb) {
        const [ny, nm] = nextMonth(yearRef.current, monthRef.current);
        mcb(ny, nm);
      }
    }
  }, []);

  useInput(handleInput, { isActive: isFocused });

  const todayDate = todayProp ?? new Date();
  const isCurrentMonth = todayDate.getFullYear() === year && todayDate.getMonth() + 1 === month;
  const todayDay = isCurrentMonth ? todayDate.getDate() : -1;

  const rangeStartTime = rangeStart ? rangeStart.getTime() : null;
  const rangeEndTime = rangeEnd ? rangeEnd.getTime() : null;
  const hasRange = rangeStartTime !== null && rangeEndTime !== null;
  const rangeMin = hasRange ? Math.min(rangeStartTime!, rangeEndTime!) : 0;
  const rangeMax = hasRange ? Math.max(rangeStartTime!, rangeEndTime!) : 0;

  const isInRange = (day: number): boolean => {
    if (!hasRange) return false;
    const dayTime = new Date(year, month - 1, day).getTime();
    return dayTime >= rangeMin && dayTime <= rangeMax;
  };

  const daysInMonth = getDaysInMonth(year, month);
  const rawFirstDay = getFirstDayOfWeek(year, month);
  // Adjust for weekStartsOn
  const firstDay = weekStartsOn === 1
    ? (rawFirstDay === 0 ? 6 : rawFirstDay - 1)
    : rawFirstDay;

  const monthName = MONTH_NAMES[month - 1] ?? "";
  const headerText = `${monthName} ${year}`;

  const rows: React.ReactElement[] = [];

  // Month + year header with navigation hints
  rows.push(
    React.createElement(
      "tui-box",
      { key: "header", flexDirection: "row" },
      React.createElement(
        "tui-text",
        { key: "nav-left", color: colors.text.dim },
        "< ",
      ),
      React.createElement(
        "tui-text",
        { key: "title", bold: true, color },
        headerText,
      ),
      React.createElement(
        "tui-text",
        { key: "nav-right", color: colors.text.dim },
        " >",
      ),
    ),
  );

  // Day-of-week row
  const dayHeaders = weekStartsOn === 1 ? DAY_HEADERS_MON : DAY_HEADERS_SUN;
  rows.push(
    React.createElement(
      "tui-text",
      { key: "days", color: colors.text.secondary },
      dayHeaders,
    ),
  );

  let dayOfWeek = firstDay;

  for (let d = 1; d <= daysInMonth; ) {
    const weekKey = `week-${d}`;
    const weekChildren: React.ReactElement[] = [];
    const weekStartDay = d;

    // Leading spaces for first row
    if (weekStartDay === 1 && firstDay > 0) {
      weekChildren.push(
        React.createElement("tui-text", { key: "pad" }, "   ".repeat(firstDay)),
      );
    }

    const daysLeftInWeek = 7 - dayOfWeek;
    const weekEndDay = Math.min(daysInMonth, d + daysLeftInWeek - 1);

    for (let wd = d; wd <= weekEndDay; wd++) {
      const ds = String(wd).padStart(2, " ");
      const disabled = disabledDates ? disabledDates(new Date(year, month - 1, wd)) : false;
      const inRange = isInRange(wd);

      if (props.renderDay) {
        weekChildren.push(
          React.createElement(React.Fragment, { key: `d${wd}` }, props.renderDay(wd, { isSelected: wd === selectedDay, isToday: wd === todayDay, isDisabled: disabled, isInRange: inRange })),
        );
      } else if (disabled) {
        weekChildren.push(
          React.createElement(
            "tui-text",
            { key: `d${wd}`, color: colors.text.disabled, dim: true },
            ds,
          ),
        );
      } else if (wd === selectedDay) {
        weekChildren.push(
          React.createElement(
            "tui-text",
            { key: `d${wd}`, bold: true, inverse: true, color: selectedColor },
            ds,
          ),
        );
      } else if (inRange) {
        weekChildren.push(
          React.createElement(
            "tui-text",
            { key: `d${wd}`, color: selectedColor, inverse: true },
            ds,
          ),
        );
      } else if (wd === todayDay) {
        weekChildren.push(
          React.createElement(
            "tui-text",
            { key: `d${wd}`, color, underline: true },
            ds,
          ),
        );
      } else {
        weekChildren.push(
          React.createElement("tui-text", { key: `d${wd}`, color }, ds),
        );
      }
      if (wd < weekEndDay || (weekEndDay < daysInMonth && dayOfWeek + (wd - d) < 6)) {
        weekChildren.push(
          React.createElement("tui-text", { key: `s${wd}` }, " "),
        );
      }
    }

    rows.push(
      React.createElement("tui-box", { key: weekKey, flexDirection: "row" }, ...weekChildren),
    );

    d = weekEndDay + 1;
    dayOfWeek = 0;
  }

  const outerBoxProps: Record<string, unknown> = {
    flexDirection: "column",
    overflow: "hidden",
    role: "grid",
    "aria-label": props["aria-label"],
    ...pickLayoutProps(props),
  };

  return React.createElement(
    "tui-box",
    outerBoxProps,
    ...rows,
  );
});

export const Calendar = Object.assign(CalendarBase, {
  Root: CalendarRoot,
  Header: CalendarCompoundHeader,
  Grid: CalendarCompoundGrid,
  Day: CalendarCompoundDay,
});
