import { useSyncExternalStore } from "react";
import { createHikeSchedule, deleteHikeSchedule, fetchHikeSchedules, updateHikeSchedule } from "../api/hikeScheduleApi";
import { sampleSchedules, toDateKey } from "../api/hikeMock";
import type { HikeSchedule } from "../types/hike";

// 화면 사이에서 일정 변경을 공유하는 저장소.
// 앱이 켜질 때 백엔드에 한 번 물어봐서, 응답하면 일정 API로 저장·조회하고(api)
// 응답하지 않으면 예시 일정으로 동작한다(mock). mock에서는 새로고침하면 예시 일정으로 돌아간다.

export type HikeScheduleMode = "checking" | "api" | "mock";

/** 백엔드가 이 시간 안에 응답하지 않으면 예시 일정으로 동작한다. */
const PROBE_TIMEOUT_MS = 2_500;
/** 서버 조회 기간 제한(366일) 안에서 지난 6개월 ~ 앞으로 6개월 일정을 불러온다. */
const PAST_DAYS = 180;
const FUTURE_DAYS = 185;

type State = { mode: HikeScheduleMode; schedules: readonly HikeSchedule[] };

let state: State = { mode: "checking", schedules: [] };
const listeners = new Set<() => void>();

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  if (next.schedules) state = { ...state, schedules: [...next.schedules].sort((a, b) => a.date.localeCompare(b.date)) };
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

let started = false;

/** 백엔드 연결 여부를 확인하고 일정을 불러온다. 처음 구독할 때 한 번만 실행된다. */
function start() {
  if (started) return;
  started = true;
  fetchHikeSchedules(dateOffset(-PAST_DAYS), dateOffset(FUTURE_DAYS), PROBE_TIMEOUT_MS)
    .then(schedules => setState({ mode: "api", schedules }))
    .catch(() => setState({ mode: "mock", schedules: sampleSchedules }));
}

export function useHikeSchedules() {
  start();
  return useSyncExternalStore(subscribe, () => state.schedules);
}

export function useHikeScheduleMode() {
  start();
  return useSyncExternalStore(subscribe, () => state.mode);
}

/** 백엔드 연결 확인이 끝나면 api 또는 mock을 돌려준다. */
export function whenScheduleModeReady() {
  start();
  if (state.mode !== "checking") return Promise.resolve(state.mode);
  return new Promise<HikeScheduleMode>(resolve => {
    const unsubscribe = subscribe(() => {
      if (state.mode === "checking") return;
      unsubscribe();
      resolve(state.mode);
    });
  });
}

export function findScheduleById(scheduleId: number) {
  return state.schedules.find(schedule => schedule.scheduleId === scheduleId);
}

export function findSchedule(date: string) {
  return state.schedules.find(schedule => schedule.date === date);
}

function replaceLocal(saved: HikeSchedule, previousDate?: string) {
  setState({ schedules: [...state.schedules.filter(item => item.date !== saved.date && item.date !== previousDate), saved] });
}

export type SaveScheduleOptions = {
  /** 이 날짜에 있던 일정을 옮기는 수정이면 그 날짜 */
  previousDate?: string;
  /** 같은 날짜의 다른 일정을 대체한다 (대체 확인 후) */
  replaceExisting?: boolean;
};

/**
 * 일정을 저장한다. 같은 날짜에는 일정 1개만 두므로 그 날짜의 기존 일정은 대체된다.
 * api 모드에서 같은 날짜에 일정이 있으면 HikeScheduleApiError("conflict")를 던지고, 화면은 대체 확인 후 replaceExisting으로 다시 부른다.
 */
export async function saveSchedule(schedule: HikeSchedule, { previousDate, replaceExisting = false }: SaveScheduleOptions = {}) {
  if (state.mode !== "api") {
    replaceLocal(schedule, previousDate);
    return schedule;
  }
  const existing = previousDate ? findSchedule(previousDate) : undefined;
  const scheduleId = schedule.scheduleId ?? existing?.scheduleId;
  const saved = scheduleId === undefined
    ? await createHikeSchedule(schedule, replaceExisting)
    : await updateHikeSchedule(scheduleId, schedule, replaceExisting);
  replaceLocal(saved, previousDate);
  return saved;
}

/** api 모드에서 그 날짜 일정을 서버에서 다시 불러온다. 다른 곳에서 만든 일정과 겹쳤을 때(409) 화면에 보여 주기 위해 쓴다. */
export async function refreshScheduleOn(date: string) {
  if (state.mode !== "api") return findSchedule(date);
  const [fresh] = await fetchHikeSchedules(date, date);
  setState({ schedules: [...state.schedules.filter(item => item.date !== date), ...(fresh ? [fresh] : [])] });
  return fresh;
}

export async function deleteSchedule(date: string) {
  const target = findSchedule(date);
  if (state.mode === "api" && target?.scheduleId !== undefined) await deleteHikeSchedule(target.scheduleId);
  setState({ schedules: state.schedules.filter(schedule => schedule.date !== date) });
}
