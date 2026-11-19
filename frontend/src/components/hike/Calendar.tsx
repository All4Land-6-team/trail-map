import { useState } from "react";
import { toLocalDateKey } from "../../utils/dateTime";
import { Icon } from "../common/Icon";
import "../common/controls.css";
import "./hike.css";

function monthStart(value: Date | string): Date {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), 1);
  const match = value.match(/^(\d{4})(?:년\s*|-)(\d{1,2})/);
  if (!match) return new Date(2026, 8, 1);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? new Date(Number(match[1]), month - 1, 1) : new Date(2026, 8, 1);
}

/** 날짜 아래 점: 예정된 등산(회색) · 진행중 등산(연한 초록 테두리) · 완료한 등산(진한 초록) */
type DayStatus = "scheduled" | "inProgress" | "completed";

const STATUS_LABEL: Record<DayStatus, string> = { scheduled: "일정 있음", inProgress: "진행중 등산", completed: "완료한 등산" };

type CalendarDayProps = {
  day: number;
  date: Date;
  selected: boolean;
  status?: DayStatus;
  /** 상태별 점 색을 쓰지 않으면 모든 일정을 같은 초록 점으로 그린다 */
  colored: boolean;
  onClick?: (date: Date) => void;
};

function CalendarDay({ day, date, selected, status, colored, onClick }: CalendarDayProps) {
  return <button type="button" className={["af-calendar__day", selected && "af-calendar__day--selected"].filter(Boolean).join(" ")}
    aria-label={`${date.getFullYear()}년 ${date.getMonth() + 1}월 ${day}일${status ? `, ${STATUS_LABEL[status]}` : ""}`}
    aria-pressed={selected} onClick={() => onClick?.(date)}>
    <span>{day}</span>{status && <span className={["af-calendar__dot", colored && `af-calendar__dot--${status}`].filter(Boolean).join(" ")}
      aria-hidden="true" />}
  </button>;
}

export type CalendarProps = {
  month?: Date | string;
  selectedDate?: Date | string;
  scheduledDates?: readonly (Date | string)[];
  /** 주면 점 색을 상태별로 나누고 달력 아래에 범례를 보여 준다 (REC-01·02) */
  completedDates?: readonly (Date | string)[];
  inProgressDates?: readonly (Date | string)[];
  onMonthChange?: (month: Date) => void;
  onDateSelect?: (date: Date) => void;
  className?: string;
};

export function Calendar({
  month, selectedDate = "2026-09-23", scheduledDates = ["2026-09-23", "2026-09-27"],
  completedDates, inProgressDates, onMonthChange, onDateSelect, className,
}: CalendarProps) {
  const [internalMonth, setInternalMonth] = useState(() => new Date(2026, 8, 1));
  const displayedMonth = monthStart(month ?? internalMonth);
  const firstWeekday = displayedMonth.getDay();
  const daysInMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate();
  const scheduled = new Set(scheduledDates.map(toLocalDateKey));
  const completed = new Set((completedDates ?? []).map(toLocalDateKey));
  const inProgress = new Set((inProgressDates ?? []).map(toLocalDateKey));
  const colored = completedDates !== undefined || inProgressDates !== undefined;
  const statusOf = (key: string): DayStatus | undefined => completed.has(key) ? "completed"
    : inProgress.has(key) ? "inProgress" : scheduled.has(key) ? "scheduled" : undefined;

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
        const key = toLocalDateKey(date);
        return <CalendarDay key={key} day={day} date={date} selected={toLocalDateKey(selectedDate) === key}
          status={statusOf(key)} colored={colored} onClick={onDateSelect} />;
      })}
    </div>
    {colored && <ul className="af-calendar__legend">
      <li><span className="af-calendar__dot af-calendar__dot--completed" aria-hidden="true" />완료한 등산</li>
      {inProgress.size > 0 && <li><span className="af-calendar__dot af-calendar__dot--inProgress" aria-hidden="true" />진행중 등산</li>}
      <li><span className="af-calendar__dot af-calendar__dot--scheduled" aria-hidden="true" />예정된 등산</li>
    </ul>}
  </section>;
}
