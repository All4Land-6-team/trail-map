import type { ScheduleRecordView } from "../../../store/scheduleRecord";
import type { HikeSchedule } from "../../../types/hike";
import { formatDuration } from "../../../utils/hikeFormat";

export type RecordCardProps = {
  schedule: HikeSchedule;
  record: ScheduleRecordView;
};

const km = (value: number | undefined) => value === undefined ? "—" : `${value.toFixed(1)} km`;

/** REC-01 완료한 등산 카드: 코스 · 이동 거리 · 소요 시간. 이동은 카드 아래 '등산 기록 보기' 버튼으로만 한다. */
export function CompletedRecordCard({ schedule, record }: RecordCardProps) {
  return <section className="hike-record-card" aria-label="완료한 등산">
    <p className="hike-record-card__eyebrow">완료한 등산</p>
    <h3 className="hike-record-card__title">{schedule.mountainName} · {schedule.courseName}</h3>
    <dl className="hike-record-card__stats">
      <div><dt>이동 거리</dt><dd>{km(record.traveledKm)}</dd></div>
      <div><dt>소요 시간</dt><dd>{record.durationMinutes === undefined ? "—" : formatDuration(record.durationMinutes)}</dd></div>
    </dl>
  </section>;
}

/** REC-02 진행중 등산 카드: 진행률 · 이동/남은 거리. 이동은 카드 아래 '등산중 화면 보기' 버튼으로만 한다. */
export function InProgressRecordCard({ schedule, record }: RecordCardProps) {
  const label = record.status === "DESCENDING" ? "하산 진행률" : "등산 진행률";
  const percent = record.progressPercent ?? 0;
  return <section className="hike-record-card" aria-label="진행중 등산">
    <p className="hike-record-card__eyebrow">진행중 등산</p>
    <h3 className="hike-record-card__title">{schedule.mountainName} · {schedule.courseName}</h3>
    <div className="hike-record-card__progress">
      <p className="hike-record-card__progress-label">{label}<strong>{percent}%</strong></p>
      <div className="hike-record-card__track" role="progressbar" aria-label={label}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
    </div>
    <dl className="hike-record-card__distances">
      <div><dt>이동 거리</dt><dd>{km(record.traveledKm)}</dd></div>
      <div><dt>남은 거리</dt><dd>{km(record.remainingKm)}</dd></div>
    </dl>
  </section>;
}
