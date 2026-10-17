import type { ButtonHTMLAttributes } from "react";
import { Icon } from "../common/Icon";
import { Typography } from "../common/Typography";
import mountainPoint from "../../assets/icons/mountain-point.svg";
import "../common/controls.css";
import "./markers.css";

export type MountainMarkerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "name"> & {
  name: string;
  selected?: boolean;
  variant?: "default" | "point";
};

export function MountainMarker({
  name, selected = false, variant = "default", className, type = "button", ...rest
}: MountainMarkerProps) {
  return <button {...rest} type={type} aria-pressed={selected}
    className={["af-mountain-marker", variant === "point" && "af-mountain-marker--point", className].filter(Boolean).join(" ")}>
    {variant === "point"
      ? <img src={mountainPoint} alt="" className="af-mountain-marker__point" />
      : <Icon name="Mountain" size={24} color="var(--af-green)" />}
    <Typography variant="controlLabel" className="af-mountain-marker__label">{name}</Typography>
  </button>;
}
