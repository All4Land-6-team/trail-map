import { ConfirmOverlay } from "./ConfirmOverlay";

export type HikeEndConfirmProps = {
  /** 종료 확정 → 기록 저장 후 HIKE-08 등산 완료로 이동 */
  onConfirm: () => void | Promise<void>;
  /** 취소 → 창만 닫고 HIKE-05 등산 중 유지 */
  onCancel: () => void;
};

/** HIKE-05 종료 확인 창. 실수로 등산을 끝내지 않도록 한 번 더 묻는다. */
export function HikeEndConfirm({ onConfirm, onCancel }: HikeEndConfirmProps) {
  return <ConfirmOverlay title="등산을 종료할까요?" body="종료하면 등산 완료 화면으로 이동해요."
    cancelLabel="취소" confirmLabel="종료" onConfirm={onConfirm} onCancel={onCancel} />;
}
