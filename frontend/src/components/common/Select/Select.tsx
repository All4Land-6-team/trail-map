import type { SelectHTMLAttributes } from "react";
import { Icon } from "../Icon";
import "../controls.css";

export type SelectOption = { value: string; label: string; disabled?: boolean };
export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  options?: readonly SelectOption[];
  containerClassName?: string;
};

export function Select({
  options, value, defaultValue, containerClassName, className,
  "aria-label": ariaLabel = "선택 값", ...rest
}: SelectProps) {
  const fallback = String(value ?? defaultValue ?? "선택 값");
  const shownOptions = options ?? [{ value: fallback, label: fallback }];
  return <span className={["af-select-wrap", containerClassName].filter(Boolean).join(" ")}>
    <select {...rest} value={value} defaultValue={defaultValue} aria-label={ariaLabel}
      className={["af-select", className].filter(Boolean).join(" ")}>
      {shownOptions.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
    <span className="af-select__icon" aria-hidden="true"><Icon name="ChevronDown" size={16} color="currentColor" /></span>
  </span>;
}
