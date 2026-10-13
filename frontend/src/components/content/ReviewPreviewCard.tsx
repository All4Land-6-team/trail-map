import type { ButtonHTMLAttributes } from "react";
import { Icon } from "../common/Icon";
import "../common/controls.css";
import "./content.css";

export type ReviewPreviewCardProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  mountain: string;
  rating: string;
  hint?: string;
  showHint?: boolean;
  showArrow?: boolean;
};

export function ReviewPreviewCard({
  mountain, rating, hint = "산을 눌러 후기 보기", showHint = true,
  showArrow = true, className, type = "button", ...rest
}: ReviewPreviewCardProps) {
  return <button {...rest} type={type}
    className={["af-review-preview", className].filter(Boolean).join(" ")}>
    <span className="af-review-preview__icon" aria-hidden="true"><Icon name="Peak" size={24} color="currentColor" /></span>
    <span className="af-review-preview__copy">
      <span className="af-review-preview__mountain">{mountain}</span>
      <span className="af-review-preview__rating">{rating}</span>
      {showHint && <span className="af-review-preview__hint">{hint}</span>}
    </span>
    {showArrow && <span className="af-review-preview__arrow" aria-hidden="true"><Icon name="ChevronRight" size={16} color="currentColor" /></span>}
  </button>;
}
