import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "../Icon";
import { Typography } from "../Typography";
import { Calendar, type CalendarProps } from "./Calendar";
import { formatDateDisplay, toLocalDateKey } from "./dateTime";
import "./date-time-picker.css";

export type DatePickerProps = Omit<CalendarProps, "today"> & {
  label?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  today?: string;
  /** 값이 없을 때 칸에 보여 줄 안내 글자 */
  placeholder?: string;
  /** 입력 오류 상태 (빨간 테두리) */
  invalid?: boolean;
};

export function DatePicker({
  label = "날짜",
  value,
  onChange,
  minDate,
  maxDate,
  disabled,
  isDateDisabled,
  open: controlledOpen,
  onOpenChange,
  today = toLocalDateKey(new Date()),
  placeholder = "연도-월-일",
  invalid = false,
}: DatePickerProps) {
  const panelId = useId();
  const labelId = useId();
  const valueId = useId();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open && wasOpenRef.current) triggerRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  function setOpen(next: boolean) {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
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
          ? <span id={valueId}>{formatDateDisplay(value)}</span>
          : <span id={valueId} className="af-picker-field__placeholder">{placeholder}</span>}
        <Icon name="Calendar" size={20} color="#83978a" />
      </button>
      {open && (
        <div id={panelId} role="dialog" aria-label={`${label} 선택`} className="af-picker-panel"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }}>
          <Calendar
            value={value}
            onChange={(nextValue) => {
              onChange(nextValue);
              setOpen(false);
            }}
            minDate={minDate}
            maxDate={maxDate}
            disabled={disabled}
            isDateDisabled={isDateDisabled}
            today={today}
          />
          <div className="af-picker-panel__actions">
            <button type="button" onClick={() => setOpen(false)}>닫기</button>
            <button
              type="button"
              disabled={Boolean(minDate && today < minDate) || Boolean(maxDate && today > maxDate) || isDateDisabled?.(today)}
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
            >오늘</button>
          </div>
        </div>
      )}
    </div>
  );
}
