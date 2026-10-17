import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon";
import { Typography } from "../Typography";
import { formatTimeDisplay, formatTimeValue, isTimeAtOrAfter } from "./dateTime";
import "./date-time-picker.css";

type Period = "AM" | "PM";

export type TimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  minuteStep?: number;
  minTime?: string;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 값이 없을 때 칸에 보여 줄 안내 글자 */
  placeholder?: string;
  /** 입력 오류 상태 (빨간 테두리) */
  invalid?: boolean;
};

/** 값이 없을 때 시간 목록을 여는 기준 (오전 9시) */
const EMPTY_TIME_BASE = { period: "AM" as Period, hour: 9, minute: 0 };

function parseTime(value: string) {
  const [hour24, minute] = value.split(":").map(Number);
  return {
    period: (hour24 < 12 ? "AM" : "PM") as Period,
    hour: hour24 % 12 || 12,
    minute,
  };
}

function toTimeValue(period: Period, hour: number, minute: number) {
  const hour24 = period === "AM" ? hour % 12 : (hour % 12) + 12;
  return formatTimeValue(hour24, minute);
}

export function TimePicker({
  value,
  onChange,
  label = "시간",
  minuteStep = 10,
  minTime,
  disabled = false,
  open: controlledOpen,
  onOpenChange,
  placeholder = "--:--",
  invalid = false,
}: TimePickerProps) {
  const panelId = useId();
  const labelId = useId();
  const valueId = useId();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  // 값이 비어 있으면 아무것도 선택되지 않은 상태로 보여 주고, 고를 때는 오전 9시를 기준으로 한다.
  const parsed = value ? parseTime(value) : null;
  const selected = parsed ?? EMPTY_TIME_BASE;
  const selectedMinute = value ? parseTime(value).minute : undefined;
  const normalizedMinuteStep = Math.min(60, Math.max(1, minuteStep));
  const hours = Array.from({ length: 12 }, (_, index) => index + 1);
  const minutes = useMemo(() => {
    const options = Array.from(
      { length: Math.ceil(60 / normalizedMinuteStep) },
      (_, index) => index * normalizedMinuteStep,
    ).filter((minute) => minute < 60);
    if (selectedMinute !== undefined && !options.includes(selectedMinute)) options.push(selectedMinute);
    return options.sort((a, b) => a - b);
  }, [normalizedMinuteStep, selectedMinute]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        const panel = panelRef.current;
        (panel?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]:not(:disabled)')
          ?? panel?.querySelector<HTMLButtonElement>("button:not(:disabled)"))?.focus();
      });
    } else if (wasOpenRef.current) {
      triggerRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  function setOpen(next: boolean) {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }

  function isCandidateAllowed(period: Period, hour: number, minute: number) {
    return isTimeAtOrAfter(toTimeValue(period, hour, minute), minTime);
  }

  function periodHasOption(period: Period) {
    return hours.some((hour) => minutes.some((minute) => isCandidateAllowed(period, hour, minute)));
  }

  function hourHasOption(hour: number) {
    return minutes.some((minute) => isCandidateAllowed(selected.period, hour, minute));
  }

  function selectPeriod(period: Period) {
    const currentCandidate = toTimeValue(period, selected.hour, selected.minute);
    if (isTimeAtOrAfter(currentCandidate, minTime)) {
      onChange(currentCandidate);
      return;
    }
    const firstAllowed = hours
      .flatMap((hour) => minutes.map((minute) => toTimeValue(period, hour, minute)))
      .sort()
      .find((candidate) => isTimeAtOrAfter(candidate, minTime));
    if (firstAllowed) onChange(firstAllowed);
  }

  function selectHour(hour: number) {
    const currentCandidate = toTimeValue(selected.period, hour, selected.minute);
    if (isTimeAtOrAfter(currentCandidate, minTime)) {
      onChange(currentCandidate);
      return;
    }
    const firstAllowedMinute = minutes.find((minute) => isCandidateAllowed(selected.period, hour, minute));
    if (firstAllowedMinute != null) onChange(toTimeValue(selected.period, hour, firstAllowedMinute));
  }

  return (
    <div className="af-date-time-picker">
      <Typography id={labelId} as="span" variant="controlLabel" className="af-picker-field__label">{label}</Typography>
      <button
        ref={triggerRef}
        type="button"
        className={invalid ? "af-picker-field af-picker-field--error" : "af-picker-field"}
        aria-invalid={invalid || undefined}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        aria-labelledby={`${labelId} ${valueId}`}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        {value
          ? <span id={valueId}>{formatTimeDisplay(value)}</span>
          : <span id={valueId} className="af-picker-field__placeholder">{placeholder}</span>}
        <Icon name="Clock" size={20} color="#83978a" />
      </button>
      {open && (
        <div ref={panelRef} id={panelId} role="dialog" aria-label={`${label} 선택`}
          className="af-picker-panel af-time-picker" onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }}>
          <fieldset className="af-time-picker__group">
            <legend>오전 또는 오후</legend>
            <div className="af-time-picker__periods">
              {(["AM", "PM"] as const).map((period) => (
                <button
                  type="button"
                  key={period}
                  aria-pressed={parsed?.period === period}
                  disabled={!periodHasOption(period)}
                  onClick={() => selectPeriod(period)}
                >{period === "AM" ? "오전" : "오후"}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="af-time-picker__group">
            <legend>시</legend>
            <div className="af-time-picker__options af-time-picker__options--hours">
              {hours.map((hour) => (
                <button
                  type="button"
                  key={hour}
                  aria-pressed={parsed?.hour === hour}
                  disabled={!hourHasOption(hour)}
                  onClick={() => selectHour(hour)}
                >{String(hour).padStart(2, "0")}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="af-time-picker__group">
            <legend>분</legend>
            <div className="af-time-picker__options af-time-picker__options--minutes">
              {minutes.map((minute) => (
                <button
                  type="button"
                  key={minute}
                  aria-pressed={parsed?.minute === minute}
                  disabled={!isCandidateAllowed(selected.period, selected.hour, minute)}
                  onClick={() => onChange(toTimeValue(selected.period, selected.hour, minute))}
                >{String(minute).padStart(2, "0")}</button>
              ))}
            </div>
          </fieldset>
          <div className="af-picker-panel__actions">
            <button type="button" onClick={() => setOpen(false)}>선택 완료</button>
          </div>
        </div>
      )}
    </div>
  );
}
