import { useId, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { Icon } from "../Icon";
import { Typography } from "../Typography";
import "../controls.css";

export type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
  helper?: string;
  showHelper?: boolean;
  showIcon?: boolean;
  icon?: ReactNode;
  state?: "empty" | "value" | "error";
  containerClassName?: string;
};

export function Field({
  label = "등산할 날짜", helper = "등산할 날짜를 선택해 주세요.",
  placeholder = "연도-월-일", showHelper = false, showIcon = true, icon,
  state, containerClassName, className, id, value, defaultValue, type,
  "aria-describedby": ariaDescribedBy, ...rest
}: FieldProps) {
  const generatedId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = id ?? generatedId;
  const isError = state === "error";
  // 날짜·시간 입력은 아이콘 버튼으로 브라우저 선택기를 연다.
  const isPicker = type === "date" || type === "time";
  const helperVisible = (showHelper || isError) && Boolean(helper);
  const helperId = `${inputId}-helper`;

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    try {
      input.showPicker?.();
    } catch {
      input.click();
    }
  }

  return <div className={["af-field", isError && "af-field--error", containerClassName].filter(Boolean).join(" ")}>
    <Typography as="label" htmlFor={inputId} variant="controlLabel" className="af-field__label">{label}</Typography>
    <div className="af-field__box">
      <input {...rest} ref={inputRef} id={inputId} type={type} value={value} defaultValue={defaultValue}
        placeholder={placeholder} aria-invalid={isError || undefined}
        aria-describedby={[ariaDescribedBy, helperVisible && helperId].filter(Boolean).join(" ") || undefined}
        className={["af-field__input", className].filter(Boolean).join(" ")} />
      {showIcon && (isPicker
        ? <button type="button" className="af-field__icon af-field__icon-button"
          aria-label={type === "time" ? "시간 선택 열기" : "날짜 선택 달력 열기"} onClick={openPicker}>
          {icon ?? <Icon name="Calendar" size={20} color="#83978a" />}
        </button>
        : <span className="af-field__icon" aria-hidden="true">
          {icon ?? <Icon name="Calendar" size={20} color="#83978a" />}
        </span>)}
    </div>
    {helperVisible && <Typography as="span" id={helperId} variant="descriptionSmall" className="af-field__helper">{helper}</Typography>}
  </div>;
}
