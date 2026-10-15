import type { HTMLAttributes, ReactNode } from "react";
import { Typography } from "../Typography";
import "../controls.css";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { label?: string; children?: ReactNode };

export function Badge({ label = "태그 문구", children, className, ...rest }: BadgeProps) {
  return <span {...rest} className={["af-badge", className].filter(Boolean).join(" ")}>
    <Typography variant="controlLabel">{children ?? label}</Typography>
  </span>;
}
