import { useSyncExternalStore } from "react";
import { courseFixtures } from "../api/courseMock";
import { fetchActiveHikeRecord } from "../api/hikeRecordApi";
import { readHashParams } from "../hooks/useHashRoute";
import { findScheduleById, whenScheduleModeReady } from "./hikeScheduleStore";
import { fromRecord, getHikeSession, restoreHikeSession } from "./hikeSessionStore";

// 새로고침·재접속 후 서버의 진행 중 기록으로 등산 상태를 다시 만든다. 앱이 켜진 뒤 한 번만 시도한다.
// 일정 API에 연결되지 않았거나 화면 코스에 없는 코스면 이어 가지 않는다.

let started = false;
let restoring = false;
const listeners = new Set<() => void>();

async function restore() {
  if (await whenScheduleModeReady() !== "api" || getHikeSession()) return;
  const record = await fetchActiveHikeRecord().catch(() => null);
  if (!record || getHikeSession()) return;
  const schedule = findScheduleById(record.scheduleId);
  const mountainId = schedule && courseFixtures.find(course => course.id === schedule.courseId)?.mountainId;
  if (!schedule || !mountainId) return;
  restoreHikeSession({ schedule: { ...schedule }, mountainId, alertsOn: readHashParams().get("alerts") !== "off", ...fromRecord(record) });
}

function start() {
  if (started) return;
  started = true;
  restoring = true;
  void restore().finally(() => {
    restoring = false;
    listeners.forEach(listener => listener());
  });
}

/** 진행 중 기록을 이어 가도록 확인하고, 확인하는 동안 true를 돌려준다. 이 동안 등산 화면은 "진행 중인 등산이 없어요"를 보여 주지 않는다. */
export function useRestoreActiveHike() {
  start();
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, () => restoring);
}
