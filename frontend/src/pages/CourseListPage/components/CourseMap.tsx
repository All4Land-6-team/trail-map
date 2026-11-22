import { useState } from "react";
import { CourseRouteMap, type CourseRouteMapProps } from "../../../components/map/CourseRouteMap";
import type { OsmFoodPoi } from "../../../components/map/osmFoodPoi";
import { useCourseMapSpots } from "../../../hooks/useCourseMapSpots";
import type { CourseSpot } from "../../../types/courseDetail";

import { Chip } from "../../../components/common/Chip";
import { MapAction } from "../../../components/map/MapAction";

const FILTERS = [
  ["all", "전체"], ["restroom", "화장실"], ["water", "음수대"], ["shelter", "쉼터"], ["photo", "사진 스팟"],
  ["food", "음식점"],
] as const;
type FacilityFilter = typeof FILTERS[number][0];
const EMPTY: readonly CourseSpot[] = [];

type CourseMapProps = CourseRouteMapProps & { onOsmFoodOpen?: (poi: OsmFoodPoi) => void };

export function CourseMap({ onOsmFoodOpen, ...props }: CourseMapProps) {
  const [visible, setVisible] = useState(true);
  const [filter, setFilter] = useState<FacilityFilter>("all");
  const [osmFoodSelection, setOsmFoodSelection] = useState<{ courseId: string; poi: OsmFoodPoi } | null>(null);
  const courseId = props.selected?.id ?? "";
  const selectedOsmFood = osmFoodSelection?.courseId === courseId ? osmFoodSelection.poi : null;
  const serverId = props.selected?.routeSource ? props.selected.backendCourseId : undefined;
  const foodSelected = filter === "food";
  const { spots, loading, failed } = useCourseMapSpots(courseId, props.mountainId ?? "", serverId,
    props.selected?.analysisReference?.mountainId, visible && !foodSelected, foodSelected ? "all" : filter);

  return <>
    <CourseRouteMap {...props} extraMapAction={serverId !== undefined && <MapAction
      className="course-facility-toggle" aria-label={visible ? "코스 스팟 숨기기" : "코스 스팟 표시하기"} aria-pressed={visible}
      style={{ color: visible ? "#fff" : "#849d89", backgroundColor: visible ? "#19765b" : "#fff" }}
      onClick={() => setVisible(value => !value)}
      icon={<span className="course-facility-toggle__icon" aria-hidden="true" />} />}
      spots={visible && !foodSelected ? spots : EMPTY} osmFoodEnabled={visible && foodSelected}
      selectedOsmFood={visible && foodSelected ? selectedOsmFood : null}
      onOsmFoodSelect={poi => {
        setOsmFoodSelection({ courseId, poi });
        onOsmFoodOpen?.(poi);
      }} onSpotSelect={id => {
      const spot = spots.find(item => item.id === id);
      if (spot) props.onNotify(spot.name);
    }} />
    {visible && serverId !== undefined && <div className="course-facility-controls">
      <div className="course-facility-filters" role="group" aria-label="스팟 및 주변 장소 종류">
        {FILTERS.map(([kind, label]) => <Chip key={kind} label={label} selected={filter === kind}
          onClick={() => setFilter(kind)} />)}
      </div>
      <div className="course-facility-status" role="status">
        {!foodSelected && (failed.length ? "스팟 조회 실패" : loading ? "스팟 조회 중" : !spots.length ? "주변 스팟 없음" : "")}
        {failed.length > 0 && <button type="button" onClick={() => failed.forEach(request => request.retry())}>다시 시도</button>}
      </div>
    </div>}
  </>;
}
