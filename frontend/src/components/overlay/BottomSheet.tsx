import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "../common/Icon";
import "../common/controls.css";
import "./overlay.css";

export type BottomSheetProps = Omit<HTMLAttributes<HTMLElement>, "content"> & {
  title: string;
  description?: string;
  showHandle?: boolean;
  showClose?: boolean;
  showDescription?: boolean;
  showFooter?: boolean;
  content?: ReactNode;
  footer?: ReactNode;
  headerAction?: ReactNode;
  onClose?: () => void;
  handleProps?: HTMLAttributes<HTMLDivElement>;
};

export function BottomSheet({
  title, description, showHandle = true, showClose = true, showDescription = true,
  showFooter = false, content, footer, headerAction, onClose, handleProps, className, ...rest
}: BottomSheetProps) {
  return <section {...rest} aria-label={rest["aria-label"] ?? title}
    className={["af-bottom-sheet", className].filter(Boolean).join(" ")}>
    {showHandle && <div {...handleProps} className={["af-bottom-sheet__handle-row", handleProps?.className].filter(Boolean).join(" ")}
      aria-hidden={handleProps ? undefined : true}><span className="af-bottom-sheet__handle" /></div>}
    <div className="af-bottom-sheet__title-row">
      <h2 className="af-bottom-sheet__title">{title}</h2>
      {headerAction}
      {showClose && <button type="button" className="af-bottom-sheet__close" aria-label="닫기" onClick={onClose}>
        <Icon name="Close" size={24} color="currentColor" />
      </button>}
    </div>
    {showDescription && description && <p className="af-bottom-sheet__description">{description}</p>}
    <div className="af-bottom-sheet__content">{content}</div>
    {showFooter && <div className="af-bottom-sheet__footer">{footer}</div>}
  </section>;
}
