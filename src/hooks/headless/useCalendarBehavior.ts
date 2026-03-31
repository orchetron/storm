/**
 * useCalendarBehavior — headless behavior hook for calendar/date picker.
 *
 * Extracts selected date, focused date, keyboard navigation (arrow keys,
 * pageup/pagedown for month switching), range selection, and disabled dates
 * from the Calendar component.
 *
 * Returns state + props objects with no JSX.
 */

import { useRef, useCallback } from "react";
import { useInput } from "../useInput.js";
import type { KeyEvent } from "../../input/types.js";

export interface UseCalendarBehaviorOptions {
  year: number;
  month: number;
  selectedDay?: number;
  onSelect?: (day: number) => void;
  onMonthChange?: (year: number, month: number) => void;
  isActive?: boolean;
  rangeStart?: Date;
  rangeEnd?: Date;
  disabledDates?: (date: Date) => boolean;
  weekStartsOn?: 0 | 1;
}

export interface CalendarDayInfo {
  day: number;
  isSelected: boolean;
  isToday: boolean;
  isDisabled: boolean;
  isInRange: boolean;
  isCurrentMonth: boolean;
  dayOfWeek: number;
}

export interface UseCalendarBehaviorResult {
  /** Currently selected day (clamped to valid range) */
  selectedDate: number | undefined;
  /** The focused date (same as selectedDate in this model) */
  focusedDate: number | undefined;
  /** Range start date (if range selection is active) */
  rangeStart: Date | undefined;
  /** Range end date (if range selection is active) */
  rangeEnd: Date | undefined;
  /** Current year */
  year: number;
  /** Current month (1-12) */
  month: number;
  /** Number of days in the current month */
  daysInMonth: number;
  /** Day of week of the first day (adjusted for weekStartsOn) */
  firstDayOfWeek: number;
  /** Navigate to previous month */
  prevMonth: () => void;
  /** Navigate to next month */
  nextMonth: () => void;
  /** Get props for a specific day */
  getDayProps: (day: number) => CalendarDayInfo;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export function useCalendarBehavior(options: UseCalendarBehaviorOptions): UseCalendarBehaviorResult {
  const {
    year,
    month: rawMonth,
    selectedDay: rawSelectedDay,
    onSelect,
    onMonthChange,
    isActive = true,
    rangeStart,
    rangeEnd,
    disabledDates,
    weekStartsOn = 0,
  } = options;

  const month = Math.max(1, Math.min(12, rawMonth));
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

  const isDayDisabled = (day: number): boolean => {
    if (!disabledDatesRef.current) return false;
    return disabledDatesRef.current(new Date(yearRef.current, monthRef.current - 1, day));
  };

  const prevMonth = useCallback(() => {
    const mcb = onMonthChangeRef.current;
    if (!mcb) return;
    const m = monthRef.current;
    const y = yearRef.current;
    if (m === 1) { mcb(y - 1, 12); }
    else { mcb(y, m - 1); }
  }, []);

  const nextMonth = useCallback(() => {
    const mcb = onMonthChangeRef.current;
    if (!mcb) return;
    const m = monthRef.current;
    const y = yearRef.current;
    if (m === 12) { mcb(y + 1, 1); }
    else { mcb(y, m + 1); }
  }, []);

  const handleInput = useCallback((event: KeyEvent) => {
    const cb = onSelectRef.current;
    const day = selectedDayRef.current;
    if (!cb || day === undefined) return;

    const daysInMonth = getDaysInMonth(yearRef.current, monthRef.current);

    const findNextDay = (start: number, direction: 1 | -1, step: number): number => {
      let next = start + step * direction;
      if (next < 1 || next > daysInMonth) return start;
      let attempts = 0;
      while (isDayDisabled(next) && attempts < daysInMonth) {
        next += direction;
        if (next < 1 || next > daysInMonth) return start;
        attempts++;
      }
      return next;
    };

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
        prevMonth();
      }
    } else if (event.key === "down") {
      if (day + 7 <= daysInMonth) {
        const next = findNextDay(day, 1, 7);
        if (!isDayDisabled(next)) cb(next);
      } else {
        nextMonth();
      }
    } else if (event.key === "pageup") {
      prevMonth();
    } else if (event.key === "pagedown") {
      nextMonth();
    }
  }, [prevMonth, nextMonth]);

  useInput(handleInput, { isActive });

  // Compute range
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

  const todayDate = new Date();
  const isCurrentMonth = todayDate.getFullYear() === year && todayDate.getMonth() + 1 === month;
  const todayDay = isCurrentMonth ? todayDate.getDate() : -1;

  const rawFirstDay = getFirstDayOfWeek(year, month);
  const firstDayOfWeek = weekStartsOn === 1
    ? (rawFirstDay === 0 ? 6 : rawFirstDay - 1)
    : rawFirstDay;

  const getDayProps = useCallback((day: number): CalendarDayInfo => {
    const disabled = disabledDates ? disabledDates(new Date(year, month - 1, day)) : false;
    return {
      day,
      isSelected: day === selectedDay,
      isToday: day === todayDay,
      isDisabled: disabled,
      isInRange: isInRange(day),
      isCurrentMonth: true,
      dayOfWeek: (getFirstDayOfWeek(year, month) + day - 1) % 7,
    };
  }, [year, month, selectedDay, todayDay, disabledDates, hasRange, rangeMin, rangeMax]);

  return {
    selectedDate: selectedDay,
    focusedDate: selectedDay,
    rangeStart,
    rangeEnd,
    year,
    month,
    daysInMonth: maxDay,
    firstDayOfWeek,
    prevMonth,
    nextMonth,
    getDayProps,
  };
}
