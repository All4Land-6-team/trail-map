import { Icon } from "../../../components/common/Icon";
import type { HikeSchedule } from "../../../types/hike";

export type PlanCardProps = {
  schedule: HikeSchedule;
  /** 없으면(날짜가 지났는데 등산하지 않은 일정) 일정 상세로 들어가지 않는 카드로 보여 준다. */
  onOpen?: () => void;
};

/** HIKE-01 일정 카드. 탭하면 HIKE-02 일정 상세로 이동한다. 지난 일정은 누를 수 없다. */
export function PlanCard({ schedule, onOpen }: PlanCardProps) {
  const title = `${schedule.mountainName} · ${schedule.courseName}`;
  const copy = <span className="hike-plan-card__copy">
    <time className="hike-plan-card__time">{schedule.startTime}</time>
    <span className="hike-plan-card__title">{title}</span>
    <span className="hike-plan-card__distance">{schedule.distanceKm.toFixed(1)} km</span>
  </span>;
  if (!onOpen) return <div className="hike-plan-card hike-plan-card--past"
    aria-label={`${schedule.startTime} 출발, ${title}, ${schedule.distanceKm} km, 지난 일정`}>
    {copy}
    <span className="hike-plan-card__past">지난 일정</span>
  </div>;
  return <button type="button" className="hike-plan-card" onClick={onOpen}
    aria-label={`${schedule.startTime} 출발, ${title}, ${schedule.distanceKm} km, 일정 상세 보기`}>
    {copy}
    <Icon name="ChevronRight" size={22} color="currentColor" />
  </button>;
}
