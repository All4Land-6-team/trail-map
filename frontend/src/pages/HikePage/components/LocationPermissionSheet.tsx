import { Button } from "../../../components/common/Button";
import { Icon } from "../../../components/common/Icon";
import { BottomSheet, ModalLayer } from "../../../components/overlay";
import type { LocationGuideState } from "../../../utils/hikingStatus";

type LocationPermissionSheetProps = {
  state: LocationGuideState;
  checking?: boolean;
  onRetry: () => void;
};

const copy: Record<LocationGuideState, { title: string; lines: readonly string[] }> = {
  denied: {
    title: "위치 권한이 필요해요",
    lines: [
      "등산 진행을 위해 위치 권한이 필요해요.",
      "위치 권한을 허용한 뒤 다시 시도해 주세요.",
    ],
  },
  blocked: {
    title: "위치 권한이 필요해요",
    lines: [
      "등산 진행을 위해 위치 권한이 필요해요.",
      "위치 권한을 허용한 뒤 다시 시도해 주세요.",
    ],
  },
  unavailable: {
    title: "위치를 확인할 수 없어요",
    lines: [
      "현재 위치를 불러오지 못했어요.",
      "잠시 후 다시 시도해 주세요.",
    ],
  },
};

export function LocationPermissionSheet({ state, checking = false, onRetry }: LocationPermissionSheetProps) {
  const message = copy[state];

  return (
    <ModalLayer className="hike-permission-layer">
      <BottomSheet
        role="dialog"
        aria-modal="true"
        title={message.title}
        titleLeading={(
          <span className="hike-permission-icon" aria-hidden="true">
            <Icon name="Pin" size={24} color="currentColor" />
          </span>
        )}
        showClose={false}
        showDescription={false}
        className={["hike-permission-sheet", `hike-permission-sheet--${state}`].join(" ")}
        content={(
          <div className="hike-permission-content">
            <p>{message.lines[0]}<br />{message.lines[1]}</p>
            {state === "blocked" && (
              <div className="hike-permission-warning" role="status">
                <strong>위치 권한이 차단되어 있어요</strong>
                <span>브라우저 또는 사이트 설정에서 위치 권한을 허용한 뒤 다시 확인해 주세요.</span>
              </div>
            )}
            <Button fullWidth disabled={checking} onClick={onRetry}>
              {checking ? "위치 확인 중" : "위치 다시 확인"}
            </Button>
          </div>
        )}
      />
    </ModalLayer>
  );
}
