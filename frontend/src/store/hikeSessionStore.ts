import { useSyncExternalStore } from "react";
import type { HikeRecord } from "../api/hikeRecordApi";
import type { HikeSchedule, LngLat } from "../types/hike";

export type HikeSession = {
  schedule: HikeSchedule;
  mountainId: string;
  phase: "active" | "downhill" | "complete";
  alertsOn: boolean;
  startedAt: string;
  finishedAt?: string;
  /** 등산 기록 API로 저장 중인 기록 번호. 예시 데이터 모드에서는 없고 GPS도 수집하지 않는다. */
  hikeRecordId?: number;
  /** 지도에 그릴 실제 이동 경로 (서버에 저장된 경로 + 이번 화면에서 받은 위치) */
  traveledPath: LngLat[];
  currentPosition?: LngLat;
  /** 서버가 계산한 이동 거리. 기록이 없거나 아직 위치를 반영하지 않았으면 없다. */
  traveledMeters?: number;
  /** 서버가 종료 시 계산한 소요 시간 */
  durationSeconds?: number;
};

export type CompletedHike = {
  id: string;
  mountainId: string;
  courseId: string;
  courseName: string;
  distanceKm: number;
  finishedAt: string;
};

// 화면 전환 동안 등산 상태를 유지한다. 기록 API를 쓰면 새로고침 후 서버의 진행 중 기록으로 다시 만든다.
let session: HikeSession | null = null;
let completedHikes: CompletedHike[] = [];
const listeners = new Set<() => void>();
function notify() { listeners.forEach(listener => listener()); }
export function getHikeSession() { return session; }
export function getCompletedHikes() { return completedHikes; }
function update(next: HikeSession) {
  session = next;
  notify();
}

const PHASE_BY_STATUS = { IN_PROGRESS: "active", DESCENDING: "downhill", COMPLETED: "complete" } as const;

export function fromRecord(record: HikeRecord) {
  return {
    hikeRecordId: record.hikeRecordId,
    phase: PHASE_BY_STATUS[record.status],
    startedAt: record.startedAt,
    finishedAt: record.endedAt ?? undefined,
    traveledPath: record.traveledPath,
    currentPosition: record.traveledPath.at(-1),
    traveledMeters: record.traveledDistanceMeters ?? undefined,
    durationSeconds: record.actualDurationSeconds ?? undefined,
  };
}

export function startHikeSession(schedule: HikeSchedule, mountainId: string, alertsOn: boolean, record?: HikeRecord) {
  if (session && session.phase !== "complete") return;
  update({ schedule: { ...schedule }, mountainId, alertsOn, phase: "active", startedAt: new Date().toISOString(),
    traveledPath: [], ...(record && fromRecord(record)) });
}
export function setHikeAlerts(alertsOn: boolean) { if (session && session.alertsOn !== alertsOn) update({ ...session, alertsOn }); }
export function startHikeDescent() { if (session?.phase === "active") update({ ...session, phase: "downhill" }); }

/** GPS 위치를 받을 때마다 현재 위치를 옮긴다. addToPath가 false면 경로에는 넣지 않는다(정확도가 낮은 위치 등). */
export function recordHikePosition(position: LngLat, addToPath: boolean) {
  if (!session || session.phase === "complete") return;
  update({ ...session, currentPosition: position,
    traveledPath: addToPath ? [...session.traveledPath, position] : session.traveledPath });
}
export function setHikeTraveledMeters(hikeRecordId: number, meters: number | null) {
  if (session?.hikeRecordId !== hikeRecordId || meters === null || session.traveledMeters === meters) return;
  update({ ...session, traveledMeters: meters });
}

/** 기록 API로 종료했으면 서버가 계산한 이동 거리·소요 시간을 함께 남긴다. */
export function finishHikeSession(record?: HikeRecord) {
  if (!session || session.phase === "complete") return;
  const finished = record ? { ...session, ...fromRecord(record), traveledPath: record.traveledPath.length ? record.traveledPath : session.traveledPath }
    : { ...session, phase: "complete" as const, finishedAt: new Date().toISOString() };
  const finishedAt = finished.finishedAt ?? new Date().toISOString();
  const distanceKm = finished.traveledMeters === undefined ? session.schedule.distanceKm : finished.traveledMeters / 1000;
  completedHikes = [{ id: record ? String(record.hikeRecordId) : crypto.randomUUID(), mountainId: session.mountainId,
    courseId: session.schedule.courseId, courseName: session.schedule.courseName, distanceKm, finishedAt }, ...completedHikes];
  update({ ...finished, phase: "complete", finishedAt });
}

/** 새로고침 후 서버의 진행 중 기록으로 다시 만든 상태 (hikeSessionRestore). 이미 진행 중인 상태가 있으면 그대로 둔다. */
export function restoreHikeSession(restored: HikeSession) {
  if (session && session.phase !== "complete") return;
  update(restored);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function useHikeSession() {
  return useSyncExternalStore(subscribe, getHikeSession);
}
export function useCompletedHikes() {
  return useSyncExternalStore(subscribe, getCompletedHikes);
}
