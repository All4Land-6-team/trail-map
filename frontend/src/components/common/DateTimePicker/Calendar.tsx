import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Select } from "../Select";
import { buildCalendarDays, parseDateKey, toLocalDateKey } from "./dateTime";
import "./date-time-picker.css";

export type CalendarProps = {
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  isDateDisabled?: (dateKey: string) => boolean;
  today?: string;
};

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

function dateFromKey(dateKey: string) {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(year, month - 1, day);
}

export function Calendar({
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
  isDateDisabled,
  today = toLocalDateKey(new Date()),
}: CalendarProps) {
  const initialDate = parseDateKey(value || today);
  const [view, setView] = useState({ year: initialDate.year, month: initialDate.month - 1, sourceValue: value });
  const [focus, setFocus] = useState({ dateKey: value || today, sourceValue: value });
  const gridRef = useRef<HTMLDivElement>(null);
  const controlledDate = parseDateKey(value || today);
  const viewYear = view.sourceValue === value ? view.year : controlledDate.year;
  const viewMonth = view.sourceValue === value ? view.month : controlledDate.month - 1;
  const focusedDateKey = focus.sourceValue === value ? focus.dateKey : value || today;

  const days = useMemo(
    () => buildCalendarDays(viewYear, viewMonth, { minDate, maxDate, today, isDateDisabled }),
    [isDateDisabled, maxDate, minDate, today, viewMonth, viewYear],
  );
  const minYear = minDate ? parseDateKey(minDate).year : viewYear - 10;
  const maxYear = maxDate ? parseDateKey(maxDate).year : viewYear + 10;
  const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, index) => {
    const year = minYear + index;
    return { value: String(year), label: `${year}년` };
  });
  const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    value: String(index),
    label: `${index + 1}월`,
  }));
  const firstEnabledDate = days.find((date) => !date.disabled)?.dateKey;
  const focusableDateKey = days.some((date) => date.dateKey === focusedDateKey && !date.disabled)
    ? focusedDateKey
    : days.some((date) => date.dateKey === value && !date.disabled) ? value : firstEnabledDate;

  useEffect(() => {
    if (!focusableDateKey) return;
    gridRef.current?.querySelector<HTMLElement>(`[data-date-key="${focusableDateKey}"]`)?.focus();
  }, [focusableDateKey, viewMonth, viewYear]);

  function isUnavailable(dateKey: string) {
    return disabled
      || Boolean(minDate && dateKey < minDate)
      || Boolean(maxDate && dateKey > maxDate)
      || Boolean(isDateDisabled?.(dateKey));
  }

  function focusDate(date: Date) {
    let candidate = date;
    for (let index = 0; index < 42; index += 1) {
      const dateKey = toLocalDateKey(candidate);
      if (!isUnavailable(dateKey)) {
        setView({ year: candidate.getFullYear(), month: candidate.getMonth(), sourceValue: value });
        setFocus({ dateKey, sourceValue: value });
        return;
      }
      candidate = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate() + 1);
    }
  }

  function moveFocusByDays(currentDateKey: string, offset: number) {
    const current = dateFromKey(currentDateKey);
    let candidate = new Date(current.getFullYear(), current.getMonth(), current.getDate() + offset);
    const direction = offset < 0 ? -1 : 1;
    for (let index = 0; index < 42; index += 1) {
      const dateKey = toLocalDateKey(candidate);
      if (!isUnavailable(dateKey)) {
        setView({ year: candidate.getFullYear(), month: candidate.getMonth(), sourceValue: value });
        setFocus({ dateKey, sourceValue: value });
        return;
      }
      candidate = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate() + direction);
    }
  }

  function moveFocusByMonth(currentDateKey: string, offset: number) {
    const current = dateFromKey(currentDateKey);
    const lastDay = new Date(current.getFullYear(), current.getMonth() + offset + 1, 0).getDate();
    focusDate(new Date(current.getFullYear(), current.getMonth() + offset, Math.min(current.getDate(), lastDay)));
  }

  function handleDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, dateKey: string) {
    const date = dateFromKey(dateKey);
    const offsets: Partial<Record<string, number>> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -date.getDay(),
      End: 6 - date.getDay(),
    };
    const offset = offsets[event.key];
    if (offset !== undefined) {
      event.preventDefault();
      moveFocusByDays(dateKey, offset);
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      moveFocusByMonth(dateKey, event.key === "PageUp" ? -1 : 1);
    }
  }

  function changeMonth(offset: number) {
    const next = new Date(viewYear, viewMonth + offset, 1);
    setView({ year: next.getFullYear(), month: next.getMonth(), sourceValue: value });
  }

  const previousMonthKey = toLocalDateKey(new Date(viewYear, viewMonth, 0));
  const nextMonthKey = toLocalDateKey(new Date(viewYear, viewMonth + 1, 1));
  const previousDisabled = disabled || Boolean(minDate && previousMonthKey < minDate);
  const nextDisabled = disabled || Boolean(maxDate && nextMonthKey > maxDate);

  return (
    <div className="af-picker-calendar" aria-label="날짜 선택 달력">
      <div className="af-picker-calendar__header">
        <button type="button" className="af-picker-calendar__nav" aria-label="이전 달" disabled={previousDisabled} onClick={() => changeMonth(-1)}>‹</button>
        <div className="af-picker-calendar__selectors">
          <Select aria-label="연도 선택" value={String(viewYear)} options={yearOptions} disabled={disabled}
            onChange={(event) => setView({ year: Number(event.target.value), month: viewMonth, sourceValue: value })} />
          <Select aria-label="월 선택" value={String(viewMonth)} options={monthOptions} disabled={disabled}
            onChange={(event) => setView({ year: viewYear, month: Number(event.target.value), sourceValue: value })} />
        </div>
        <button type="button" className="af-picker-calendar__nav" aria-label="다음 달" disabled={nextDisabled} onClick={() => changeMonth(1)}>›</button>
      </div>

      <div className="af-picker-calendar__grid" role="grid" aria-label={`${viewYear}년 ${viewMonth + 1}월`} ref={gridRef}>
        <div className="af-picker-calendar__weekdays" role="row">
          {weekdays.map((weekday) => <span key={weekday} role="columnheader">{weekday}</span>)}
        </div>
        {Array.from({ length: 6 }, (_, weekIndex) => (
          <div className="af-picker-calendar__week" role="row" key={weekIndex}>
            {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((date) => (
              <button
                type="button"
                role="gridcell"
                key={date.dateKey}
                data-date-key={date.dateKey}
                tabIndex={date.dateKey === focusableDateKey ? 0 : -1}
                className={["af-picker-calendar__day", !date.inCurrentMonth && "af-picker-calendar__day--outside"].filter(Boolean).join(" ")}
                aria-label={`${date.dateKey}${date.isToday ? ", 오늘" : ""}`}
                aria-current={date.isToday ? "date" : undefined}
                aria-selected={date.dateKey === value}
                disabled={disabled || date.disabled}
                onFocus={() => setFocus({ dateKey: date.dateKey, sourceValue: value })}
                onClick={() => onChange(date.dateKey)}
                onKeyDown={(event) => handleDayKeyDown(event, date.dateKey)}
              >
                <span>{date.day}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
