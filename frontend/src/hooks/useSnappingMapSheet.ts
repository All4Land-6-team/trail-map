import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { clampMapSheet, mapSheetMaximum, MAP_SHEET_OPEN, MAP_SHEET_PEEK, MAP_SHEET_SETTLE_MS, releasedMapSheetLevel, type MapSheetLevel } from "../utils/mapSheetSnap";
import { createSheetPreviewSession } from "../utils/sheetPreviewSession";
import "../components/overlay/snapping-map-sheet.css";

type Options = {
  sheetSelector: string;
  navigationSelector: string;
  label: string;
  mapPreview?: boolean;
  trackSettledInset?: boolean;
};

/** 커뮤니티의 산 선택(auto)·지도(420px)와 같이, 드래그를 놓으면 접힘/펼침으로 안착한다. */
export function useSnappingMapSheet({ sheetSelector, navigationSelector, label, mapPreview = false, trackSettledInset = false }: Options) {
  const rootRef = useRef<HTMLElement>(null);
  const naturalHeight = useRef(240);
  const level = useRef<MapSheetLevel>("content");
  const drag = useRef<{ id: number; y: number; height: number; content: number; moved: boolean } | null>(null);
  const settleTimer = useRef<number | null>(null);
  const animationFrame = useRef<number | null>(null);
  const suppressClickUntil = useRef(0);
  const previewSession = useRef(createSheetPreviewSession());
  const [currentLevel, setCurrentLevel] = useState<MapSheetLevel>("content");
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [insets, setInsets] = useState({ initial: mapPreview ? MAP_SHEET_OPEN : 240, settled: mapPreview ? MAP_SHEET_OPEN : 240 });

  const currentSheet = useCallback(() => rootRef.current?.querySelector<HTMLElement>(sheetSelector), [sheetSelector]);
  const maximumHeight = useCallback(() => mapSheetMaximum(rootRef.current?.getBoundingClientRect().height ?? 844,
    rootRef.current?.querySelector(navigationSelector)?.getBoundingClientRect().height ?? 72), [navigationSelector]);
  const contentHeight = useCallback(() => {
    if (mapPreview) return clampMapSheet(MAP_SHEET_OPEN, maximumHeight());
    if (level.current === "content" && !drag.current && settleTimer.current === null) {
      naturalHeight.current = currentSheet()?.getBoundingClientRect().height ?? naturalHeight.current;
    }
    return clampMapSheet(naturalHeight.current, maximumHeight());
  }, [mapPreview, maximumHeight, currentSheet]);
  const stopAnimation = useCallback(() => {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
    settleTimer.current = null;
    animationFrame.current = null;
  }, []);
  const settle = useCallback((next: MapSheetLevel, from: number, to: number) => {
    stopAnimation();
    level.current = next;
    setCurrentLevel(next);
    setDragging(false);
    setDragHeight(from);
    animationFrame.current = window.requestAnimationFrame(() => {
      animationFrame.current = window.requestAnimationFrame(() => {
        animationFrame.current = null;
        setDragHeight(to);
      });
    });
    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = null;
      setDragHeight(null);
      setInsets(previous => ({ ...previous, settled: to }));
    }, MAP_SHEET_SETTLE_MS);
  }, [stopAnimation]);
  const changeLevel = useCallback((next: MapSheetLevel) => {
    if (next === level.current && settleTimer.current === null) return;
    const from = currentSheet()?.getBoundingClientRect().height ?? MAP_SHEET_PEEK;
    settle(next, from, next === "peek" ? MAP_SHEET_PEEK : contentHeight());
  }, [contentHeight, currentSheet, settle]);
  const beginPreview = useCallback(() => {
    if (drag.current || !previewSession.current.begin(currentSheet()?.getBoundingClientRect().height ?? MAP_SHEET_PEEK, level.current === "peek")) return;
    changeLevel("peek");
  }, [changeLevel, currentSheet]);
  const endPreview = useCallback(() => {
    const saved = previewSession.current.end();
    if (saved) changeLevel(saved.customized ? "peek" : "content");
  }, [changeLevel]);
  const previewControls = useMemo(() => ({ begin: beginPreview, end: endPreview }), [beginPreview, endPreview]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const session = previewSession.current;
    if (!root) return;
    let viewport = "", measureFrame: number | null = null;
    const observed = new Set<Element>();
    const schedule = () => {
      if (measureFrame !== null) return;
      measureFrame = window.requestAnimationFrame(() => { measureFrame = null; measure(); });
    };
    const observer = new ResizeObserver(schedule);
    function measure() {
      const sheet = currentSheet();
      const nav = root?.querySelector(navigationSelector);
      const nextViewport = `${root?.clientWidth}:${root?.clientHeight}:${nav?.getBoundingClientRect().height ?? 72}`;
      let interrupted = false;
      if (viewport && viewport !== nextViewport) {
        session.invalidate();
        interrupted = drag.current !== null || settleTimer.current !== null;
        drag.current = null;
        stopAnimation(); setDragHeight(null); setDragging(false);
      }
      viewport = nextViewport;
      for (const target of [root, nav, sheet]) if (target && !observed.has(target)) { observed.add(target); observer.observe(target); }
      for (const target of observed) if (target !== root && target !== nav && target !== sheet) { observer.unobserve(target); observed.delete(target); }
      if (interrupted) { schedule(); return; }
      if (!sheet || drag.current || settleTimer.current !== null) return;
      const expanded = contentHeight();
      const settled = level.current === "peek" ? MAP_SHEET_PEEK : expanded;
      setInsets(previous => previous.initial === expanded && previous.settled === settled ? previous : { initial: expanded, settled });
    }
    measure();
    const mutations = new MutationObserver(schedule);
    mutations.observe(root, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect(); mutations.disconnect(); window.removeEventListener("resize", schedule);
      if (measureFrame !== null) window.cancelAnimationFrame(measureFrame);
      stopAnimation(); drag.current = null; session.end();
    };
  }, [contentHeight, currentSheet, navigationSelector, stopAnimation]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let next: MapSheetLevel;
    if (event.key === "ArrowUp" || event.key === "Home") next = "content";
    else if (event.key === "ArrowDown" || event.key === "End") next = "peek";
    else if (event.key === "Enter" || event.key === " ") next = level.current === "peek" ? "content" : "peek";
    else return;
    event.preventDefault(); previewSession.current.invalidate(); changeLevel(next);
  }
  function cancelDrag() {
    drag.current = null; setDragging(false); setDragHeight(null);
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    if (start.moved) {
      const height = clampMapSheet(start.height + start.y - event.clientY, start.content);
      const next = releasedMapSheetLevel(height, start.content);
      settle(next, height, next === "peek" ? MAP_SHEET_PEEK : start.content);
      suppressClickUntil.current = window.performance.now() + 500;
    } else cancelDrag();
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const peek = currentLevel === "peek" && dragHeight === null;
  return {
    rootRef, peek, previewControls,
    mapBottomInset: trackSettledInset ? insets.settled : insets.initial,
    style: { "--map-sheet-transition": dragging ? "none" : "height 220ms ease-out",
      "--map-sheet-height": dragHeight === null ? currentLevel === "peek" ? `${MAP_SHEET_PEEK}px`
        : mapPreview ? "min(420px, calc(var(--app-viewport-height) - var(--map-sheet-nav-height) - 170px))" : "auto" : `${dragHeight}px` } as CSSProperties,
    handleProps: {
      role: "button", tabIndex: 0, "aria-label": `${label}: ${peek ? "열기" : "내리기"}`, "aria-expanded": !peek,
      onKeyDown,
      onClick: (event: MouseEvent<HTMLDivElement>) => {
        if (event.detail !== 0 && window.performance.now() < suppressClickUntil.current) return;
        previewSession.current.invalidate(); changeLevel(level.current === "peek" ? "content" : "peek");
      },
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (drag.current || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
        const height = currentSheet()?.getBoundingClientRect().height ?? MAP_SHEET_PEEK;
        const content = contentHeight();
        stopAnimation(); previewSession.current.invalidate();
        drag.current = { id: event.pointerId, y: event.clientY, height, content, moved: false };
        setDragHeight(height);
        setDragging(true);
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        if (Math.abs(event.clientY - start.y) > 5) start.moved = true;
        if (start.moved) setDragHeight(clampMapSheet(start.height + start.y - event.clientY, start.content));
      },
      onPointerUp: finish, onPointerCancel: cancelDrag, onLostPointerCapture: () => { if (drag.current) cancelDrag(); },
    },
  };
}
