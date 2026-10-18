import { useRef, type PointerEvent } from "react";

/** 이만큼 넘게 끌면 탭이 아니라 끌기로 본다 */
const DRAG_THRESHOLD = 8;

export type SheetHandleProps = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

/**
 * 지도 화면 하단 시트 위쪽 손잡이. 누르면 시트를 접거나 펼치고,
 * 아래로 끌면 접고 위로 끌면 펼친다.
 */
export function SheetHandle({ collapsed, onCollapsedChange }: SheetHandleProps) {
  const drag = useRef<{ pointerId: number; startY: number } | null>(null);
  // 끌기로 처리한 직후 이어서 들어오는 click은 무시한다.
  const skipClick = useRef(false);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    skipClick.current = false;
    drag.current = { pointerId: event.pointerId, startY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    drag.current = null;
    const deltaY = event.clientY - start.startY;
    if (Math.abs(deltaY) < DRAG_THRESHOLD) return;
    skipClick.current = true;
    onCollapsedChange(deltaY > 0);
  }

  return <button type="button" className="hike-sheet-handle"
    aria-expanded={!collapsed} aria-label={collapsed ? "시트 펼치기" : "시트 접기"}
    onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}
    onPointerCancel={() => { drag.current = null; }}
    onClick={() => {
      if (skipClick.current) { skipClick.current = false; return; }
      onCollapsedChange(!collapsed);
    }} />;
}
