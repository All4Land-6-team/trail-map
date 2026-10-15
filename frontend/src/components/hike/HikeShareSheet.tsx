import { Icon } from "../common/Icon";
import { BottomSheet, OverlayLayer } from "../overlay";
import "./hike.css";

export type HikeShareSheetProps = {
  /** 스팟 공유 → 시트를 닫고 COMM-07 새 스팟 등록으로 이동 */
  onShareSpot: () => void;
  /** × 버튼, 배경 클릭, Esc */
  onClose: () => void;
};

/** HIKE-06 등산 중 공유 선택 오버레이. 현재 선택지는 스팟 공유 하나다. */
export function HikeShareSheet({ onShareSpot, onClose }: HikeShareSheetProps) {
  return <OverlayLayer placement="bottom" onDismiss={onClose}>
    <BottomSheet className="af-share-sheet" role="dialog" aria-modal="true" title="공유하기"
      description="등산 중 발견한 지점을 남겨요." onClose={onClose}
      content={<button type="button" className="af-share-sheet__option" onClick={onShareSpot}>
        <span className="af-share-sheet__option-icon" aria-hidden="true"><span /></span>
        <span className="af-share-sheet__option-copy">
          <strong>스팟 공유</strong>
          <span>위치와 사진을 추가해요</span>
        </span>
        <Icon name="ChevronRight" size={20} color="#83978a" />
      </button>} />
  </OverlayLayer>;
}
