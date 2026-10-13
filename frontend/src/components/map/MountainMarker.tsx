import type { ButtonHTMLAttributes } from "react";
import { Icon } from "../common/Icon";
import { Typography } from "../common/Typography";
import "../common/controls.css";
import "./markers.css";

export type MountainMarkerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "name"> & {
  name: string;
  selected?: boolean;
};

export function MountainMarker({
  name, selected = false, className, type = "button", ...rest
}: MountainMarkerProps) {
  return <button {...rest} type={type} aria-pressed={selected}
    className={["af-mountain-marker", className].filter(Boolean).join(" ")}>
    <Icon name="Mountain" size={24} color="var(--af-green)" />
    <Typography variant="controlLabel">{name}</Typography>
  </button>;
}
