import { useCallback, useState } from "react";
import { useSingleFlight } from "./useSingleFlight";

/** denied: 이번 요청에서 거부함, blocked: 브라우저 설정에서 차단되어 다시 물을 수 없음 */
export type LocationPermissionNotice = "denied" | "blocked";

export type LocationCheckResult =
  | { status: "granted"; position: GeolocationPosition }
  | { status: LocationPermissionNotice }
  | { status: "unavailable" };

const POSITION_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 };

async function queryPermissionState(): Promise<PermissionState | null> {
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" });
    return status?.state ?? null;
  } catch {
    return null;
  }
}

function getCurrentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, POSITION_OPTIONS);
  });
}

/** 위치 권한을 요청하고 현재 위치를 한 번 받아 온다. 위치를 받은 경우에만 granted를 돌려준다. */
export async function checkLocation(): Promise<LocationCheckResult> {
  if (!("geolocation" in navigator)) return { status: "unavailable" };
  try {
    return { status: "granted", position: await getCurrentPosition() };
  } catch (error) {
    const code = (error as GeolocationPositionError).code;
    if (code !== 1) return { status: "unavailable" };
    // 권한 상태가 denied로 남았으면 브라우저가 다시 묻지 않으므로 설정 안내가 필요하다.
    return { status: (await queryPermissionState()) === "denied" ? "blocked" : "denied" };
  }
}

/** 등산 시작 전 위치 권한을 확인하고, 거부·차단 시 보여 줄 안내 상태를 관리한다. */
export function useLocationPermission() {
  const [notice, setNotice] = useState<LocationPermissionNotice | null>(null);

  const check = useCallback(async () => {
    const result = await checkLocation();
    setNotice(result.status === "denied" || result.status === "blocked" ? result.status : null);
    return result;
  }, []);

  const { run, pending } = useSingleFlight(check);
  const dismiss = useCallback(() => setNotice(null), []);

  return { notice, checking: pending, check: run, dismiss };
}
