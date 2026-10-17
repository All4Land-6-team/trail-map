import { Icon } from "../../../components/common/Icon";
import { Typography } from "../../../components/common/Typography";
import type { TodayHikeSchedule } from "../../../types/home";

export function TodayHikeNotice({ schedule, onOpen }: { schedule: TodayHikeSchedule; onOpen: () => void }) {
  return <button type="button" className="home-today-notice" onClick={onOpen}>
    <span className="home-today-notice__icon" aria-hidden="true">!</span>
    <span className="home-today-notice__copy">
      <Typography variant="controlLabel">
        {schedule.phase === "active" ? "진행 중인 등산이 있어요" : "오늘 등산 일정이 있어요"}
      </Typography>
      <Typography variant="descriptionSmall" className="home-today-notice__detail">
        {schedule.mountainName} · {schedule.courseName} · {schedule.startTime} 출발
      </Typography>
    </span>
    <Icon name="ChevronRight" size={18} />
  </button>;
}
