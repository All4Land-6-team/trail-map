import { useSyncExternalStore } from "react";
import type { HikeRecord } from "../api/hikeRecordApi";
import type { HikeSchedule, LngLat } from "../types/hike";
import { courseProgress, distanceMeters, gateCourseProgress, hasReachedCourse, OFF_COURSE_METERS, type CourseProgress } from "../utils/hikeTracking.ts";

export type HikeSession = {
  schedule: HikeSchedule;
  /**
   * 예시 데이터 모드(일정에 서버 번호가 없을 때)의 예시 산 ID.
   * 일정 API 일정은 schedule.serverMountainId·serverCourseId를 쓰므로 비워 둔다.
   */
  mountainId?: string;
  phase: "active" | "downhill" | "complete";
  alertsOn: boolean;
  /** 백엔드 상태를 바꾸지 않고 이 브라우저의 GPS 수집·전송만 잠시 멈춘다. */
  trackingPaused?: boolean;
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
  /** 기록 시작 시 서버에 저장한 코스 경로 (시작점 → 정상). 예시 데이터 모드에서는 없다. */
  coursePath?: LngLat[];
  courseDistanceMeters?: number;
  /** 현재 위치를 진행 방향 코스 경로에 옮겨 계산한 남은 거리·코스 이탈 거리 */
  courseProgress?: CourseProgress;
  /** 코스 이탈 기준 안으로 한 번이라도 들어왔는지. 들어오기 전에는 진행 거리를 0으로 둔다. */
  reachedCourse?: boolean;
  /** 하산을 시작한 지점의 traveledPath 순번. 하산 중 지도에는 여기부터의 이동 경로만 그린다. */
  descentPathStart?: number;
};

export type CompletedHike = {
  id: string;
  /** 일정 API 일정은 서버 산 번호 문자열, 예시 데이터 모드는 예시 산 ID */
  mountainId?: string;
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
    coursePath: record.coursePath.length ? record.coursePath : undefined,
    courseDistanceMeters: record.courseDistanceMeters ?? undefined,
  };
}

// 서버는 하산 시작 지점을 따로 저장하지 않아 새로고침 후에도 쓰도록 기록별로 브라우저에 둔다.
const descentStartKey = (hikeRecordId: number) => `trail-map.hike-descent-start.${hikeRecordId}`;
function saveDescentStart(hikeRecordId: number | undefined, index: number | undefined) {
  if (hikeRecordId === undefined || typeof window === "undefined") return;
  try {
    if (index === undefined) window.localStorage.removeItem(descentStartKey(hikeRecordId));
    else window.localStorage.setItem(descentStartKey(hikeRecordId), String(index));
  } catch { /* 저장하지 못하면 새로고침 후 정상에 가장 가까운 지점부터 그린다. */ }
}
function loadDescentStart(hikeRecordId: number) {
  try {
    const value = typeof window === "undefined" ? null : window.localStorage.getItem(descentStartKey(hikeRecordId));
    return value === null ? undefined : Number(value);
  } catch {
    return undefined;
  }
}

/** 새로고침 후 하산 중인 기록: 저장해 둔 순번, 없으면 이동 경로에서 정상(코스 끝)에 가장 가까운 지점 */
function restoredDescentStart(next: HikeSession) {
  if (next.phase !== "downhill" || next.hikeRecordId === undefined) return undefined;
  const saved = loadDescentStart(next.hikeRecordId);
  if (saved !== undefined && Number.isInteger(saved) && saved >= 0 && saved < next.traveledPath.length) return saved;
  const peak = next.coursePath?.at(-1);
  if (!peak || !next.traveledPath.length) return undefined;
  let nearest = 0;
  next.traveledPath.forEach((point, index) => {
    if (distanceMeters(point, peak) < distanceMeters(next.traveledPath[nearest], peak)) nearest = index;
  });
  return nearest;
}

/**
 * 다른 화면(커뮤니티 스팟·후기)에 넘길 산·코스 ID. 일정에 서버 번호가 있으면 그 번호,
 * 없으면(예시 데이터 모드) 예시 산 ID와 화면 코스 ID
 */
export function hikeTargetIds({ schedule, mountainId }: Pick<HikeSession, "schedule" | "mountainId">) {
  return {
    mountainId: schedule.serverMountainId === undefined ? mountainId : String(schedule.serverMountainId),
    courseId: schedule.serverCourseId === undefined ? schedule.courseId : String(schedule.serverCourseId),
  };
}

/** 진행 방향의 코스 경로. 하산 중에는 정상에서 시작점 방향이다. */
export function directedCoursePath(coursePath: LngLat[], phase: HikeSession["phase"]) {
  return phase === "downhill" ? [...coursePath].reverse() : coursePath;
}

