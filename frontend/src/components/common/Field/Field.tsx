import { useId, type InputHTMLAttributes, type ReactNode } from "react";
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
  state, containerClassName, className, id, value, defaultValue,
  "aria-describedby": ariaDescribedBy, ...rest
}: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const isError = state === "error";
  const helperVisible = (showHelper || isError) && Boolean(helper);
  const helperId = `${inputId}-helper`;

  return <div className={["af-field", isError && "af-field--error", containerClassName].filter(Boolean).join(" ")}>
    <Typography as="label" htmlFor={inputId} variant="controlLabel" className="af-field__label">{label}</Typography>
    <div className="af-field__box">
      <input {...rest} id={inputId} value={value} defaultValue={defaultValue}
        placeholder={placeholder} aria-invalid={isError || undefined}
        aria-describedby={[ariaDescribedBy, helperVisible && helperId].filter(Boolean).join(" ") || undefined}
        className={["af-field__input", className].filter(Boolean).join(" ")} />
      {showIcon && <span className="af-field__icon" aria-hidden="true">
        {icon ?? <Icon name="Calendar" size={20} color="#83978a" />}
      </span>}
    </div>
    {helperVisible && <Typography as="span" id={helperId} variant="descriptionSmall" className="af-field__helper">{helper}</Typography>}
  </div>;
}
