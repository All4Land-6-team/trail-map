import type { HikeSchedule } from "../types/hike";

// 서버에서 받은 일정 목록을 휴대폰(localStorage)에 저장해 둔다. 산에서 통신이 끊긴 채 앱을 다시 열면
// 예시 일정 대신 이 목록을 "마지막으로 받은 일정"으로 보여 준다.
// 다른 계정의 일정이 보이지 않도록 사용자 번호와 함께 저장하고, 로그아웃하면 지운다.

const KEY = "trail-map.hike-schedules";

export type ScheduleCache = { userId: number; savedAt: string; schedules: HikeSchedule[] };

function storage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function saveScheduleCache(userId: number | undefined, schedules: readonly HikeSchedule[], now = new Date()) {
  const store = storage();
  if (!store || userId === undefined) return;
  try {
    const value: ScheduleCache = { userId, savedAt: now.toISOString(), schedules: [...schedules] };
    store.setItem(KEY, JSON.stringify(value));
  } catch { /* 저장 공간이 없으면 오프라인에서는 예시 일정으로 동작한다. */ }
}

/** 지금 로그인한 사용자의 저장본만 돌려준다. */
export function loadScheduleCache(userId: number | undefined): ScheduleCache | null {
  const store = storage();
  if (!store || userId === undefined) return null;
  try {
    const value = JSON.parse(store.getItem(KEY) ?? "null") as ScheduleCache | null;
    if (!value || value.userId !== userId || typeof value.savedAt !== "string" || !Array.isArray(value.schedules)) return null;
    return value;
  } catch {
    return null;
  }
}

export function clearScheduleCache() {
  try { storage()?.removeItem(KEY); } catch { /* 무시 */ }
}
