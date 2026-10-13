import type { HTMLAttributes } from "react";
import { Icon } from "../common/Icon";
import "../common/controls.css";
import "./feedback.css";

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  type?: "search" | "saved";
  title?: string;
  description?: string;
};

export function EmptyState({
  type = "search", title = "조건에 맞는 코스가 없어요",
  description, className, ...rest
}: EmptyStateProps) {
  const detail = description ?? (type === "saved"
    ? "마음에 드는 코스를 담아 비교해보세요."
    : "필터를 줄여 다시 찾아보세요.");
  return <div {...rest} className={["af-empty-state", className].filter(Boolean).join(" ")}>
    <span className="af-empty-state__icon" aria-hidden="true">
      <Icon name={type === "saved" ? "Bag" : "Search"} size={24} color="currentColor" />
    </span>
    <h3 className="af-empty-state__title">{title}</h3>
    <p className="af-empty-state__description">{detail}</p>
  </div>;
}
