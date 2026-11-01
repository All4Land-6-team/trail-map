export type MapSheetKind = "home" | "courses" | "detail";

export function clampSheetHeight(height: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, height));
}

/** 하단 내비게이션과 상단 지도 영역을 남기고 시트의 조절 범위를 구한다. */
export function getMapSheetLayout(kind: MapSheetKind, pageHeight: number, navigationHeight: number, minimumMapHeight = 0) {
  const available = Math.max(0, pageHeight - navigationHeight);
  const preferredMinimum = kind === "home" ? 100 : kind === "courses" ? 160 : 140;
  const defaultClearance = kind === "home" ? Math.min(180, pageHeight * 0.4) : Math.min(100, pageHeight * 0.22);
  // Keep the sheet usable when a short viewport cannot accommodate both requested areas.
  const requestedClearance = Math.min(Math.max(0, minimumMapHeight), Math.max(0, available - preferredMinimum));
  const mapClearance = Math.max(defaultClearance, requestedClearance);
  const maximum = Math.max(0, available - mapClearance);
  const minimum = Math.min(preferredMinimum, maximum);
  const preferred = kind === "home" ? pageHeight <= 580 ? 150 : 165
    : kind === "courses" ? 296 : available - Math.min(272, pageHeight * 0.35);
  return { minimum, maximum, initial: clampSheetHeight(preferred, minimum, maximum) };
}
