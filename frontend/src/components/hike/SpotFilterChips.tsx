import { Chip } from "../common/Chip";
import type { SpotFilter } from "./HikeRouteMap";
import "./hike.css";

const filters: readonly { id: SpotFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "shelter", label: "쉼터" },
  { id: "water", label: "음수대" },
  { id: "restroom", label: "화장실" },
  { id: "photo", label: "사진 스팟" },
  { id: "other", label: "기타" },
];

export type SpotFilterChipsProps = {
  value: SpotFilter;
  onChange: (filter: SpotFilter) => void;
  className?: string;
};

/** 지도 위 스팟 필터 (HIKE-03·05). 선택한 종류의 스팟만 지도에 표시한다. */
export function SpotFilterChips({ value, onChange, className }: SpotFilterChipsProps) {
  return <div className={["af-spot-filters", className].filter(Boolean).join(" ")} role="group" aria-label="스팟 필터">
    {filters.map(item => <Chip key={item.id} label={item.label} selected={value === item.id}
      onClick={event => { event.preventDefault(); onChange(item.id); }} />)}
  </div>;
}
