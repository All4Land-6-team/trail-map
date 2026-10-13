import type { ButtonHTMLAttributes } from "react";
import { Icon } from "../common/Icon";
import "../common/controls.css";
import "./content.css";

export type SavedMountainCardProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  mountain: string;
  courseCount: string;
};

export function SavedMountainCard({
  mountain, courseCount, className, type = "button", ...rest
}: SavedMountainCardProps) {
  return <button {...rest} type={type} className={["af-saved-mountain-card", className].filter(Boolean).join(" ")}>
    <span className="af-saved-mountain-card__emblem" aria-hidden="true"><Icon name="Mountain" size={24} color="currentColor" /></span>
    <span className="af-saved-mountain-card__info">
      <span className="af-saved-mountain-card__name">{mountain}</span>
      <span className="af-saved-mountain-card__count">{courseCount}</span>
    </span>
    <span className="af-saved-mountain-card__arrow" aria-hidden="true"><Icon name="ChevronRight" size={24} color="currentColor" /></span>
  </button>;
}
