import { useSyncExternalStore } from "react";
import { fetchActiveHikeRecord, isHikeNetworkError, type HikeRecord } from "../api/hikeRecordApi";
import { readHashParams } from "../hooks/useHashRoute";
import { pendingHikeActions } from "./hikeOfflineSync";
import { findScheduleById, whenScheduleModeReady } from "./hikeScheduleStore";
import { clearHikeSnapshot, loadHikeSnapshot, type HikeSessionSnapshot } from "./hikeSessionSnapshot";
import { fromRecord, getHikeSession, restoreHikeSession } from "./hikeSessionStore";

// 새로고침·재접속 후 서버의 진행 중 기록으로 등산 상태를 다시 만든다. 앱이 켜진 뒤 한 번만 시도한다.
// 산·코스 ID는 일정의 서버 번호를 쓴다.
// 서버에 닿지 못하면(산에서 통신 끊김) 휴대폰에 저장해 둔 진행 중 등산(hikeSessionSnapshot)으로 이어 간다.

/** 저장본만으로 이어 간다. 일정 목록을 못 받아도 저장본의 일정 정보를 그대로 쓴다. */
function restoreFromSnapshot(saved: HikeSessionSnapshot) {
  const { savedAt: _savedAt, ...session } = saved;
  restoreHikeSession(session);
}

/**
 * 서버 기록과 저장본이 같은 기록이면 서버에 아직 못 보낸 내용을 저장본에서 가져온다.
 * - 이동 경로: 못 보낸 위치가 있어 저장본이 더 길면 저장본
 * - 하산: 오프라인에서 누른 하산 시작이 아직 서버에 안 갔으면 저장본의 하산 상태
 */
function mergeWithSnapshot(record: HikeRecord, saved: HikeSessionSnapshot | null) {
  const restored = fromRecord(record);
  if (!saved || saved.hikeRecordId !== record.hikeRecordId) return restored;
  const descendingLocally = saved.phase === "downhill" && restored.phase === "active";
  return { ...restored,
    traveledPath: saved.traveledPath.length > restored.traveledPath.length ? saved.traveledPath : restored.traveledPath,
    ...(descendingLocally && { phase: "downhill" as const, descentPathStart: saved.descentPathStart }) };
}

let started = false;
let restoring = false;
const listeners = new Set<() => void>();

async function restore() {
  const mode = await whenScheduleModeReady();
  if (getHikeSession()) return;
  const saved = loadHikeSnapshot();
  // 일정 API에 닿지 못해 예시 데이터 모드로 켜졌으면 서버도 못 닿는 상태다 → 저장본으로 이어 간다.
  if (mode !== "api") {
    if (saved) restoreFromSnapshot(saved);
    return;
  }
  let record: HikeRecord | null;
  try {
    record = await fetchActiveHikeRecord();
  } catch (error) {
    if (saved && isHikeNetworkError(error) && !getHikeSession()) restoreFromSnapshot(saved);
    return;
  }
  if (getHikeSession()) return;
  if (!record) {
    // 서버에 진행 중 기록이 없으면 이미 끝난 등산이다. 종료가 아직 대기 중이 아니면 저장본을 지운다.
    if (saved && !pendingHikeActions(saved.hikeRecordId).some(item => item.finishedAt)) clearHikeSnapshot(saved.hikeRecordId);
    return;
  }
  const schedule = findScheduleById(record.scheduleId) ?? (saved?.hikeRecordId === record.hikeRecordId ? saved.schedule : undefined);
  if (!schedule) return;
  restoreHikeSession({ schedule: { ...schedule }, alertsOn: saved?.alertsOn ?? readHashParams().get("alerts") !== "off",
    ...mergeWithSnapshot(record, saved) });
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
