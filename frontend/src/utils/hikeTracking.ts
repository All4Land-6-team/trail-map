import type { LngLat } from "../types/hike";

// 서버(HikeRecordService)와 같은 기준으로 지도에 그릴 위치를 거른다. 저장 여부는 서버가 다시 판단한다.

/** 수평 정확도가 이보다 나쁜 위치는 경로에서 뺀다. */
export const MAX_ACCURACY_METERS = 50;
/** 직전 위치와 이보다 가까우면 제자리 GPS 흔들림으로 보고 뺀다. */
export const MIN_STEP_METERS = 5;
const EARTH_RADIUS_METERS = 6_371_008.8;

/** 하버사인 거리(m) */
export function distanceMeters([fromLng, fromLat]: LngLat, [toLng, toLat]: LngLat) {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = toRadians(toLat - fromLat);
  const lngDelta = toRadians(toLng - fromLng);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(lngDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

/** 이동 경로에 넣을 위치인지 판단한다. */
export function isPathPosition(previous: LngLat | undefined, next: LngLat, accuracyMeters?: number) {
  if (accuracyMeters !== undefined && accuracyMeters > MAX_ACCURACY_METERS) return false;
  return previous === undefined || distanceMeters(previous, next) >= MIN_STEP_METERS;
}

