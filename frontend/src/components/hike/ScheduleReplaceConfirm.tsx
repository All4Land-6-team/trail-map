import { ConfirmOverlay } from "./ConfirmOverlay";

export type ScheduleReplaceConfirmProps = {
  /** 이미 일정이 있는 날짜 (예: 2026-10-03) */
  date: string;
  /** 기존 일정의 산 · 코스 이름 (예: 북한산 · 백운대 코스) */
  existingCourseName: string;
  /** 확인 → 기존 일정을 새 일정으로 바꿔 저장하고 HIKE-01 내 등산 캘린더로 이동 */
  onConfirm: () => void | Promise<void>;
  /** 취소 → 저장하지 않고 일정 등록 시트 유지 */
  onCancel: () => void;
};

/** 같은 날짜 일정 대체 확인 창. 일정은 날짜당 하나만 저장한다. */
export function ScheduleReplaceConfirm({ date, existingCourseName, onConfirm, onCancel }: ScheduleReplaceConfirmProps) {
  return <ConfirmOverlay title={`${date}에는 이미 '${existingCourseName}' 일정이 있어요.`} body="새 일정으로 바꿀까요?"
    cancelLabel="취소" confirmLabel="확인" onConfirm={onConfirm} onCancel={onCancel} />;
}
