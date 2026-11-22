import { useState } from "react";
import { CourseRouteMap, type CourseRouteMapProps } from "../../../components/map/CourseRouteMap";
import { useCourseMapSpots } from "../../../hooks/useCourseMapSpots";
import type { CourseSpot } from "../../../types/courseDetail";

import { Chip } from "../../../components/common/Chip";
import { MapAction } from "../../../components/map/MapAction";

const FILTERS = [
  ["all", "전체"], ["restroom", "화장실"], ["water", "음수대"], ["shelter", "쉼터"], ["photo", "사진 스팟"],
] as const;
type FacilityFilter = typeof FILTERS[number][0];
const EMPTY: readonly CourseSpot[] = [];

export function CourseMap(props: CourseRouteMapProps) {
  const [visible, setVisible] = useState(true);
  const [filter, setFilter] = useState<FacilityFilter>("all");
  const courseId = props.selected?.id ?? "";
  const serverId = props.selected?.routeSource ? props.selected.backendCourseId : undefined;
  const { spots, loading, failed } = useCourseMapSpots(courseId, props.mountainId ?? "", serverId,
    props.selected?.analysisReference?.mountainId, visible, filter);

  return <>
    <CourseRouteMap {...props} extraMapAction={serverId !== undefined && <MapAction
      className="course-facility-toggle" aria-label="스팟 표시" aria-pressed={visible}
      variant={visible ? "neutral" : "brand"} onClick={() => setVisible(value => !value)}
      icon={<span>스팟<strong>{visible ? "ON" : "OFF"}</strong></span>} />}
      spots={visible ? spots : EMPTY} onSpotSelect={id => {
      const spot = spots.find(item => item.id === id);
      if (spot) props.onNotify(spot.name);
    }} />
    {visible && serverId !== undefined && <div className="course-facility-controls">
      <div className="course-facility-filters" role="group" aria-label="스팟 종류">
        {FILTERS.map(([kind, label]) => <Chip key={kind} label={label} selected={filter === kind}
          onClick={() => setFilter(kind)} />)}
      </div>
      <div className="course-facility-status" role="status">
        {failed.length ? "스팟 조회 실패" : loading ? "스팟 조회 중" : !spots.length ? "주변 스팟 없음" : ""}
        {failed.length > 0 && <button type="button" onClick={() => failed.forEach(request => request.retry())}>다시 시도</button>}
      </div>
    </div>}
  </>;
}
