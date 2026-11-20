import { useMemo, useState } from "react";
import { CourseRouteMap, type CourseRouteMapProps } from "../../../components/map/CourseRouteMap";
import type { OsmFoodPoi } from "../../../components/map/osmFoodPoi";
import { useCourseFacilities } from "../../../hooks/useCourseFacilities";
import type { CourseSpot } from "../../../types/courseDetail";

import { Chip } from "../../../components/common/Chip";
import { MapAction } from "../../../components/map/MapAction";

const FILTERS = [
  ["all", "전체"], ["restroom", "화장실"], ["water", "음수대"], ["shelter", "쉼터"],
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
  const restrooms = useCourseFacilities(courseId, serverId, visible, "RESTROOM");
  const water = useCourseFacilities(courseId, serverId, visible, "DRINKING_WATER");
  const shelters = useCourseFacilities(courseId, serverId, visible, "SHELTER");
  const foodSelected = filter === "food";
  const restroomSpots = restrooms.state.status === "success" ? restrooms.state.spots : EMPTY;
  const waterSpots = water.state.status === "success" ? water.state.spots : EMPTY;
  const shelterSpots = shelters.state.status === "success" ? shelters.state.spots : EMPTY;
  const facilitySpots = useMemo(() => [...restroomSpots, ...waterSpots, ...shelterSpots],
    [restroomSpots, waterSpots, shelterSpots]);
  const filtered = useMemo(() => filter === "all" ? facilitySpots
    : filter === "food" ? EMPTY : facilitySpots.filter(spot => spot.kind === filter),
  [filter, facilitySpots]);
  const byKind = { restroom: restrooms, water, shelter: shelters };
  const requests = filter === "all" ? Object.values(byKind)
    : filter === "food" ? [] : [byKind[filter]];
  const failed = requests.filter(request => request.state.status === "error");
  const loading = requests.some(request => request.state.status === "loading");

  return <>
    <CourseRouteMap {...props} extraMapAction={serverId !== undefined && <MapAction
      className="course-facility-toggle" aria-label="시설 표시" aria-pressed={visible}
      variant={visible ? "neutral" : "brand"} onClick={() => setVisible(value => !value)}
      icon={<span>시설<strong>{visible ? "ON" : "OFF"}</strong></span>} />}
      spots={visible ? filtered : EMPTY} osmFoodEnabled={visible && foodSelected}
      selectedOsmFood={visible && foodSelected ? selectedOsmFood : null}
      onOsmFoodSelect={poi => {
        setOsmFoodSelection({ courseId, poi });
        onOsmFoodOpen?.(poi);
      }} onSpotSelect={id => {
      const spot = facilitySpots.find(item => item.id === id);
      if (spot) props.onNotify(spot.name);
    }} />
    {visible && serverId !== undefined && <div className="course-facility-controls">
      <div className="course-facility-filters" role="group" aria-label="시설 및 주변 장소 종류">
        {FILTERS.map(([kind, label]) => <Chip key={kind} label={label} selected={filter === kind}
          onClick={() => setFilter(kind)} />)}
      </div>
      <div className="course-facility-status" role="status">
        {!foodSelected && (failed.length ? "시설 조회 실패" : loading ? "시설 조회 중" : !filtered.length ? "주변 시설 없음" : "")}
        {failed.length > 0 && <button type="button" onClick={() => failed.forEach(request => request.retry())}>다시 시도</button>}
      </div>
    </div>}
  </>;
}
