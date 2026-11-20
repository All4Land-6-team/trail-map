import type { HikeSchedule, HikeScheduleRecord } from "../types/hike";
import { useHikeSession, type HikeSession } from "./hikeSessionStore";

/** 캘린더 카드·기록 상세에 보여 줄 기록 상태 (일정 응답의 기록 + 이 기기에서 진행 중인 등산) */
export type ScheduleRecordView = HikeScheduleRecord & {
  /** 진행 중일 때만: 코스상 진행률(%)과 남은 거리 */
  progressPercent?: number;
  remainingKm?: number;
};

const STATUS_BY_PHASE = { active: "IN_PROGRESS", downhill: "DESCENDING", complete: "COMPLETED" } as const;

function sameSchedule(session: HikeSession, schedule: HikeSchedule) {
  if (session.schedule.scheduleId !== undefined || schedule.scheduleId !== undefined) {
    return session.schedule.scheduleId === schedule.scheduleId;
  }
  return session.schedule.date === schedule.date;
}

function minutesBetween(from?: string, to?: string) {
  if (!from || !to) return undefined;
  const minutes = Math.round((Date.parse(to) - Date.parse(from)) / 60_000);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : undefined;
}

/** 이 기기에서 진행한 등산이 있으면 그 상태를, 없으면 일정 응답의 기록 요약을 돌려준다. */
export function scheduleRecordView(schedule: HikeSchedule, session: HikeSession | null): ScheduleRecordView | undefined {
  if (!session || !sameSchedule(session, schedule)) return schedule.record;
  const status = STATUS_BY_PHASE[session.phase];
  const traveledKm = session.traveledMeters === undefined ? schedule.record?.traveledKm : session.traveledMeters / 1000;
  const base: ScheduleRecordView = {
    ...schedule.record,
    hikeRecordId: session.hikeRecordId ?? schedule.record?.hikeRecordId,
    status, startedAt: session.startedAt, endedAt: session.finishedAt, traveledKm,
  };
  if (status === "COMPLETED") {
    return { ...base, durationMinutes: session.durationSeconds === undefined
      ? minutesBetween(session.startedAt, session.finishedAt) : Math.round(session.durationSeconds / 60) };
  }
  const progress = session.courseProgress;
  const totalKm = progress ? progress.totalMeters / 1000 : schedule.distanceKm;
  const remainingKm = progress ? progress.remainingMeters / 1000 : Math.max(0, totalKm - (traveledKm ?? 0));
  const progressPercent = totalKm > 0 ? Math.round(Math.min(1, Math.max(0, (totalKm - remainingKm) / totalKm)) * 100) : 0;
  return { ...base, traveledKm: traveledKm ?? 0, remainingKm, progressPercent };
}

export function useScheduleRecord(schedule: HikeSchedule | undefined) {
  const session = useHikeSession();
  return schedule ? scheduleRecordView(schedule, session) : undefined;
}

/** 캘린더 점 색을 나눌 날짜 목록 */
export function useScheduleDateStatus(schedules: readonly HikeSchedule[]) {
  const session = useHikeSession();
  const completed: string[] = [];
  const inProgress: string[] = [];
  for (const schedule of schedules) {
    const status = scheduleRecordView(schedule, session)?.status;
    if (status === "COMPLETED") completed.push(schedule.date);
    else if (status) inProgress.push(schedule.date);
  }
  return { completed, inProgress };
}

/**
 * 코스의 일정 중 바꾸거나 지울 수 있는 것 (등산을 시작하지 않은 일정). 시작·완료한 일정은 기록을 지키려고 고르지 않는다.
 * 없으면 undefined → 코스 화면에서는 새 일정 등록으로 연다.
 */
export function editableCourseSchedule(schedules: readonly HikeSchedule[], courseId: string, session: HikeSession | null) {
  return schedules.find(schedule => schedule.courseId === courseId && !scheduleRecordView(schedule, session));
}

export function useEditableCourseSchedule(schedules: readonly HikeSchedule[], courseId: string | undefined) {
  const session = useHikeSession();
  return courseId ? editableCourseSchedule(schedules, courseId, session) : undefined;
}
