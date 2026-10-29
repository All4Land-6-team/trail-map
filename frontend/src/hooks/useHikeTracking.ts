import { useEffect, useState } from "react";
import { HIKE_RECORD_ERROR, HikeRecordApiError, MAX_POSITIONS_PER_REQUEST, sendHikePositions, type HikePosition } from "../api/hikeRecordApi";
import { getHikeSession, recordHikePosition, setHikeTraveledMeters } from "../store/hikeSessionStore";
import type { LngLat } from "../types/hike";
import { isPathPosition } from "../utils/hikeTracking";

/** 모은 위치를 이 간격마다 보낸다. */
const FLUSH_INTERVAL_MS = 15_000;
/** 간격을 기다리지 않고 바로 보낼 위치 수 */
const FLUSH_AT_COUNT = 20;
const WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 };

export type HikeTrackingIssue = "denied" | "unavailable";

// 아직 보내지 못한 위치. 전송 실패·오프라인·새로고침에도 남도록 기록별로 localStorage에 같이 둔다.
let queue: { hikeRecordId: number; positions: HikePosition[] } | null = null;
let sending: Promise<void> | null = null;

function storageKey(hikeRecordId: number) {
  return `trail-map.hike-positions.${hikeRecordId}`;
}

function queueFor(hikeRecordId: number) {
  if (queue?.hikeRecordId === hikeRecordId) return queue;
  let positions: HikePosition[] = [];
  try {
    const raw = window.localStorage.getItem(storageKey(hikeRecordId));
    if (raw) positions = JSON.parse(raw) as HikePosition[];
  } catch { /* 저장소를 못 쓰면 메모리에만 둔다. */ }
  queue = { hikeRecordId, positions: Array.isArray(positions) ? positions : [] };
  return queue;
}

function saveQueue(target: { hikeRecordId: number; positions: HikePosition[] }) {
  try {
    if (target.positions.length) window.localStorage.setItem(storageKey(target.hikeRecordId), JSON.stringify(target.positions));
    else window.localStorage.removeItem(storageKey(target.hikeRecordId));
  } catch { /* 메모리 큐는 그대로 남는다. */ }
}

/** 다시 보내도 받아 주지 않는 요청(종료된 기록, 없는 기록, 잘못된 위치)이면 버린다. */
function isRejected(error: unknown) {
  return error instanceof HikeRecordApiError
    && (error.code === HIKE_RECORD_ERROR.recordAlreadyCompleted || error.status === 400 || error.status === 404);
}

/** 모아 둔 위치를 모두 보낸다. 실패하면 남은 위치를 그대로 두고 오류를 던진다. */
export function flushHikePositions(hikeRecordId: number): Promise<void> {
  if (sending) return sending.catch(() => undefined).then(() => flushHikePositions(hikeRecordId));
  sending = (async () => {
    const target = queueFor(hikeRecordId);
    while (target.positions.length) {
      const batch = target.positions.slice(0, MAX_POSITIONS_PER_REQUEST);
      try {
        const result = await sendHikePositions(hikeRecordId, batch);
        setHikeTraveledMeters(hikeRecordId, result.traveledDistanceMeters);
      } catch (error) {
        if (!isRejected(error)) throw error;
      }
      target.positions = target.positions.slice(batch.length);
      saveQueue(target);
    }
  })().finally(() => { sending = null; });
  return sending;
}

/**
 * 등산 중·하산 중 화면에서 GPS 위치를 계속 받아 지도에 표시하고, 묶어서 등산 기록 API로 보낸다.
 * 기록 번호가 없으면(예시 데이터 모드) 위치를 받지 않는다. 위치를 못 받는 동안의 상태를 돌려준다.
 */
export function useHikeTracking(hikeRecordId?: number) {
  const [issue, setIssue] = useState<HikeTrackingIssue | null>(null);

  useEffect(() => {
    if (hikeRecordId === undefined) return;
    const flushQuietly = () => { void flushHikePositions(hikeRecordId).catch(() => { /* 다음 간격에 다시 보낸다. */ }); };
    // 지난번에 보내지 못한 위치부터 보낸다.
    flushQuietly();
    const timer = window.setInterval(flushQuietly, FLUSH_INTERVAL_MS);
    window.addEventListener("online", flushQuietly);

    let watchId: number | undefined;
    if ("geolocation" in navigator) {
      let previous: LngLat | undefined = getHikeSession()?.traveledPath.at(-1);
      watchId = navigator.geolocation.watchPosition(({ coords, timestamp }) => {
        setIssue(null);
        const point: LngLat = [coords.longitude, coords.latitude];
        const keep = isPathPosition(previous, point, coords.accuracy);
        recordHikePosition(point, keep);
        if (!keep) return;
        previous = point;
        const target = queueFor(hikeRecordId);
        target.positions.push({ longitude: point[0], latitude: point[1],
          recordedAt: new Date(timestamp).toISOString(), accuracyMeters: coords.accuracy });
        saveQueue(target);
        if (target.positions.length >= FLUSH_AT_COUNT) flushQuietly();
      }, error => setIssue(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"), WATCH_OPTIONS);
    } else {
      queueMicrotask(() => setIssue("unavailable"));
    }

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      window.clearInterval(timer);
      window.removeEventListener("online", flushQuietly);
      flushQuietly();
    };
  }, [hikeRecordId]);

  return issue;
}
