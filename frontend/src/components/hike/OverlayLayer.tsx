import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import "./hike.css";

export type OverlayLayerProps = {
  children: ReactNode;
  placement?: "center" | "bottom";
  /** 배경 클릭이나 Esc로 닫을 때 호출한다. 없으면 닫히지 않는다. */
  onDismiss?: () => void;
  /**
   * 바텀시트를 하단 내비게이션 위에 띄워 내비게이션이 보이게 한다 (Figma FLOW-06 · HIKE-04 · HIKE-09).
   * 화면에 내비게이션이 없으면 지금처럼 맨 아래에 붙는다.
   */
  aboveNav?: boolean;
};

/** 화면에 있는 하단 내비게이션 높이. 없으면 0 */
function measureNavHeight() {
  return document.querySelector<HTMLElement>(".af-bottom-nav")?.getBoundingClientRect().height ?? 0;
}

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** 화면을 어둡게 덮고 확인 창·바텀시트를 띄운다. 포커스를 안에 가두고 닫히면 원래 위치로 돌려준다. */
export function OverlayLayer({ children, placement = "center", onDismiss, aboveNav = false }: OverlayLayerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [navHeight, setNavHeight] = useState(0);

  // 그리기 전에 내비게이션 높이를 재서 시트가 한 번 내려갔다 올라오지 않게 한다.
  useLayoutEffect(() => {
    if (!aboveNav) return;
    const update = () => setNavHeight(measureNavHeight());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [aboveNav]);

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

  const style = aboveNav ? { "--af-overlay-nav-offset": `${navHeight}px` } as CSSProperties : undefined;

  return <div className={`af-overlay-layer af-overlay-layer--${placement}${aboveNav ? " af-overlay-layer--above-nav" : ""}`}
    style={style} onKeyDown={handleKeyDown}>
    <div className="af-overlay-layer__dim" aria-hidden="true" onClick={onDismiss} />
    <div ref={panelRef} className="af-overlay-layer__panel" tabIndex={-1}>{children}</div>
  </div>;
}
