import type { ReactNode } from "react";
import { Icon } from "../common/Icon";
import "../common/controls.css";
import "./review.css";

export type SpotTypeOption = { value: string; label: string; icon?: ReactNode };

type SpotTypeTileProps = SpotTypeOption & {
  selected: boolean;
  onClick: () => void;
};

function SpotTypeTile({ label, icon, selected, onClick }: SpotTypeTileProps) {
  return <button type="button" aria-pressed={selected} onClick={onClick}
    className={["af-spot-type-tile", selected && "af-spot-type-tile--selected"].filter(Boolean).join(" ")}>
    {icon ?? <Icon name="Shelter" size={24} />}
    <span>{label}</span>
  </button>;
}

export type SpotTypeSelectorProps = {
  options: readonly SpotTypeOption[];
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  label?: string;
};

export function SpotTypeSelector({ options, value, onChange, className, label = "스팟 종류" }: SpotTypeSelectorProps) {
  return <div role="group" aria-label={label} className={["af-spot-type-selector", className].filter(Boolean).join(" ")}>
    {options.map((option) => <SpotTypeTile key={option.value} {...option}
      selected={option.value === value} onClick={() => onChange?.(option.value)} />)}
  </div>;
}
