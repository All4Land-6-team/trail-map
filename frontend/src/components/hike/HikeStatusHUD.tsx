import { Icon } from "../common/Icon";
import "./HikeFloatingUI.css";

export type HikeStatusHUDProps = {
  stage: "ascent" | "descent";
  courseName: string;
  paused?: boolean;
  courseNotice?: string;
  alertsOn?: boolean;
  onAlertsChange?: (enabled: boolean) => void;
  onRequestEnd?: () => void;
};

export function HikeStatusHUD({ stage, courseName, paused = false,
  courseNotice, alertsOn, onAlertsChange, onRequestEnd }: HikeStatusHUDProps) {
  const descent = stage === "descent";
  return <section className={["af-hike-status", descent && "af-hike-status--descent", paused && "af-hike-status--paused"].filter(Boolean).join(" ")}
    aria-label="등산 진행 상황">
    <div className="af-hike-status__head">
      <div><strong>{paused ? "일시정지 중" : descent ? "내려가는 중" : "올라가는 중"}</strong>
        <span title={courseName}>{courseName}</span></div>
      <div className="af-hike-status__quick-actions">
        {onAlertsChange && <button type="button" aria-label={alertsOn ? "일몰 알림 끄기" : "일몰 알림 켜기"}
          aria-pressed={alertsOn} onClick={() => onAlertsChange(!alertsOn)}>
          <Icon name={alertsOn ? "Bell" : "BellOff"} size={20} />
        </button>}
        {onRequestEnd && <button type="button" className="af-hike-status__end" onClick={onRequestEnd}>종료</button>}
      </div>
    </div>
    {courseNotice && <p role="status">{courseNotice}</p>}
  </section>;
}
