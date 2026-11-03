import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clampSheetHeight, getMapSheetLayout, type MapSheetKind } from "../utils/mapSheetGeometry";
import { createSheetPreviewSession } from "../utils/sheetPreviewSession";
import "../components/overlay/resizable-map-sheet.css";

type Options = { kind: MapSheetKind; navigationSelector: string; label: string; trackSettledInset?: boolean; minimumMapHeight?: number };
const KEYBOARD_STEP = 24;

/** 지도 크기는 유지하고 시트 높이만 프레임당 한 번 바꾼다. React 상태는 조절이 끝나면 반영한다. */
export function useResizableMapSheet({ kind, navigationSelector, label, trackSettledInset = false, minimumMapHeight = 0 }: Options) {
  const rootRef = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState(() => getMapSheetLayout(kind, 844, 72, minimumMapHeight));
  const [settledHeight, setSettledHeight] = useState(layout.initial);
  const limits = useRef(layout);
  const height = useRef<number | null>(null);
  const customized = useRef(false);
  const drag = useRef<{ id: number; y: number; height: number } | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<number | null>(null);
  const previewSession = useRef(createSheetPreviewSession());

  const cancelFrame = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    pending.current = null;
  }, []);
  const apply = useCallback((next: number) => {
    const value = clampSheetHeight(next, limits.current.minimum, limits.current.maximum);
    height.current = value;
    const root = rootRef.current;
    root?.style.setProperty("--map-sheet-height", `${value}px`);
    const handle = root?.querySelector<HTMLElement>("[data-map-sheet-handle]");
    handle?.setAttribute("aria-valuenow", String(Math.round(value)));
    handle?.setAttribute("aria-valuetext", `${Math.round(value)}픽셀 높이`);
    return value;
  }, []);
  const settle = useCallback((next: number) => {
    cancelFrame();
    setSettledHeight(apply(next));
  }, [apply, cancelFrame]);
  const beginPreview = useCallback(() => {
    // Do not interrupt a sheet gesture that already belongs to the user.
    if (drag.current || !previewSession.current.begin(height.current ?? limits.current.initial, customized.current)) return;
    settle(limits.current.minimum);
  }, [settle]);
  const endPreview = useCallback(() => {
    const saved = previewSession.current.end();
    if (!saved) return;
    customized.current = saved.customized;
    settle(saved.height);
  }, [settle]);
  const previewControls = useMemo(() => ({ begin: beginPreview, end: endPreview }), [beginPreview, endPreview]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const session = previewSession.current;
    if (!root) return;
    const measure = () => {
      cancelFrame();
      drag.current = null;
      const navigationHeight = root.querySelector(navigationSelector)?.getBoundingClientRect().height ?? 72;
      const next = getMapSheetLayout(kind, root.clientHeight, navigationHeight, minimumMapHeight);
      const previous = limits.current;
      const wasPreviewing = previewSession.current.active;
      if (previous.minimum !== next.minimum || previous.maximum !== next.maximum || previous.initial !== next.initial) {
        previewSession.current.invalidate();
      }
      limits.current = next;
      setLayout(previous => previous.minimum === next.minimum && previous.maximum === next.maximum
        && previous.initial === next.initial ? previous : next);
      setSettledHeight(apply((customized.current || wasPreviewing) && height.current !== null ? height.current : next.initial));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect(); window.removeEventListener("resize", measure);
      cancelFrame(); drag.current = null; session.end();
    };
  }, [kind, navigationSelector, minimumMapHeight, apply, cancelFrame]);

  function finish(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    customized.current = true;
    settle(start.height + start.y - event.clientY);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function cancelDrag() {
    if (!drag.current) return;
    drag.current = null;
    settle(height.current ?? limits.current.initial);
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = height.current ?? limits.current.initial;
    let next: number;
    if (event.key === "ArrowUp") next = current + KEYBOARD_STEP;
    else if (event.key === "ArrowDown") next = current - KEYBOARD_STEP;
    else if (event.key === "Home") next = limits.current.maximum;
    else if (event.key === "End") next = limits.current.minimum;
    else return;
    event.preventDefault();
    previewSession.current.invalidate();
    customized.current = true;
    settle(next);
  }

  return {
    rootRef,
    // Opt-in only: a gesture updates camera padding once it settles, never per drag frame.
    mapBottomInset: trackSettledInset ? settledHeight : layout.initial,
    previewControls,
    handleProps: {
      role: "separator", tabIndex: 0, "data-map-sheet-handle": "",
      "aria-label": label, "aria-orientation": "horizontal" as const,
      "aria-valuemin": Math.round(layout.minimum), "aria-valuemax": Math.round(layout.maximum),
      "aria-valuenow": Math.round(settledHeight), "aria-valuetext": `${Math.round(settledHeight)}픽셀 높이`,
      onKeyDown,
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (drag.current || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
        previewSession.current.invalidate();
        cancelFrame();
        drag.current = { id: event.pointerId, y: event.clientY, height: height.current ?? limits.current.initial };
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        pending.current = start.height + start.y - event.clientY;
        if (frame.current !== null) return;
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          if (pending.current !== null) apply(pending.current);
          pending.current = null;
        });
      },
      onPointerUp: finish, onPointerCancel: cancelDrag, onLostPointerCapture: cancelDrag,
    },
  };
}
