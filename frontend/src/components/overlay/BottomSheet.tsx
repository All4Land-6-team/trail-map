import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "../common/Icon";
import "../common/controls.css";
import "./overlay.css";

export type BottomSheetProps = Omit<HTMLAttributes<HTMLElement>, "content"> & {
  title: string;
  /** 제목 왼쪽에 놓는 아이콘 */
  titleIcon?: ReactNode;
  description?: string;
  showHandle?: boolean;
  showClose?: boolean;
  showDescription?: boolean;
  showFooter?: boolean;
  content?: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
};

export function BottomSheet({
  title, titleIcon, description, showHandle = true, showClose = true, showDescription = true,
  showFooter = false, content, footer, onClose, className, ...rest
}: BottomSheetProps) {
  const heading = <h2 className="af-bottom-sheet__title">{title}</h2>;
  return <section {...rest} aria-label={rest["aria-label"] ?? title}
    className={["af-bottom-sheet", className].filter(Boolean).join(" ")}>
    {showHandle && <div className="af-bottom-sheet__handle-row" aria-hidden="true"><span className="af-bottom-sheet__handle" /></div>}
    <div className="af-bottom-sheet__title-row">
      {titleIcon
        ? <div className="af-bottom-sheet__title-group"><span className="af-bottom-sheet__title-icon" aria-hidden="true">{titleIcon}</span>{heading}</div>
        : heading}
      {showClose && <button type="button" className="af-bottom-sheet__close" aria-label="닫기" onClick={onClose}>
        <Icon name="Close" size={24} color="currentColor" />
      </button>}
    </div>
    {showDescription && description && <p className="af-bottom-sheet__description">{description}</p>}
    <div className="af-bottom-sheet__content">{content}</div>
    {showFooter && <div className="af-bottom-sheet__footer">{footer}</div>}
  </section>;
}
