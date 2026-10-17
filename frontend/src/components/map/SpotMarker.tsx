import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "../common/Icon";
import "../common/controls.css";
import "./markers.css";

export type SpotKind = "photo" | "shelter" | "water" | "restroom";
export type SpotMarkerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: SpotKind;
  compact?: boolean;
  label?: string;
};

const spotDefinitions: Record<SpotKind, { icon: IconName; label: string }> = {
  photo: { icon: "Photo", label: "사진 스팟" },
  shelter: { icon: "Shelter", label: "쉼터" },
  water: { icon: "Water", label: "음수대" },
  restroom: { icon: "Restroom", label: "화장실" },
};

export function SpotMarker({
  kind = "photo", compact = false, label, className, "aria-label": ariaLabel,
  type = "button", ...rest
}: SpotMarkerProps) {
  const spot = spotDefinitions[kind];
  return <button {...rest} type={type} data-kind={kind}
    aria-label={ariaLabel ?? spot.label}
    className={["af-spot-marker", compact && "af-spot-marker--compact", className].filter(Boolean).join(" ")}>
    {compact ? <span className="af-spot-marker__symbol">{kind === "restroom" ? <span className="af-spot-marker__wc">WC</span>
      : <Icon name={spot.icon} size={14} color="currentColor" />}</span>
      : <Icon name={spot.icon} size={18} color="currentColor" />}
    {label && <span className="af-spot-marker__label">{label}</span>}
  </button>;
}
