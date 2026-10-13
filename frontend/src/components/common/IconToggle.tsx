import { useState, type ButtonHTMLAttributes } from "react";
import { Icon } from "./Icon";
import "./controls.css";

const bagSelected = new URL("../../assets/icons/bag-selected.svg", import.meta.url).href;
const calendarSelected = new URL("../../assets/icons/calendar-plus-selected.svg", import.meta.url).href;

export type IconToggleProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  icon: "save" | "schedule";
  selected?: boolean;
  defaultSelected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
};

export function IconToggle({
  icon, selected, defaultSelected = false, onSelectedChange,
  className, "aria-label": ariaLabel, onClick, type = "button", ...rest
}: IconToggleProps) {
  const [internalSelected, setInternalSelected] = useState(defaultSelected);
  const isSelected = selected ?? internalSelected;

  return <button {...rest} type={type} aria-pressed={isSelected}
    aria-label={ariaLabel ?? (icon === "save" ? "등산 담기" : "일정 등록")}
    onClick={event => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      if (selected === undefined) setInternalSelected(!isSelected);
      onSelectedChange?.(!isSelected);
    }}
    className={["af-icon-toggle", className].filter(Boolean).join(" ")}>
    {isSelected
      ? <img className="af-icon-toggle__asset" src={icon === "save" ? bagSelected : calendarSelected} alt="" />
      : <Icon name={icon === "save" ? "Bag" : "CalendarPlus"} size={21} color="currentColor" />}
  </button>;
}
