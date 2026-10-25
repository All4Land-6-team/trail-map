import { useResizableMapSheet } from "../../../hooks/useResizableMapSheet";

export function useDetailSheet() {
  return useResizableMapSheet({ kind: "detail", navigationSelector: ".course-detail-page__nav", label: "코스 정보 시트 높이 조절" });
}
