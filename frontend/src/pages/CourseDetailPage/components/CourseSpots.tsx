import { useEffect, useRef } from "react";
import { Icon } from "../../../components/common/Icon";
import { Button } from "../../../components/common/Button";
import { TabBar } from "../../../components/layout";
import { EmptyState } from "../../../components/feedback";
import { COURSE_FACILITY_RADIUS_METERS } from "../../../api/courseFacilities";
import type { CourseFacilitiesState, CourseSpot, SpotCategory } from "../../../types/courseDetail";
import { SPOT_CATEGORIES, spotCategoryLabel } from "../../../utils/courseProfile";

const placeholderAsset = new URL("../../../assets/icons/control-placeholder.svg", import.meta.url).href;
type Props = {
  spots: readonly CourseSpot[];
  category: SpotCategory;
  selectedId?: string;
  restrooms: CourseFacilitiesState;
  onRetryRestrooms: () => void;
  shelters: CourseFacilitiesState;
  onRetryShelters: () => void;
  water: CourseFacilitiesState;
  onRetryWater: () => void;
  onCategory: (category: SpotCategory) => void;
  onOpen: (spot: CourseSpot) => void;
};

export function CourseSpots({ spots, category, selectedId, restrooms, onRetryRestrooms, water, onRetryWater, shelters, onRetryShelters, onCategory, onOpen }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const facilityGroups = [
    { kind: "shelter", label: "쉼터", state: shelters, retry: onRetryShelters },
    { kind: "restroom", label: "화장실", state: restrooms, retry: onRetryRestrooms },
    { kind: "water", label: "음수대", state: water, retry: onRetryWater },
  ].filter(group => category === "all" || category === group.kind);
  const includesFacilities = facilityGroups.length > 0;
  const countReady = facilityGroups.every(group => group.state.status === "success");
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [category]);
  useEffect(() => {
    const list = listRef.current;
    const button = Array.from(list?.querySelectorAll<HTMLButtonElement>("[data-spot-id]") ?? []).find(item => item.dataset.spotId === selectedId);
    if (button && list) {
      if (button.offsetTop < list.scrollTop) list.scrollTop = button.offsetTop;
      else if (button.offsetTop + button.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = button.offsetTop + button.offsetHeight - list.clientHeight;
    }
  }, [selectedId, spots]);
  return <section className="course-spots" role="tabpanel" id="course-spots-panel" aria-label="스팟·통제정보">
    <TabBar variant="scrollable" aria-label="스팟 카테고리" className="course-spots__categories" value={category}
      items={SPOT_CATEGORIES.map(item => ({ ...item, controls: "course-spots-content" }))}
      onValueChange={value => onCategory(value as SpotCategory)} />
    <h2>{spotCategoryLabel(category)}{category !== "control" && countReady ? ` · ${spots.length}곳` : ""}</h2>
    {includesFacilities && facilityGroups.some(group => group.state.status !== "unavailable") && <p className="course-spots__notice">
      시설은 코스 경로에서 {COURSE_FACILITY_RADIUS_METERS}m 이내입니다.
    </p>}
    {(category === "water" || (category === "all" && water.status === "success" && water.spots.length > 0)) && <p className="course-spots__notice">
      음수대는 샘터·약수터를 포함합니다. 현재 이용 가능 여부와 음용 적합 여부는 확인되지 않았어요.
    </p>}
    <div id="course-spots-content" className="course-spots__body" role="tabpanel" tabIndex={0} aria-label={spotCategoryLabel(category)}
      aria-busy={facilityGroups.some(group => group.state.status === "loading")}>
      {facilityGroups.map(({ kind, label, state, retry }) => <div key={kind}>
        {state.status === "loading" && <p className="course-spots__status" role="status">주변 {label}{kind === "restroom" ? "을" : "를"} 불러오는 중이에요.</p>}
        {state.status === "error" && <div className="course-spots__status">
          <p role="alert">{state.message}</p><Button variant="secondary" onClick={retry}>{label} 다시 조회</Button>
        </div>}
        {state.status === "unavailable" && <p className="course-spots__status" role="status">이 코스의 {label} 조회를 준비 중이에요.</p>}
        {category !== "all" && state.status === "success" && state.spots.length === 0 && <p className="course-spots__status" role="status">
          코스에서 {COURSE_FACILITY_RADIUS_METERS}m 이내에 조회된 {label}{kind === "restroom" ? "이" : "가"} 없어요.
        </p>}
      </div>)}
      {category === "control" ? <div className="course-control-placeholder">
        <img src={placeholderAsset} alt="" /><p>통제정보 이미지 추가 예정</p>
      </div> : spots.length ? <div className="course-spots__list" ref={listRef}>
        {spots.map(spot => <button key={spot.id} type="button" className="course-spot-card" data-spot-id={spot.id}
          aria-label={spot.facilityId !== undefined ? `${spot.name} 지도에서 보기` : undefined}
          aria-pressed={spot.id === selectedId} onClick={() => onOpen(spot)}>
          <span><strong>{category === "all" ? `${spotCategoryLabel(spot.kind)} · ${spot.name}` : spot.name}</strong>
            {spot.facilityId !== undefined ? <>
              <span>경로까지 약 {Math.round(spot.distanceMeters ?? 0)}m</span>
              <span>{spot.sourceDate ? `자료 기준 ${spot.sourceDate}` : "자료 기준일 미상"} · 현장 상태는 다를 수 있어요</span>
            </> : <span>지도 표시 위치는 화면 예시입니다</span>}
          </span><Icon name={spot.facilityId !== undefined ? "Locate" : "ChevronRight"} size={16} color="currentColor" />
        </button>)}
      </div> : (!includesFacilities || (category === "all" && countReady)) && <EmptyState title="아직 등록된 스팟이 없어요." description="" showIcon={false} className="course-detail-empty" />}
      {facilityGroups.some(group => group.state.status === "success" && group.state.spots.length > 0) && <p className="course-spots__distance-note">
        경로까지의 최단거리로, 도보 이동거리와는 다릅니다.
      </p>}
    </div>
  </section>;
}
