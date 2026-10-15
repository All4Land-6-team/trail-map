import { useId } from "react";
import { Button } from "../common/Button";
import { Icon } from "../common/Icon";
import { BottomSheet, OverlayLayer } from "../overlay";
import type { LocationPermissionNotice } from "../../hooks/useLocationPermission";
import "./hike.css";

export type LocationPermissionSheetProps = {
  notice: LocationPermissionNotice;
  /** 위치 다시 확인 버튼. 확인 중에는 다시 누를 수 없다. */
  onRetry: () => void;
  retrying?: boolean;
  /** 배경 클릭이나 Esc로 닫고 위치 없이 지도를 계속 본다. */
  onDismiss: () => void;
};

/** HIKE-04 위치 권한 안내 (거부·차단). 위치를 받기 전에는 등산 중 화면으로 넘어가지 않는다. */
export function LocationPermissionSheet({ notice, onRetry, retrying = false, onDismiss }: LocationPermissionSheetProps) {
  const descriptionId = useId();
  return <OverlayLayer placement="bottom" onDismiss={onDismiss}>
    <BottomSheet className="af-location-sheet" role="dialog" aria-modal="true" aria-describedby={descriptionId}
      aria-busy={retrying} title="위치 권한이 필요해요" showClose={false} showDescription={false} showFooter
      titleIcon={<span className="af-location-sheet__icon"><Icon name="Pin" size={24} color="#B06428" /></span>}
      content={<>
        <p id={descriptionId} className="af-location-sheet__description">
          등산 진행을 위해 위치 권한이 필요해요.<br />위치 권한을 허용한 뒤 다시 시도해 주세요.
        </p>
        {notice === "blocked" && <div className="af-location-sheet__notice" role="note">
          <strong className="af-location-sheet__notice-title">위치 권한이 차단되어 있어요</strong>
          <p className="af-location-sheet__notice-body">브라우저 또는 사이트 설정에서 위치 권한을 허용한 뒤 다시 확인해 주세요.</p>
        </div>}
      </>}
      footer={<Button fullWidth label={retrying ? "위치 확인 중" : "위치 다시 확인"} disabled={retrying} onClick={onRetry} />} />
  </OverlayLayer>;
}
