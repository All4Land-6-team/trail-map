import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

type DraggableCartSheetOptions = {
  ariaLabel: string;
  openHeight: number;
  peekHeight?: number;
};

type CartSheetStyle = CSSProperties & {
  "--cart-sheet-height": string;
  "--cart-sheet-offset": string;
};

const KEYBOARD_STEP = 24;
const DEFAULT_PEEK_HEIGHT = 28;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function useDraggableCartSheet({
  ariaLabel,
  openHeight,
  peekHeight = DEFAULT_PEEK_HEIGHT,
}: DraggableCartSheetOptions) {
  const maxOffset = openHeight - peekHeight;
  const [storedOffset, setOffset] = useState(0);
  const offset = clamp(storedOffset, 0, maxOffset);
  const dragStart = useRef<{ pointerId: number; pointerY: number; offset: number } | null>(null);
  const pendingOffset = useRef<number | null>(null);
  const animationFrame = useRef<number | null>(null);

  function cancelPendingFrame() {
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
    animationFrame.current = null;
    pendingOffset.current = null;
  }

  useEffect(() => cancelPendingFrame, []);

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (
      dragStart.current
      || !event.isPrimary
      || (event.pointerType === "mouse" && event.button !== 0)
    ) return;

    dragStart.current = {
      pointerId: event.pointerId,
      pointerY: event.clientY,
      offset,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;

    pendingOffset.current = clamp(
      start.offset + event.clientY - start.pointerY,
      0,
      maxOffset,
    );
    if (animationFrame.current !== null) return;

    animationFrame.current = requestAnimationFrame(() => {
      animationFrame.current = null;
      if (pendingOffset.current === null) return;
      setOffset(pendingOffset.current);
      pendingOffset.current = null;
    });
  }

  function finishPointerDrag(event: PointerEvent<HTMLElement>) {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;

    cancelPendingFrame();
    setOffset(clamp(start.offset + event.clientY - start.pointerY, 0, maxOffset));
    dragStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function cancelPointerDrag(event: PointerEvent<HTMLElement>) {
    if (dragStart.current?.pointerId !== event.pointerId) return;

    cancelPendingFrame();
    dragStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    let nextOffset: number | undefined;
    if (event.key === "ArrowUp") nextOffset = offset - KEYBOARD_STEP;
    if (event.key === "ArrowDown") nextOffset = offset + KEYBOARD_STEP;
    if (event.key === "Home") nextOffset = 0;
    if (event.key === "End") nextOffset = maxOffset;
    if (nextOffset === undefined) return;

    event.preventDefault();
    setOffset(clamp(nextOffset, 0, maxOffset));
  }

  const sheetStyle: CartSheetStyle = {
    "--cart-sheet-height": `${openHeight}px`,
    "--cart-sheet-offset": `${offset}px`,
  };
  const closedPercent = Math.round((offset / maxOffset) * 100);

  return {
    bodyHidden: offset === maxOffset,
    handleProps: {
      role: "separator",
      tabIndex: 0,
      "aria-label": ariaLabel,
      "aria-orientation": "horizontal" as const,
      "aria-valuemin": 0,
      "aria-valuemax": maxOffset,
      "aria-valuenow": offset,
      "aria-valuetext": offset === 0 ? "열림" : offset === maxOffset ? "접힘" : `${closedPercent}% 닫힘`,
      onKeyDown: handleKeyDown,
      onLostPointerCapture: () => {
        cancelPendingFrame();
        dragStart.current = null;
      },
      onPointerCancel: cancelPointerDrag,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishPointerDrag,
    },
    sheetStyle,
  };
}
