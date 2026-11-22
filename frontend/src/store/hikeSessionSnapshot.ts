import type { HikeSpot } from "../types/hike";
import type { HikeSession } from "./hikeSessionStore";

// 진행 중 등산을 휴대폰(localStorage)에 저장해 둔다. 산에서 통신이 끊긴 채 앱을 다시 열면
// 서버의 진행 중 기록을 받을 수 없으므로 이 저장본으로 등산 화면을 이어 간다.
// 기록 API로 진행하는 등산(hikeRecordId 있음)만 저장한다. 예시 데이터 모드는 서버 기록이 없어 저장하지 않는다.

const SESSION_KEY = "trail-map.hike-session";
const spotsKey = (hikeRecordId: number) => `trail-map.hike-spots.${hikeRecordId}`;

/** 저장하는 값: 화면에서 다시 계산하는 진행 정보(courseProgress)는 빼고 저장한다. */
export type HikeSessionSnapshot = Omit<HikeSession, "courseProgress"> & { hikeRecordId: number; savedAt: string };

function storage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function saveHikeSnapshot(session: HikeSession) {
  const store = storage();
  if (!store || session.hikeRecordId === undefined) return;
  try {
    if (session.phase === "complete") {
      store.removeItem(SESSION_KEY);
      return;
    }
    const { courseProgress: _progress, ...rest } = session;
    const snapshot: HikeSessionSnapshot = { ...rest, hikeRecordId: session.hikeRecordId, savedAt: new Date().toISOString() };
    store.setItem(SESSION_KEY, JSON.stringify(snapshot));
  } catch { /* 저장 공간이 없으면 서버 기록으로만 복구한다. */ }
}

export function loadHikeSnapshot(): HikeSessionSnapshot | null {
  const store = storage();
  if (!store) return null;
  try {
    const value = JSON.parse(store.getItem(SESSION_KEY) ?? "null") as HikeSessionSnapshot | null;
    if (!value || typeof value.hikeRecordId !== "number" || !value.schedule || !Array.isArray(value.traveledPath)
      || (value.phase !== "active" && value.phase !== "downhill")) return null;
    return value;
  } catch {
    return null;
  }
}

export function clearHikeSnapshot(hikeRecordId?: number) {
  const store = storage();
  if (!store) return;
  try {
    const saved = loadHikeSnapshot();
    if (hikeRecordId === undefined || saved?.hikeRecordId === hikeRecordId) store.removeItem(SESSION_KEY);
    if (hikeRecordId !== undefined) store.removeItem(spotsKey(hikeRecordId));
  } catch { /* 무시 */ }
}

/** 등산 중 화면의 코스 시설. 통신이 끊긴 채 다시 열어도 시설 표시·접근 알림을 쓰도록 기록별로 저장한다. */
export function saveHikeSpots(hikeRecordId: number, spots: HikeSpot[]) {
  const store = storage();
  if (!store || !spots.length) return;
  try { store.setItem(spotsKey(hikeRecordId), JSON.stringify(spots)); } catch { /* 무시 */ }
}

export function loadHikeSpots(hikeRecordId: number): HikeSpot[] {
  const store = storage();
  if (!store) return [];
  try {
    const value = JSON.parse(store.getItem(spotsKey(hikeRecordId)) ?? "[]") as unknown;
    return Array.isArray(value) ? value as HikeSpot[] : [];
  } catch {
    return [];
  }
}
