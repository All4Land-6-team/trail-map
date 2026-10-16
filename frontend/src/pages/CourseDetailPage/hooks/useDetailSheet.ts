import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

/** #14의 포인터 캡처 방식을 사용하되 하단 액션은 고정하고 시트 상단만 조절한다. */
export function useDetailSheet() {
  const rootRef = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(844);
  const [top, setTop] = useState<number | null>(null);
  const drag = useRef<{ id: number; y: number; top: number } | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => setHeight(root.clientHeight));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  const minimum = Math.min(100, height * 0.22);
  const maximum = Math.max(minimum, height - 72 - 140);
  const initial = Math.min(272, height * 0.35);
  const currentTop = clamp(top ?? initial, minimum, maximum);
  function move(next: number) { setTop(clamp(next, minimum, maximum)); }
  function finish(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    move(drag.current.top + event.clientY - drag.current.y);
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowUp") move(currentTop - 24);
    else if (event.key === "ArrowDown") move(currentTop + 24);
    else if (event.key === "Home") move(minimum);
    else if (event.key === "End") move(maximum);
    else return;
    event.preventDefault();
  }
  return {
    rootRef, sheetTop: currentTop,
    style: { "--detail-sheet-top": `${currentTop}px` } as CSSProperties,
    handleProps: {
      role: "separator", tabIndex: 0, "aria-label": "코스 정보 시트 높이 조절",
      "aria-orientation": "horizontal" as const, "aria-valuemin": Math.round(minimum),
      "aria-valuemax": Math.round(maximum), "aria-valuenow": Math.round(currentTop),
      onKeyDown, onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
        drag.current = { id: event.pointerId, y: event.clientY, top: currentTop };
        event.currentTarget.setPointerCapture(event.pointerId);
      }, onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        if (drag.current?.id === event.pointerId) move(drag.current.top + event.clientY - drag.current.y);
      }, onPointerUp: finish, onPointerCancel: () => { drag.current = null; },
      onLostPointerCapture: () => { drag.current = null; },
    },
  };
}
