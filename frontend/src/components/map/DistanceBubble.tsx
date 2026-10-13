import type { HTMLAttributes, ReactNode } from "react";
import "../common/controls.css";
import "./markers.css";

export type DistanceBubbleProps = HTMLAttributes<HTMLSpanElement> & {
  label?: string;
  children?: ReactNode;
};

export function DistanceBubble({
  label = "0.0 km", children, className, ...rest
}: DistanceBubbleProps) {
  return <span {...rest} className={["af-distance-bubble", className].filter(Boolean).join(" ")}>
    {children ?? label}
  </span>;
}
