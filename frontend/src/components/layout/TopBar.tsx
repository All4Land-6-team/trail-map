import type { ReactNode } from "react";
import { Icon } from "../common/Icon";
import { Typography } from "../common/Typography";
import "../common/controls.css";
import "./navigation.css";

export type TopBarProps = {
  title: string;
  leading?: ReactNode;
  action?: ReactNode;
  showLeading?: boolean;
  showAction?: boolean;
  onBack?: () => void;
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
};

export function TopBar({
  title, leading, action, showLeading = true, showAction = true,
  onBack, onAction, actionLabel = "검색", className,
}: TopBarProps) {
  return <header className={["af-top-bar", className].filter(Boolean).join(" ")}>
    {showLeading && (leading ?? <button type="button" aria-label="뒤로 가기"
      onClick={onBack} className="af-top-bar__action">
      <Icon name="Back" size={24} color="currentColor" />
    </button>)}
    <Typography as="h1" variant="headingScreen" className="af-top-bar__title">{title}</Typography>
    {showAction && (action ?? <button type="button" aria-label={actionLabel}
      onClick={onAction} className="af-top-bar__action">
      <Icon name="Search" size={24} color="currentColor" />
    </button>)}
  </header>;
}
