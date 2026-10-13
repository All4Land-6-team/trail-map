import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "../Icon";
import { Typography } from "../Typography";
import "../controls.css";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label?: string;
  children?: ReactNode;
  variant?: "primary" | "secondary";
  size?: "default" | "compact";
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  showLeadingIcon?: boolean;
  showTrailingIcon?: boolean;
};

export function Button({
  label = "버튼", children, variant = "primary", size = "default", fullWidth = false,
  leadingIcon, trailingIcon, showLeadingIcon = leadingIcon != null,
  showTrailingIcon = trailingIcon != null, className, disabled, type = "button", ...rest
}: ButtonProps) {
  return (
    <button {...rest} type={type} disabled={disabled}
      className={["af-button", `af-button--${variant}`, size === "compact" && "af-button--compact", fullWidth && "af-button--full-width", className].filter(Boolean).join(" ")}>
      {!disabled && showLeadingIcon && <span className="af-button__icon" aria-hidden="true">
        {leadingIcon ?? <Icon name="Bag" size={16} color="currentColor" />}
      </span>}
      {size === "compact"
        ? <Typography variant="descriptionSmall" style={{ fontWeight: 700 }}>{children ?? label}</Typography>
        : <Typography variant="buttonLabel">{children ?? label}</Typography>}
      {!disabled && showTrailingIcon && <span className="af-button__icon" aria-hidden="true">
        {trailingIcon ?? <Icon name="ArrowRight" size={16} color="currentColor" />}
      </span>}
    </button>
  );
}
