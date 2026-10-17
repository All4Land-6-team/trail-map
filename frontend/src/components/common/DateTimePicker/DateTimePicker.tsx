import { useState } from "react";
import { DatePicker, type DatePickerProps } from "./DatePicker";
import { TimePicker, type TimePickerProps } from "./TimePicker";
import "./date-time-picker.css";

export type DateTimeValue = {
  date: string;
  time: string;
};

export type DateTimePickerProps = {
  value: DateTimeValue;
  onChange: (value: DateTimeValue) => void;
  minDate?: DatePickerProps["minDate"];
  maxDate?: DatePickerProps["maxDate"];
  isDateDisabled?: DatePickerProps["isDateDisabled"];
  minTime?: TimePickerProps["minTime"];
  minuteStep?: TimePickerProps["minuteStep"];
  disabled?: boolean;
  dateLabel?: string;
  timeLabel?: string;
  today?: string;
  onPickerOpenChange?: (picker: "date" | "time" | null) => void;
  /** 값이 없을 때 칸에 보여 줄 안내 글자 */
  datePlaceholder?: string;
  timePlaceholder?: string;
  /** 입력 오류 상태 (빨간 테두리) */
  dateInvalid?: boolean;
  timeInvalid?: boolean;
};

export function DateTimePicker({
  value,
  onChange,
  minDate,
  maxDate,
  isDateDisabled,
  minTime,
  minuteStep = 10,
  disabled = false,
  dateLabel = "날짜",
  timeLabel = "시간",
  today,
  onPickerOpenChange,
  datePlaceholder,
  timePlaceholder,
  dateInvalid = false,
  timeInvalid = false,
}: DateTimePickerProps) {
  const [activePicker, setActivePicker] = useState<"date" | "time" | null>(null);

  function setPicker(picker: "date" | "time", open: boolean) {
    const next = open ? picker : null;
    setActivePicker(next);
    onPickerOpenChange?.(next);
  }

  return (
    <div className="af-date-time-picker-group">
      <DatePicker
        label={dateLabel}
        value={value.date}
        minDate={minDate}
        maxDate={maxDate}
        isDateDisabled={isDateDisabled}
        disabled={disabled}
        today={today}
        placeholder={datePlaceholder}
        invalid={dateInvalid}
        open={activePicker === "date"}
        onOpenChange={(open) => setPicker("date", open)}
        onChange={(date) => onChange({ ...value, date })}
      />
      <TimePicker
        label={timeLabel}
        value={value.time}
        minTime={minTime}
        minuteStep={minuteStep}
        disabled={disabled}
        placeholder={timePlaceholder}
        invalid={timeInvalid}
        open={activePicker === "time"}
        onOpenChange={(open) => setPicker("time", open)}
        onChange={(time) => onChange({ ...value, time })}
      />
    </div>
  );
}
