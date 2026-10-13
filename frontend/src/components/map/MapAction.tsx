import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "../common/Icon";
import "../common/controls.css";
import "./markers.css";

export type MapActionProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "neutral" | "brand";
  iconName?: IconName;
  icon?: ReactNode;
};

export function MapAction({
  variant = "neutral", iconName, icon, className,
  "aria-label": ariaLabel, type = "button", ...rest
}: MapActionProps) {
  const resolvedIcon = iconName ?? (variant === "brand" ? "Plus" : "Locate");
  return <button {...rest} type={type}
    aria-label={ariaLabel ?? (resolvedIcon === "3D" ? "3D 전환" : variant === "brand" ? "추가" : "현재 위치")}
    className={["af-map-action", `af-map-action--${variant}`, className].filter(Boolean).join(" ")}>
    {icon ?? <Icon name={resolvedIcon} size={24} color="currentColor" />}
  </button>;
}
