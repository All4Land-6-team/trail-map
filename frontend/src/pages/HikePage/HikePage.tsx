import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/common/Button";
import { Icon } from "../../components/common/Icon";
import { Typography } from "../../components/common/Typography";
import type { BottomDestination } from "../../components/layout";
import { BottomSheet, ConfirmDialog, ModalLayer } from "../../components/overlay";
import type { MapRoute } from "../../components/map";
import type { PlannedHike } from "../../types/hiking";
import { resolveLocationGuideState, type LocationGuideState } from "../../utils/hikingStatus";
import { HikeMapScene } from "./components/HikeMapScene";
import { LocationPermissionSheet } from "./components/LocationPermissionSheet";
import "./hike.css";

type HikePageProps = {
  route: string;
  plannedHikes: readonly PlannedHike[];
  onNavigate: (destination: BottomDestination) => void;
  onBack: () => void;
  onFinish: () => void;
};

const courseRoute: MapRoute = {
  id: "active-hike",
  color: "#19765b",
  coordinates: [
    [126.955, 37.636],
    [126.963, 37.644],
    [126.972, 37.651],
    [126.982, 37.66],
    [126.989, 37.67],
    [126.993, 37.681],
  ],
  showEndpoint: true,
};

async function readPermissionState() {
  if (!navigator.permissions?.query) return undefined;
  try {
    return (await navigator.permissions.query({ name: "geolocation" })).state;
  } catch {
    return undefined;
  }
}

export function HikePage({ route, plannedHikes, onNavigate, onBack, onFinish }: HikePageProps) {
  const params = new URLSearchParams(route.split("?")[1] ?? "");
  const directGuide = params.get("state");
  const isActive = route.startsWith("#hike/active");
  const [endDialogOpen, setEndDialogOpen] = useState(params.get("end") === "1");
  const [locationGuide, setLocationGuide] = useState<LocationGuideState | null>(
    route.startsWith("#hike/permission")
      ? directGuide === "blocked" ? "blocked" : directGuide === "unavailable" ? "unavailable" : "denied"
      : null,
  );
  const [checkingLocation, setCheckingLocation] = useState(false);
  const locationRequestId = useRef(0);
  const mounted = useRef(true);
  const plannedHike = plannedHikes.at(-1);
  const courseName = plannedHike?.courseName ?? "백운대 코스";
  const startTime = plannedHike?.time ?? "07:30";

  useEffect(() => () => {
    mounted.current = false;
    locationRequestId.current += 1;
  }, []);

  async function requestLocation() {
    if (checkingLocation) return;
    const requestId = locationRequestId.current + 1;
    locationRequestId.current = requestId;
    setCheckingLocation(true);
    const permissionState = await readPermissionState();
    if (!mounted.current || requestId !== locationRequestId.current) return;
    if (permissionState === "denied") {
      setLocationGuide("blocked");
      setCheckingLocation(false);
      return;
    }
    if (!navigator.geolocation) {
      setLocationGuide("unavailable");
      setCheckingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        if (!mounted.current || requestId !== locationRequestId.current) return;
        setCheckingLocation(false);
        window.location.hash = "hike/active";
      },
      async (error) => {
        if (!mounted.current || requestId !== locationRequestId.current) return;
        setLocationGuide(resolveLocationGuideState(error.code));
        setCheckingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }

  if (isActive) {
    return (
      <HikeMapScene
        title="등산 중"
        route={courseRoute}
        onBack={onBack}
        onNavigate={onNavigate}
      >
        <BottomSheet
          title="올라가는 중"
          description={courseName}
          showClose={false}
          className="hike-progress-sheet"
          content={(
            <div className="hike-progress-content">
              <div className="hike-progress-meta">
                <Typography variant="controlLabel">이동 2.0 km</Typography>
                <Typography variant="descriptionSmall">남은 2.2 km</Typography>
              </div>
              <div
                className="hike-progress-track"
                role="progressbar"
                aria-label="등산 진행률"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={48}
              >
                <span />
              </div>
              <div className="hike-sunset-row">
                <Icon name="Sun" size={22} color="currentColor" />
                <Typography variant="controlLabel">일몰 18:30</Typography>
              </div>
              <div className="hike-progress-actions">
                <Button variant="secondary" fullWidth>하산 시작</Button>
                <Button variant="secondary" fullWidth className="hike-finish-button" onClick={() => setEndDialogOpen(true)}>
                  등산 종료
                </Button>
              </div>
            </div>
          )}
        />
        {endDialogOpen && (
          <ModalLayer className="hike-confirm-layer" onDismiss={() => setEndDialogOpen(false)}>
            <ConfirmDialog
              className="hike-end-dialog"
              title="등산을 종료할까요?"
              body="종료하면 등산 완료 화면으로 이동해요."
              cancelLabel="취소"
              confirmLabel="종료"
              onCancel={() => setEndDialogOpen(false)}
              onConfirm={onFinish}
            />
          </ModalLayer>
        )}
      </HikeMapScene>
    );
  }

  return (
    <HikeMapScene title="오늘의 등산" route={courseRoute} onBack={onBack} onNavigate={onNavigate}>
      {!locationGuide && (
        <BottomSheet
          title={`${plannedHike?.mountain ?? "북한산"} · ${courseName}`}
          description={`오늘 ${startTime} 출발`}
          showClose={false}
          className="hike-today-sheet"
          content={(
            <div className="hike-today-content">
              <Typography variant="bodySmall">4.2 km</Typography>
              <div className="hike-today-divider" />
              <div className="hike-sunset-row">
                <Icon name="Sun" size={22} color="currentColor" />
                <Typography variant="controlLabel">일몰 18:30</Typography>
              </div>
              <Button fullWidth showTrailingIcon onClick={requestLocation} disabled={checkingLocation}>
                {checkingLocation ? "위치 확인 중" : "등산 시작하기"}
              </Button>
            </div>
          )}
        />
      )}
      {locationGuide && (
        <LocationPermissionSheet
          state={locationGuide}
          checking={checkingLocation}
          onRetry={requestLocation}
        />
      )}
    </HikeMapScene>
  );
}
