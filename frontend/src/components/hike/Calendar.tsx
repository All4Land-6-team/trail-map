import { useState } from "react";
import { Icon } from "../common/Icon";
import "../common/controls.css";
import "./hike.css";

function dateKey(date: Date | string): string {
  if (typeof date === "string") return date.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthStart(value: Date | string): Date {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), 1);
  const match = value.match(/^(\d{4})(?:년\s*|-)(\d{1,2})/);
  if (!match) return new Date(2026, 8, 1);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? new Date(Number(match[1]), month - 1, 1) : new Date(2026, 8, 1);
}

type CalendarDayProps = {
  day: number;
  date: Date;
  selected: boolean;
  scheduled: boolean;
  onClick?: (date: Date) => void;
};

function CalendarDay({ day, date, selected, scheduled, onClick }: CalendarDayProps) {
  return <button type="button" className={["af-calendar__day", selected && "af-calendar__day--selected"].filter(Boolean).join(" ")}
    aria-label={`${date.getFullYear()}년 ${date.getMonth() + 1}월 ${day}일${scheduled ? ", 일정 있음" : ""}`}
    aria-pressed={selected} onClick={() => onClick?.(date)}>
    <span>{day}</span>{scheduled && <span className="af-calendar__dot" aria-hidden="true" />}
  </button>;
}

export type CalendarProps = {
  month?: Date | string;
  selectedDate?: Date | string;
  scheduledDates?: readonly (Date | string)[];
  onMonthChange?: (month: Date) => void;
  onDateSelect?: (date: Date) => void;
  className?: string;
};

export function Calendar({
  month, selectedDate = "2026-09-23", scheduledDates = ["2026-09-23", "2026-09-27"],
  onMonthChange, onDateSelect, className,
}: CalendarProps) {
  const [internalMonth, setInternalMonth] = useState(() => new Date(2026, 8, 1));
  const displayedMonth = monthStart(month ?? internalMonth);
  const firstWeekday = displayedMonth.getDay();
  const daysInMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate();
  const scheduled = new Set(scheduledDates.map(dateKey));

  function moveMonth(offset: number) {
    const next = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + offset, 1);
    if (month === undefined) setInternalMonth(next);
    onMonthChange?.(next);
  }

  return <section className={["af-calendar", className].filter(Boolean).join(" ")}
    aria-label={`${displayedMonth.getFullYear()}년 ${displayedMonth.getMonth() + 1}월 일정 달력`}>
    <div className="af-calendar__header">
      <button type="button" className="af-calendar__nav" aria-label="이전 달" onClick={() => moveMonth(-1)}>
        <Icon name="Back" size={18} color="currentColor" />
      </button>
      <span>{displayedMonth.getFullYear()}년 {displayedMonth.getMonth() + 1}월</span>
      <button type="button" className="af-calendar__nav" aria-label="다음 달" onClick={() => moveMonth(1)}>
        <Icon name="ChevronRight" size={18} color="currentColor" />
      </button>
    </div>
    <div className="af-calendar__grid" role="grid">
      {(["일", "월", "화", "수", "목", "금", "토"] as const).map((weekday) =>
        <span key={weekday} className="af-calendar__weekday" role="columnheader">{weekday}</span>)}
      {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} className="af-calendar__blank" />)}
      {Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const date = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), day);
        const key = dateKey(date);
        return <CalendarDay key={key} day={day} date={date} selected={dateKey(selectedDate) === key}
          scheduled={scheduled.has(key)} onClick={onDateSelect} />;
      })}
    </div>
  </section>;
}
