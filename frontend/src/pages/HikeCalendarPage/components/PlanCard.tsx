import { Icon } from "../../../components/common/Icon";
import type { HikeSchedule } from "../../../types/hike";

export type PlanCardProps = {
  schedule: HikeSchedule;
  onOpen: () => void;
};

/** HIKE-01 일정 카드. 탭하면 HIKE-02 일정 상세로 이동한다. */
export function PlanCard({ schedule, onOpen }: PlanCardProps) {
  const title = `${schedule.mountainName} · ${schedule.courseName}`;
  return <button type="button" className="hike-plan-card" onClick={onOpen}
    aria-label={`${schedule.startTime} 출발, ${title}, ${schedule.distanceKm} km, 일정 상세 보기`}>
    <span className="hike-plan-card__copy">
      <time className="hike-plan-card__time">{schedule.startTime}</time>
      <span className="hike-plan-card__title">{title}</span>
      <span className="hike-plan-card__distance">{schedule.distanceKm.toFixed(1)} km</span>
    </span>
    <Icon name="ChevronRight" size={22} color="currentColor" />
  </button>;
}
