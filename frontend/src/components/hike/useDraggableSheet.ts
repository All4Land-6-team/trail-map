import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

/** 이만큼 넘게 움직이면 탭이 아니라 끌기로 본다 */
const DRAG_THRESHOLD = 6;
const KEYBOARD_STEP = 24;
/** 접었을 때 제목 아래로 남기는 여백 */
const PEEK_PADDING = 16;
/** 시트가 지도 아래쪽을 덮는 둥근 모서리 높이 (지도 위 요소는 이만큼은 시트와 겹쳐도 된다) */
const SHEET_OVERLAP = 25;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * 지도 화면 하단 시트를 손잡이로 끌어 높이를 바꾼다 (등산 담기 「담은 코스」 시트와 같은 방식).
 * 끄는 동안 손가락을 따라 움직이고 놓은 자리에 멈춘다. 손잡이를 누르면 접힘 ↔ 펼침을 오간다.
 * 지도는 화면 전체 높이로 두고 시트만 그 위에서 translateY로 움직여, 끄는 동안 지도를 다시 그리지 않는다.
 * 지도 위 요소와 경로 맞춤은 시트 부모에 넣은 CSS 변수를 쓴다.
 * - `--hike-sheet-height`: 펼친 시트가 지도를 가리는 높이 (경로 맞춤 여백)
 * - `--hike-sheet-inset`: 지금 시트가 지도를 가리는 높이 (지도 아래쪽 요소 위치)
 */
export function useDraggableSheet() {
  const sheetRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [offset, setOffsetState] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [height, setHeight] = useState(0);
  const drag = useRef<{ pointerId: number; startY: number; startOffset: number; moved: boolean } | null>(null);
  const skipClick = useRef(false);
  const frame = useRef<number | null>(null);

  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);

  // 지도가 경로를 처음 맞추기 전에 시트 높이를 알 수 있도록 그리기 전에 잰다.
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    setHeight(sheet.offsetHeight);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(sheet.offsetHeight));
    observer.observe(sheet);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const parent = sheetRef.current?.parentElement;
    if (!parent) return;
    parent.style.setProperty("--hike-sheet-height", `${Math.max(0, height - SHEET_OVERLAP)}px`);
    parent.style.setProperty("--hike-sheet-inset", `${Math.max(0, height - offset - SHEET_OVERLAP)}px`);
  }, [height, offset]);

  /** 제목까지만 남기고 내릴 수 있는 최대 거리 */
  function maxOffset() {
    const sheet = sheetRef.current;
    const body = bodyRef.current;
    if (!sheet || !body) return 0;
    return Math.max(0, sheet.offsetHeight - body.offsetTop - PEEK_PADDING);
  }

  /** 내린 거리를 정하고, 끝까지 내렸으면 접힘으로 본다 (접힌 본문은 inert로 포커스를 막는다) */
  function setOffset(next: number, max = maxOffset()) {
    setOffsetState(next);
    setCollapsed(next > 0 && next >= max - 1);
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    skipClick.current = false;
    drag.current = { pointerId: event.pointerId, startY: event.clientY, startOffset: offset, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - start.startY;
    if (!start.moved && Math.abs(deltaY) < DRAG_THRESHOLD) return;
    if (!start.moved) { start.moved = true; setDragging(true); }
    const max = maxOffset();
    const next = clamp(start.startOffset + deltaY, 0, max);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => { frame.current = null; setOffset(next, max); });
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!start.moved) return;
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; }
    setOffset(clamp(start.startOffset + event.clientY - start.startY, 0, maxOffset()));
    setDragging(false);
    skipClick.current = true;
  }

  function cancelDrag() {
    drag.current = null;
    setDragging(false);
  }

  function handleClick() {
    if (skipClick.current) { skipClick.current = false; return; }
    setOffset(offset > 0 ? 0 : maxOffset());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const max = maxOffset();
    let next: number | undefined;
    if (event.key === "ArrowUp") next = offset - KEYBOARD_STEP;
    if (event.key === "ArrowDown") next = offset + KEYBOARD_STEP;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = max;
    if (next === undefined) return;
    event.preventDefault();
    setOffset(clamp(next, 0, max), max);
  }

  return {
    sheetRef,
    bodyRef,
    collapsed,
    sheetClassName: dragging ? "hike-draggable-sheet hike-draggable-sheet--dragging" : "hike-draggable-sheet",
    sheetStyle: { transform: `translateY(${offset}px)` } satisfies CSSProperties,
    handleProps: {
      "aria-expanded": offset === 0,
      "aria-label": offset === 0 ? "시트 접기" : "시트 펼치기",
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: cancelDrag,
      onLostPointerCapture: () => { if (drag.current) cancelDrag(); },
      onClick: handleClick,
      onKeyDown: handleKeyDown,
    },
  };
}
