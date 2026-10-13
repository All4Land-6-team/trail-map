import type { InputHTMLAttributes } from "react";
import { Icon } from "../Icon";
import { Typography } from "../Typography";
import "../controls.css";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  label?: string;
  showLabel?: boolean;
  containerClassName?: string;
};

export function Checkbox({
  label = "고도", showLabel = false, containerClassName, className,
  "aria-label": ariaLabel, defaultChecked = true, ...rest
}: CheckboxProps) {
  return <label className={["af-checkbox", containerClassName].filter(Boolean).join(" ")}>
    <input {...rest} type="checkbox" defaultChecked={rest.checked === undefined ? defaultChecked : undefined}
      aria-label={showLabel ? ariaLabel : ariaLabel ?? label}
      className={["af-checkbox__input", className].filter(Boolean).join(" ")} />
    <span className="af-checkbox__box" aria-hidden="true"><Icon name="Check" size={13} color="#fff" /></span>
    {showLabel && <Typography variant="bodySmall" className="af-checkbox__label">{label}</Typography>}
  </label>;
}
