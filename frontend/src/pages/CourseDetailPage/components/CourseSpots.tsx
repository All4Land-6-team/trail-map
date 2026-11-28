import { useEffect, useRef } from "react";
import { Icon } from "../../../components/common/Icon";
import { Button } from "../../../components/common/Button";
import { TabBar } from "../../../components/layout";
import { EmptyState } from "../../../components/feedback";
import type { CourseFacilitiesState, CourseSpot, SpotCategory } from "../../../types/courseDetail";
import { isFoodSpot, SPOT_CATEGORIES, spotCategoryLabel } from "../../../utils/courseProfile";

import { CourseControl } from "./CourseControl";
import type { ComponentProps } from "react";
type Props = {
  control: ComponentProps<typeof CourseControl>;
  spots: readonly CourseSpot[];
  category: SpotCategory;
  selectedId?: string;
  /** 커뮤니티 코스 스팟 조회 결과(공식 시설·사용자 스팟). */
  spotsState: CourseFacilitiesState;
  onRetrySpots: () => void;
  onCategory: (category: SpotCategory) => void;
  onOpen: (spot: CourseSpot) => void;
};

const FACILITY_CATEGORIES: readonly SpotCategory[] = ["all", "shelter", "restroom", "water"];

export function CourseSpots({ control, spots, category, selectedId, spotsState, onRetrySpots, onCategory, onOpen }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const lastAutoScrolledFoodId = useRef<string | undefined>(undefined);
  const includesFacilities = FACILITY_CATEGORIES.includes(category);
  const includesNearby = category === 'food';
  const includesSpots = category !== 'control' && !includesNearby;
  const countReady = includesSpots && spotsState.status === 'success';
  const loadedSpots = spotsState.status === 'success' ? spotsState.spots : [];
  const selectedPlace = includesNearby ? spots.find(spot => spot.id === selectedId) : undefined;
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
    lastAutoScrolledFoodId.current = undefined;
  }, [category]);
  useEffect(() => {
    const list = listRef.current;
    const button = Array.from(list?.querySelectorAll<HTMLButtonElement>("[data-spot-id]") ?? []).find(item => item.dataset.spotId === selectedId);
    if (button && list) {
      const top = button.offsetTop < list.scrollTop ? button.offsetTop
        : button.offsetTop + button.offsetHeight > list.scrollTop + list.clientHeight
          ? button.offsetTop + button.offsetHeight - list.clientHeight : null;
      if (top !== null && (category !== "food" || lastAutoScrolledFoodId.current !== selectedId)) {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        list.scrollTo({ top, behavior: category === "food" && !reduced ? "smooth" : "auto" });
      }
      if (category === "food") lastAutoScrolledFoodId.current = selectedId;
    }
  }, [selectedId, spots, category]);
  return <section className="course-spots" data-category={category} role="tabpanel" id="course-spots-panel" aria-label="스팟·통제정보">
    <TabBar variant="scrollable" aria-label="스팟 카테고리" className="course-spots__categories" value={category}
      items={SPOT_CATEGORIES.map(item => ({ ...item, controls: "course-spots-content" }))}
      onValueChange={value => onCategory(value as SpotCategory)} />
    <h2>{spotCategoryLabel(category)}{category !== "control" && countReady ? ` · ${spots.length}곳` : ""}</h2>
    {includesFacilities && spotsState.status !== "unavailable" && <p className="course-spots__notice">
      공식 시설은 코스 경로에 연결된 시설만 표시합니다.
    </p>}
    {(category === "water" || (category === "all" && loadedSpots.some(spot => spot.kind === "water"))) && <p className="course-spots__notice">
      음수대는 샘터·약수터를 포함합니다. 현재 이용 가능 여부와 음용 적합 여부는 확인되지 않았어요.
    </p>}
    <div id="course-spots-content" className="course-spots__body" role="tabpanel" tabIndex={0} aria-label={spotCategoryLabel(category)}
      aria-busy={(category === "control" && control.state.status === "loading") || (includesSpots && spotsState.status === 'loading')}>
      {includesNearby && !selectedPlace && <p className="course-spots__status" role="status">선택한 장소 정보가 여기에 표시됩니다.</p>}
      {selectedPlace && <article className="course-place-detail" aria-label={`${selectedPlace.name} 상세 정보`}>
        <span className="course-place-detail__kind">{selectedPlace.kind === 'cafe' ? '카페' : '음식점'}</span>
        <h3>{selectedPlace.name}</h3>
        <dl>
          <div><dt>출처</dt><dd>OpenStreetMap 배경지도</dd></div>
          <div><dt>위치</dt><dd>{selectedPlace.coordinate.join(', ')}</dd></div>
        </dl>
      </article>}
      {includesSpots && spotsState.status === 'loading' && <p className="course-spots__status" role="status">스팟을 불러오는 중이에요.</p>}
      {includesSpots && spotsState.status === 'unavailable' && <p className="course-spots__status" role="status">이 코스의 스팟 조회를 준비 중이에요.</p>}
      {includesSpots && spotsState.status === 'error' && <div className="course-spots__status">
        <p role="alert">{spotsState.message}</p><Button variant="secondary" onClick={onRetrySpots}>스팟 다시 조회</Button>
      </div>}
      {category === "control" ? <CourseControl {...control} /> : category === "food" ? null : spots.length ? <div className="course-spots__list" ref={listRef}>
        {spots.map(spot => <button key={spot.id} type="button" className="course-spot-card" data-spot-id={spot.id}
          aria-label={spot.communityTarget && spot.id === selectedId ? `${spot.name} 커뮤니티 상세 보기` : `${spot.name} 지도에서 보기`}
          aria-pressed={spot.id === selectedId} onClick={() => onOpen(spot)}>
          <span><strong>{category === "all" ? `${spotCategoryLabel(spot.kind)} · ${spot.name}` : spot.name}</strong>
            {spot.communityTarget && <span>{spot.communityTarget.targetType === "USER_SPOT" ? "사용자 등록" : "공식 시설"}</span>}
            {isFoodSpot(spot) ? <>
              <span>{spot.kind === 'cafe' ? '카페' : '음식점'} · OpenStreetMap 지도 정보</span>
            </> : spot.facilityId !== undefined ? <>
              {spot.distanceMeters !== undefined && <span>경로까지 약 {Math.round(spot.distanceMeters)}m</span>}
              <span>사진 {spot.photoCount ?? 0}장 · 후기 {spot.reviewCount ?? 0}개</span>
            </> : spot.example ? <span>지도 표시 위치는 화면 예시입니다</span>
              : <span>사진 {spot.photoCount ?? 0}장 · 후기 {spot.reviewCount ?? 0}개</span>}
          </span><Icon name={spot.communityTarget ? "ChevronRight" : "Locate"} size={16} color="currentColor" />
        </button>)}
      </div> : countReady && <EmptyState title={includesFacilities && category !== "all"
        ? `조회된 ${spotCategoryLabel(category)}${category === "restroom" ? "이" : "가"} 없어요.` : "아직 등록된 스팟이 없어요."} description="" showIcon={false} className="course-detail-empty" />}
      {includesSpots && spots.some(spot => spot.distanceMeters !== undefined) && <p className="course-spots__distance-note">
        경로까지의 최단거리로, 도보 이동거리와는 다릅니다.
      </p>}
    </div>
  </section>;
}
