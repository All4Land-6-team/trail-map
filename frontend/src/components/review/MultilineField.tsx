import type { TextareaHTMLAttributes } from "react";
import "../common/controls.css";
import "./review.css";

export type MultilineFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function MultilineField({ className, placeholder = "산에서의 경험을 적어주세요", ...rest }: MultilineFieldProps) {
  return <textarea {...rest} className={["af-multiline-field", className].filter(Boolean).join(" ")}
    aria-label={rest["aria-label"] ?? "후기 내용"} placeholder={placeholder} />;
}
