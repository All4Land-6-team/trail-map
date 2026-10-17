import { useEffect, useRef } from "react";
import { Icon } from "../../../components/common/Icon";
import { TabBar } from "../../../components/layout";
import { EmptyState } from "../../../components/feedback";
import type { CourseSpot, SpotCategory } from "../../../types/courseDetail";
import { SPOT_CATEGORIES, spotCategoryLabel } from "../../../utils/courseProfile";

const placeholderAsset = new URL("../../../assets/icons/control-placeholder.svg", import.meta.url).href;
type Props = {
  spots: readonly CourseSpot[];
  category: SpotCategory;
  selectedId?: string;
  onCategory: (category: SpotCategory) => void;
  onOpen: (spot: CourseSpot) => void;
};

export function CourseSpots({ spots, category, selectedId, onCategory, onOpen }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [category]);
  useEffect(() => {
    const list = listRef.current;
    const button = Array.from(list?.querySelectorAll<HTMLButtonElement>("[data-spot-id]") ?? []).find(item => item.dataset.spotId === selectedId);
    if (button && list) {
      if (button.offsetTop < list.scrollTop) list.scrollTop = button.offsetTop;
      else if (button.offsetTop + button.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = button.offsetTop + button.offsetHeight - list.clientHeight;
    }
  }, [selectedId]);
  return <section className="course-spots" role="tabpanel" id="course-spots-panel" aria-label="스팟·통제정보">
    <TabBar variant="scrollable" aria-label="스팟 카테고리" className="course-spots__categories" value={category}
      items={SPOT_CATEGORIES.map(item => ({ ...item, controls: "course-spots-content" }))}
      onValueChange={value => onCategory(value as SpotCategory)} />
    <h2>{spotCategoryLabel(category)}{category !== "control" ? ` · ${spots.length}곳` : ""}</h2>
    <div id="course-spots-content" className="course-spots__body" role="tabpanel" tabIndex={0} aria-label={spotCategoryLabel(category)}>
      {category === "control" ? <div className="course-control-placeholder">
        <img src={placeholderAsset} alt="" /><p>통제정보 이미지 추가 예정</p>
      </div> : spots.length ? <div className="course-spots__list" ref={listRef}>
        {spots.map(spot => <button key={spot.id} type="button" className="course-spot-card" data-spot-id={spot.id}
          aria-pressed={spot.id === selectedId} onClick={() => onOpen(spot)}>
          <span><strong>{category === "all" ? `${spotCategoryLabel(spot.kind)} · ${spot.name}` : spot.name}</strong>
            <span>지도 표시 위치는 화면 예시입니다</span></span><Icon name="ChevronRight" size={16} color="currentColor" />
        </button>)}
      </div> : <EmptyState title="아직 등록된 스팟이 없어요." description="" showIcon={false} className="course-detail-empty" />}
    </div>
  </section>;
}
