import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "../common/Icon";
import "../common/controls.css";
import "./overlay.css";

export type BottomSheetProps = Omit<HTMLAttributes<HTMLElement>, "content"> & {
  title: string;
  titleLeading?: ReactNode;
  description?: string;
  showHandle?: boolean;
  showClose?: boolean;
  showDescription?: boolean;
  showFooter?: boolean;
  content?: ReactNode;
  footer?: ReactNode;
  headerAction?: ReactNode;
  bodyHidden?: boolean;
  handleProps?: HTMLAttributes<HTMLDivElement>;
  onClose?: () => void;
};

export function BottomSheet({
  title, titleLeading, description, showHandle = true, showClose = true, showDescription = true,
  showFooter = false, content, footer, headerAction, bodyHidden = false, handleProps, onClose, className, ...rest
}: BottomSheetProps) {
  const {
    className: handleClassName,
    "aria-hidden": handleAriaHidden,
    ...interactiveHandleProps
  } = handleProps ?? {};

  return <section {...rest} aria-label={rest["aria-label"] ?? title}
    className={["af-bottom-sheet", className].filter(Boolean).join(" ")}>
    {showHandle && (
      <div
        {...interactiveHandleProps}
        className={["af-bottom-sheet__handle-row", handleClassName].filter(Boolean).join(" ")}
        aria-hidden={handleAriaHidden ?? (handleProps ? undefined : true)}
      >
        <span className="af-bottom-sheet__handle" />
      </div>
    )}
    <div className="af-bottom-sheet__body" aria-hidden={bodyHidden || undefined} inert={bodyHidden || undefined}>
      <div className="af-bottom-sheet__title-row">
        <div className="af-bottom-sheet__title-group">
          {titleLeading}
          <h2 className="af-bottom-sheet__title">{title}</h2>
        </div>
        {headerAction}
        {showClose && <button type="button" className="af-bottom-sheet__close" aria-label="닫기" onClick={onClose}>
          <Icon name="Close" size={24} color="currentColor" />
        </button>}
      </div>
      {showDescription && description && <p className="af-bottom-sheet__description">{description}</p>}
      <div className="af-bottom-sheet__content">{content}</div>
      {showFooter && <div className="af-bottom-sheet__footer">{footer}</div>}
    </div>
  </section>;
}
