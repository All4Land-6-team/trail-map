import type { ButtonHTMLAttributes } from "react";
import { Typography } from "../common/Typography";
import "../common/controls.css";
import "./navigation.css";

export type TabProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  selected?: boolean;
  variant?: "underline" | "segmented";
  controls?: string;
};

export function Tab({
  label, selected = false, variant = "underline", controls,
  className, type = "button", ...rest
}: TabProps) {
  return <button {...rest} type={type} role="tab"
    aria-selected={selected} aria-controls={controls}
    tabIndex={rest.tabIndex ?? 0}
    className={["af-tab", `af-tab--${variant}`, selected && "af-tab--selected", className].filter(Boolean).join(" ")}>
    <Typography variant="controlLabel">{label}</Typography>
  </button>;
}