/** 현재 위치로 남은 거리를 다시 계산한다. previousAlongMeters는 같은 방향에서 직전에 계산한 진행 거리다. */
function withCourseProgress(next: HikeSession, previousAlongMeters?: number): HikeSession {
  const progress = next.coursePath && next.currentPosition
    ? courseProgress(directedCoursePath(next.coursePath, next.phase), next.currentPosition, previousAlongMeters) ?? undefined
    : undefined;
  // 새로고침으로 복원한 기록은 저장된 이동 경로로 코스에 들어온 적이 있는지 다시 판단한다.
  const reachedCourse = next.reachedCourse
    ?? (next.coursePath ? hasReachedCourse(next.coursePath, next.traveledPath) : false);
  const reached = reachedCourse || (progress !== undefined && progress.offCourseMeters <= OFF_COURSE_METERS);
  return { ...next, reachedCourse: reached, courseProgress: progress && gateCourseProgress(progress, reached) };
}

/** mountainId는 예시 데이터 모드에서만 넘긴다. 일정 API 일정은 일정의 서버 번호를 쓴다. */
export function startHikeSession(schedule: HikeSchedule, mountainId: string | undefined, alertsOn: boolean, record?: HikeRecord) {
  if (session && session.phase !== "complete") return;
  const next: HikeSession = { schedule: { ...schedule }, mountainId, alertsOn, phase: "active", startedAt: new Date().toISOString(),
    traveledPath: [], ...(record && fromRecord(record)) };
  update(withCourseProgress({ ...next, descentPathStart: restoredDescentStart(next) }));
}
export function setHikeAlerts(alertsOn: boolean) { if (session && session.alertsOn !== alertsOn) update({ ...session, alertsOn }); }
export function setHikeTrackingPaused(trackingPaused: boolean) {
  if (!session || session.phase === "complete" || session.trackingPaused === trackingPaused) return;
  update({ ...session, trackingPaused });
}
/** 하산을 시작하면 지금 위치(이동 경로의 마지막 점)부터 하산 경로를 새로 그린다. */
export function startHikeDescent() {
  if (session?.phase !== "active") return;
  const descentPathStart = Math.max(0, session.traveledPath.length - 1);
  saveDescentStart(session.hikeRecordId, descentPathStart);
  update(withCourseProgress({ ...session, phase: "downhill", descentPathStart }));
}

/** GPS 위치를 받을 때마다 현재 위치를 옮긴다. addToPath가 false면 경로에는 넣지 않는다(정확도가 낮은 위치 등). */
export function recordHikePosition(position: LngLat, addToPath: boolean) {
  if (!session || session.phase === "complete" || session.trackingPaused) return;
  update(withCourseProgress({ ...session, currentPosition: position,
    traveledPath: addToPath ? [...session.traveledPath, position] : session.traveledPath }, session.courseProgress?.alongMeters));
}
export function setHikeTraveledMeters(hikeRecordId: number, meters: number | null) {
  if (session?.hikeRecordId !== hikeRecordId || meters === null || session.traveledMeters === meters) return;
  update({ ...session, traveledMeters: meters });
}

/** 기록 API로 종료했으면 서버가 계산한 이동 거리·소요 시간을 함께 남긴다. */
export function finishHikeSession(record?: HikeRecord) {
  if (!session || session.phase === "complete") return;
  saveDescentStart(session.hikeRecordId, undefined);
  const finished = record ? { ...session, ...fromRecord(record), traveledPath: record.traveledPath.length ? record.traveledPath : session.traveledPath }
    : { ...session, phase: "complete" as const, finishedAt: new Date().toISOString() };
  const finishedAt = finished.finishedAt ?? new Date().toISOString();
  const distanceKm = finished.traveledMeters === undefined ? session.schedule.distanceKm : finished.traveledMeters / 1000;
  completedHikes = [{ id: record ? String(record.hikeRecordId) : crypto.randomUUID(), ...hikeTargetIds(finished),
    courseName: session.schedule.courseName, distanceKm, finishedAt }, ...completedHikes];
  update({ ...finished, phase: "complete", finishedAt });
}

/** 새로고침 후 서버의 진행 중 기록으로 다시 만든 상태 (hikeSessionRestore). 이미 진행 중인 상태가 있으면 그대로 둔다. */
export function restoreHikeSession(restored: HikeSession) {
  if (session && session.phase !== "complete") return;
  update(withCourseProgress({ ...restored, descentPathStart: restoredDescentStart(restored) }));
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
