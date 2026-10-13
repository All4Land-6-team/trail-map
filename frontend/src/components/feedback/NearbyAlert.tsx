import type { HTMLAttributes } from "react";
import { Icon } from "../common/Icon";
import "../common/controls.css";
import "./feedback.css";

export type NearbyAlertProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  detail: string;
  showClose?: boolean;
  onClose?: () => void;
};

export function NearbyAlert({
  title, detail, showClose = true, onClose, className, ...rest
}: NearbyAlertProps) {
  return <div {...rest} role="status" className={["af-nearby-alert", className].filter(Boolean).join(" ")}>
    <span className="af-nearby-alert__copy">
      <span className="af-nearby-alert__title">{title}</span>
      <span className="af-nearby-alert__detail">{detail}</span>
    </span>
    {showClose && <button type="button" aria-label="알림 닫기" onClick={onClose}
      className="af-nearby-alert__close"><Icon name="Close" size={16} color="currentColor" /></button>}
  </div>;
}
