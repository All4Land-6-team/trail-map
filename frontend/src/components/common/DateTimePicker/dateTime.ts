export type CalendarDay = {
  dateKey: string;
  day: number;
  inCurrentMonth: boolean;
  disabled: boolean;
  isToday: boolean;
};

type CalendarDayOptions = {
  minDate?: string;
  maxDate?: string;
  today?: string;
  isDateDisabled?: (dateKey: string) => boolean;
};

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

export function formatDateDisplay(dateKey: string) {
  const { year, month, day } = parseDateKey(dateKey);
  return `${year}. ${String(month).padStart(2, "0")}. ${String(day).padStart(2, "0")}.`;
}

export function buildCalendarDays(
  year: number,
  monthIndex: number,
  { minDate, maxDate, today = toLocalDateKey(new Date()), isDateDisabled }: CalendarDayOptions = {},
) {
  const firstDay = new Date(year, monthIndex, 1);
  const gridStart = new Date(year, monthIndex, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index): CalendarDay => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const dateKey = toLocalDateKey(date);
    return {
      dateKey,
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === monthIndex,
      disabled: Boolean(
        (minDate && dateKey < minDate)
        || (maxDate && dateKey > maxDate)
        || isDateDisabled?.(dateKey),
      ),
      isToday: dateKey === today,
    };
  });
}

export function formatTimeDisplay(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 || 12;
  return `${period} ${String(displayHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function isTimeAtOrAfter(time: string, minimumTime?: string) {
  return !minimumTime || time >= minimumTime;
}

export function getNextAvailableTime(time: string, minuteStep = 10) {
  const [hour, minute] = time.split(":").map(Number);
  const totalMinutes = hour * 60 + minute;
  const next = (Math.floor(totalMinutes / minuteStep) + 1) * minuteStep;
  if (next >= 24 * 60) return null;
  return formatTimeValue(Math.floor(next / 60), next % 60);
}
import { formatTimeValue, toLocalDateKey } from "../../../utils/dateTime.ts";

export { formatTimeValue, toLocalDateKey };
