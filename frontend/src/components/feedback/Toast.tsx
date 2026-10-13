import type { HTMLAttributes } from "react";
import "../common/controls.css";
import "./feedback.css";

export type ToastProps = HTMLAttributes<HTMLDivElement> & { message: string };

export function Toast({ message, className, ...rest }: ToastProps) {
  return <div {...rest} role="status" aria-live="polite"
    className={["af-toast", className].filter(Boolean).join(" ")}>{message}</div>;
}
