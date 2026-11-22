import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "../common/Icon";
import "../common/controls.css";
import "./markers.css";

export type SpotKind = "photo" | "shelter" | "water" | "restroom";
export type SpotMarkerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: SpotKind;
  source?: "official" | "user";
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
  kind = "photo", source = "official", compact = false, label, className, "aria-label": ariaLabel,
  type = "button", ...rest
}: SpotMarkerProps) {
  const spot = spotDefinitions[kind];
  return <button {...rest} type={type} data-kind={kind} data-source={source}
    aria-label={[source === "user" ? "사용자 등록" : "", ariaLabel ?? spot.label].filter(Boolean).join(" ")}
    className={["af-spot-marker", compact && "af-spot-marker--compact", className].filter(Boolean).join(" ")}>
    {source === "user" && kind !== "photo" && <svg className="af-spot-marker__border" aria-hidden="true">
      <rect x="0.5" y="0.5" rx="50%" fill="none" stroke="currentColor" strokeDasharray="2 2" />
    </svg>}
    {compact ? <span className="af-spot-marker__symbol"><Icon name={spot.icon}
      size={kind === "restroom" ? 19 : 14} color="currentColor" /></span>
      : <Icon name={spot.icon} size={18} color="currentColor" />}
    {label && <span className="af-spot-marker__label">{label}</span>}
  </button>;
}
