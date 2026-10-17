import { Button } from "../../../components/common/Button";
import { Icon } from "../../../components/common/Icon";

export type HikeStage = "ascent" | "descent";

export type HikeProgressSheetProps = {
  stage: HikeStage;
  courseName: string;
  traveledKm: number;
  remainingKm: number;
  sunset: string;
  /** 등산 중에만 알림 토글을 보여 준다 */
  alertsOn?: boolean;
  onAlertsChange?: (on: boolean) => void;
  onStartDescent?: () => void;
  onEnd: () => void;
};

/** HIKE-05·07 하단 시트: 진행 상태 · 이동/남은 거리 · 일몰 · 알림 · 하산/종료 버튼 */
export function HikeProgressSheet({
  stage, courseName, traveledKm, remainingKm, sunset,
  alertsOn = false, onAlertsChange, onStartDescent, onEnd,
}: HikeProgressSheetProps) {
  const descent = stage === "descent";
  const total = traveledKm + remainingKm;
  const percent = total > 0 ? Math.round((traveledKm / total) * 100) : 0;

  return <section className={["hike-progress-sheet", descent && "hike-progress-sheet--descent"].filter(Boolean).join(" ")}
    aria-label="등산 진행 상황">
    <span className="hike-progress-sheet__handle" aria-hidden="true" />
    <div className="hike-progress-sheet__head">
      <h2 className="hike-progress-sheet__stage">{descent ? "내려가는 중" : "올라가는 중"}</h2>
      {!descent && <span className="hike-progress-sheet__course">{courseName}</span>}
    </div>
    <div className="hike-progress-sheet__distances">
      {!descent && <span>이동 {traveledKm.toFixed(1)} km</span>}
      <span>남은 {remainingKm.toFixed(1)} km</span>
    </div>
    <div className="hike-progress-sheet__track" role="progressbar" aria-label={descent ? "하산 진행률" : "등산 진행률"}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <span style={{ width: `${percent}%` }} />
    </div>
    <div className="hike-progress-sheet__sunset">
      <Icon name="Sun" size={24} />
      <span>일몰 {sunset}</span>
      {onAlertsChange && <button type="button" className="hike-progress-sheet__bell" aria-pressed={alertsOn}
        aria-label={alertsOn ? "근접 알림 켜짐" : "근접 알림 꺼짐"} onClick={() => onAlertsChange(!alertsOn)}>
        <Icon name={alertsOn ? "Bell" : "BellOff"} size={24} />
      </button>}
    </div>
    <div className="hike-progress-sheet__actions">
      {onStartDescent && <Button variant="secondary" className="hike-progress-sheet__descent"
        label="하산 시작" onClick={onStartDescent} />}
      <Button variant="secondary" className="hike-progress-sheet__end" label="등산 종료" onClick={onEnd} />
    </div>
  </section>;
}
