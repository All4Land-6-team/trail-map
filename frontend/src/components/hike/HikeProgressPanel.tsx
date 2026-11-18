import { Button } from "../common/Button";
import { SheetHandle } from "./SheetHandle";
import { useDraggableSheet } from "./useDraggableSheet";
import "./HikeProgressPanel.css";

export type HikeProgressPanelProps = {
  stage: "ascent" | "descent";
  traveledKm: number;
  remainingKm: number;
  /** 코스상 진행률(%). 없으면 이동·남은 거리 비율로 그린다(예시 데이터 모드). */
  progressPercent?: number;
  /** 코스에서 떨어져 있을 때 진행 바 아래에 작게 보여 줄 문구 */
  courseNotice?: string;
  busy?: boolean;
  /** 등산 중에만 하산 시작 버튼을 보여 준다 */
  onStartDescent?: () => void;
  onEnd: () => void;
};

/**
 * HIKE-05·07 하단 진행 시트: 진행률 · 이동/남은 거리 · 하산 시작/등산 종료.
 * 손잡이로 접으면 진행률 바만 남는다. 시트 위 요소는 부모의 `--hike-sheet-inset`으로 시트를 따라간다.
 */
export function HikeProgressPanel({ stage, traveledKm, remainingKm, progressPercent, courseNotice, busy = false,
  onStartDescent, onEnd }: HikeProgressPanelProps) {
  const { sheetRef, bodyRef, collapsed, sheetClassName, sheetStyle, handleProps } = useDraggableSheet();
  const total = traveledKm + remainingKm;
  const percent = Math.max(0, Math.min(100, progressPercent ?? (total > 0 ? Math.round((traveledKm / total) * 100) : 0)));
  const descent = stage === "descent";

  return <section ref={sheetRef} style={sheetStyle} aria-label={descent ? "하산 진행 상황" : "등산 진행 상황"}
    className={["hike-progress-panel", sheetClassName].filter(Boolean).join(" ")}>
    <SheetHandle {...handleProps} />
    <p className="hike-progress-panel__percent"><span>진행률</span><strong>{percent}%</strong></p>
    <div className="hike-progress-panel__track" role="progressbar" aria-label={descent ? "하산 진행률" : "등산 진행률"}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <span style={{ width: `${percent}%` }} />
    </div>
    <div ref={bodyRef} className="hike-progress-panel__body" inert={collapsed}>
      <dl className="hike-progress-panel__distances">
        <div><dt>이동 거리</dt><dd>{traveledKm.toFixed(1)} km</dd></div>
        <div><dt>남은 거리</dt><dd>{remainingKm.toFixed(1)} km</dd></div>
      </dl>
      {courseNotice && <p className="hike-progress-panel__notice" role="status">{courseNotice}</p>}
      <div className="hike-progress-panel__actions">
        {onStartDescent && <Button variant="secondary" className="hike-progress-panel__descent" label="하산 시작"
          disabled={busy} onClick={onStartDescent} />}
        <Button variant="secondary" className="hike-progress-panel__end" label="등산 종료" disabled={busy} onClick={onEnd} />
      </div>
    </div>
  </section>;
}
