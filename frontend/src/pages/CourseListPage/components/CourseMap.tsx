import { useMemo, useState } from "react";
import { CourseRouteMap, type CourseRouteMapProps } from "../../../components/map/CourseRouteMap";
import { useCourseFacilities } from "../../../hooks/useCourseFacilities";
import type { CourseSpot } from "../../../types/courseDetail";

import { Chip } from "../../../components/common/Chip";
import { MapAction } from "../../../components/map/MapAction";

const FILTERS = [
  ["all", "전체"], ["restroom", "화장실"], ["water", "음수대"], ["shelter", "쉼터"],
] as const;
type FacilityFilter = typeof FILTERS[number][0];
const EMPTY: readonly CourseSpot[] = [];

export function CourseMap(props: CourseRouteMapProps) {
  const [visible, setVisible] = useState(true);
  const [filter, setFilter] = useState<FacilityFilter>("all");
  const courseId = props.selected?.id ?? "";
  const serverId = props.selected?.routeSource ? props.selected.backendCourseId : undefined;
  const restrooms = useCourseFacilities(courseId, serverId, visible, "RESTROOM");
  const water = useCourseFacilities(courseId, serverId, visible, "DRINKING_WATER");
  const shelters = useCourseFacilities(courseId, serverId, visible, "SHELTER");
  const restroomSpots = restrooms.state.status === "success" ? restrooms.state.spots : EMPTY;
  const waterSpots = water.state.status === "success" ? water.state.spots : EMPTY;
  const shelterSpots = shelters.state.status === "success" ? shelters.state.spots : EMPTY;
  const spots = useMemo(() => [...restroomSpots, ...waterSpots, ...shelterSpots], [restroomSpots, waterSpots, shelterSpots]);
  const filtered = useMemo(() => filter === "all" ? spots : spots.filter(spot => spot.kind === filter), [filter, spots]);
  const byKind = { restroom: restrooms, water, shelter: shelters };
  const requests = filter === "all" ? Object.values(byKind) : [byKind[filter]];
  const failed = requests.filter(request => request.state.status === "error");
  const loading = requests.some(request => request.state.status === "loading");

  return <>
    <CourseRouteMap {...props} extraMapAction={serverId !== undefined && <MapAction
      className="course-facility-toggle" aria-label="시설 표시" aria-pressed={visible}
      variant={visible ? "neutral" : "brand"} onClick={() => setVisible(value => !value)}
      icon={<span>시설<strong>{visible ? "ON" : "OFF"}</strong></span>} />}
      spots={visible ? filtered : EMPTY} onSpotSelect={id => {
      const spot = spots.find(item => item.id === id);
      if (spot) props.onNotify(spot.name);
    }} />
    {visible && serverId !== undefined && <div className="course-facility-controls">
      <div className="course-facility-filters" role="group" aria-label="공식 시설 종류">
        {FILTERS.map(([kind, label]) => <Chip key={kind} label={label} selected={filter === kind}
          onClick={() => setFilter(kind)} />)}
      </div>
      <div className="course-facility-status" role="status">
        {failed.length ? "시설 조회 실패" : loading ? "시설 조회 중" : !filtered.length ? "주변 시설 없음" : ""}
        {failed.length > 0 && <button type="button" onClick={() => failed.forEach(request => request.retry())}>다시 시도</button>}
      </div>
    </div>}
  </>;
}
