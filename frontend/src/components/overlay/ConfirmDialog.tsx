import type { HTMLAttributes } from "react";
import { Button } from "../common/Button";
import { Icon } from "../common/Icon";
import "../common/controls.css";
import "./overlay.css";

export type ConfirmDialogProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title: string;
  body?: string;
  showBody?: boolean;
  showCancel?: boolean;
  cancelLabel?: string;
  confirmLabel?: string;
  onCancel?: () => void;
  onConfirm?: () => void;
  onClose?: () => void;
  confirmDisabled?: boolean;
};

export function ConfirmDialog({
  title, body, showBody = true, showCancel = true, cancelLabel = "취소 버튼",
  confirmLabel = "확인 버튼", onCancel, onConfirm, onClose, confirmDisabled = false, className, ...rest
}: ConfirmDialogProps) {
  return <section {...rest} role="dialog" aria-modal="true" aria-label={title}
    className={["af-confirm-dialog", onClose && "af-confirm-dialog--closable", className].filter(Boolean).join(" ")}>
    {onClose && <button type="button" className="af-confirm-dialog__close" aria-label="창 닫기" onClick={onClose}>
      <Icon name="Close" size={20} />
    </button>}
    <h2 className="af-confirm-dialog__title">{title}</h2>
    {showBody && body && <p className="af-confirm-dialog__body">{body}</p>}
    <div className="af-confirm-dialog__actions">
      {showCancel && <Button variant="secondary" fullWidth label={cancelLabel} onClick={onCancel} />}
      <Button fullWidth label={confirmLabel} onClick={onConfirm} disabled={confirmDisabled} />
    </div>
  </section>;
}
