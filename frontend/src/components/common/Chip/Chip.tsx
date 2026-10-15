import { useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { Icon } from "../Icon";
import { Typography } from "../Typography";
import "../controls.css";

export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  variant?: "filter" | "action";
  selected?: boolean;
  defaultSelected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  icon?: ReactNode;
  showIcon?: boolean;
};

export function Chip({
  label, variant = "filter", selected, defaultSelected = true, onSelectedChange,
  icon, showIcon = true, className, onClick, type = "button", ...rest
}: ChipProps) {
  const [internalSelected, setInternalSelected] = useState(defaultSelected);
  const isSelected = variant === "filter" && (selected ?? internalSelected);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    if (event.defaultPrevented || variant !== "filter") return;
    if (selected === undefined) setInternalSelected(!isSelected);
    onSelectedChange?.(!isSelected);
  }

  return <button {...rest} type={type} onClick={handleClick}
    aria-pressed={variant === "filter" ? isSelected : undefined}
    className={["af-chip", variant === "action" && "af-chip--action", isSelected && "af-chip--selected", className].filter(Boolean).join(" ")}>
    {variant === "action" && showIcon && <span className="af-chip__icon" aria-hidden="true">
      {icon ?? <Icon name="Mountain" size={17} color="currentColor" />}
    </span>}
    <Typography variant="controlLabel">{label}</Typography>
  </button>;
}
