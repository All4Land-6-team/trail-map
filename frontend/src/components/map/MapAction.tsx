import { useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { Icon, type IconName } from "../common/Icon";
import "../common/controls.css";
import "./markers.css";

export type MapActionProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "neutral" | "brand";
  iconName?: IconName;
  icon?: ReactNode;
  dimensionMode?: "2D" | "3D";
  defaultDimensionMode?: "2D" | "3D";
  onDimensionModeChange?: (mode: "2D" | "3D") => void;
};

export function MapAction({
  variant = "neutral", iconName, icon, dimensionMode, defaultDimensionMode,
  onDimensionModeChange, className, onClick,
  "aria-label": ariaLabel, type = "button", ...rest
}: MapActionProps) {
  const resolvedIcon = iconName ?? (variant === "brand" ? "Plus" : "Locate");
  const isDimensionToggle = resolvedIcon === "3D" || dimensionMode != null || defaultDimensionMode != null;
  const [internalDimensionMode, setInternalDimensionMode] = useState(defaultDimensionMode ?? "3D");
  const currentDimensionMode = dimensionMode ?? internalDimensionMode;

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    if (event.defaultPrevented || !isDimensionToggle) return;
    const nextMode = currentDimensionMode === "2D" ? "3D" : "2D";
    if (dimensionMode === undefined) setInternalDimensionMode(nextMode);
    onDimensionModeChange?.(nextMode);
  }

  return <button {...rest} type={type} onClick={handleClick}
    aria-label={ariaLabel ?? (isDimensionToggle ? `${currentDimensionMode} 지도 모드` : variant === "brand" ? "추가" : "현재 위치")}
    data-dimension-mode={isDimensionToggle ? currentDimensionMode : undefined}
    className={["af-map-action", `af-map-action--${variant}`, isDimensionToggle && "af-map-action--dimension", className].filter(Boolean).join(" ")}>
    {isDimensionToggle
      ? <span className="af-map-action__dimension">{currentDimensionMode}</span>
      : icon ?? <Icon name={resolvedIcon} size={24} color="currentColor" />}
  </button>;
}
