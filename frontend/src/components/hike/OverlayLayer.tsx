import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import "./hike.css";

export type OverlayLayerProps = {
  children: ReactNode;
  placement?: "center" | "bottom";
  /** 배경 클릭이나 Esc로 닫을 때 호출한다. 없으면 닫히지 않는다. */
  onDismiss?: () => void;
};

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** 화면을 어둡게 덮고 확인 창·바텀시트를 띄운다. 포커스를 안에 가두고 닫히면 원래 위치로 돌려준다. */
export function OverlayLayer({ children, placement = "center", onDismiss }: OverlayLayerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel)?.focus();
    return () => previous?.focus?.();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && onDismiss) {
      event.stopPropagation();
      onDismiss();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return <div className={`af-overlay-layer af-overlay-layer--${placement}`} onKeyDown={handleKeyDown}>
    <div className="af-overlay-layer__dim" aria-hidden="true" onClick={onDismiss} />
    <div ref={panelRef} className="af-overlay-layer__panel" tabIndex={-1}>{children}</div>
  </div>;
}
