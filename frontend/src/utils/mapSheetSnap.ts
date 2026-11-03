export type MapSheetLevel = "peek" | "content";

// 커뮤니티 산 선택·지도(useCommunitySheet)의 두 단계 동작과 같은 기준이다.
export const MAP_SHEET_PEEK = 32;
export const MAP_SHEET_CLEARANCE = 170;
export const MAP_SHEET_OPEN = 420;
export const MAP_SHEET_SETTLE_MS = 240;
export const clampMapSheet = (height: number, maximum: number) => Math.min(maximum, Math.max(MAP_SHEET_PEEK, height));

export function mapSheetMaximum(pageHeight: number, navigationHeight: number) {
  return Math.max(MAP_SHEET_PEEK, pageHeight - navigationHeight - MAP_SHEET_CLEARANCE);
}

export function releasedMapSheetLevel(height: number, contentHeight: number): MapSheetLevel {
  return height < (MAP_SHEET_PEEK + contentHeight) / 2 ? "peek" : "content";
}
