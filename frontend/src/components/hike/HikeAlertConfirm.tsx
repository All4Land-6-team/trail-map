import { ConfirmOverlay } from "./ConfirmOverlay";

export type HikeAlertConfirmProps = {
  /** 받기 → 알림 토글 기본 ON으로 HIKE-05 등산 중 이동 */
  onAccept: () => void | Promise<void>;
  /** 나중에 → 알림 토글 기본 OFF로 HIKE-05 등산 중 이동 */
  onDecline: () => void;
  /** 배경 클릭, Esc → 등산을 시작하지 않고 창만 닫는다 */
  onDismiss: () => void;
};

/** HIKE-04 알림 수신 확인. 등산 시작 직전에 묻고, 선택 값은 등산 중 알림 토글의 기본값이 된다. */
export function HikeAlertConfirm({ onAccept, onDecline, onDismiss }: HikeAlertConfirmProps) {
  return <ConfirmOverlay title="알림을 받으시겠어요?" body="등산 중 쉼터·경고 등 주요 알림을 보내드려요."
    cancelLabel="나중에" confirmLabel="받기" onConfirm={onAccept} onCancel={onDecline} onDismiss={onDismiss} />;
}
