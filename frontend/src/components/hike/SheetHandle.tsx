import type { ButtonHTMLAttributes } from "react";

export type SheetHandleProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** 지도 화면 하단 시트 위쪽 손잡이. 동작은 useDraggableSheet의 handleProps로 받는다. */
export function SheetHandle(props: SheetHandleProps) {
  return <button type="button" className="hike-sheet-handle" {...props} />;
}
