import { useSyncExternalStore } from "react";
import {
  createHikeSchedule, deleteHikeSchedule, fetchHikeSchedules, HikeScheduleApiError, toBackendCourseId, updateHikeSchedule,
} from "../api/hikeScheduleApi";
import { sampleSchedules, toDateKey } from "../api/hikeMock";
import type { HikeSchedule } from "../types/hike";
import { getAuthSession } from "./authStore";
import { loadScheduleCache, saveScheduleCache } from "./scheduleCache";

// 화면 사이에서 일정 변경을 공유하는 저장소.
// 앱이 켜질 때 백엔드에 한 번 물어봐서, 응답하면 일정 API로 저장·조회하고(api)
// 응답하지 않으면 예시 일정으로 동작한다(mock). mock에서는 새로고침하면 예시 일정으로 돌아간다.
// 통신이 끊겨 응답하지 않을 때 이 계정의 일정을 받아 둔 적이 있으면 그 목록을 보여 주고(offline),
// 일정 저장·삭제는 막는다. 통신이 다시 연결되면 서버에서 다시 불러와 api로 돌아간다.

export type HikeScheduleMode = "checking" | "api" | "offline" | "mock";

/** 백엔드가 이 시간 안에 응답하지 않으면 예시 일정으로 동작한다. */
const PROBE_TIMEOUT_MS = 2_500;
/** 서버 조회 기간 제한(366일) 안에서 지난 6개월 ~ 앞으로 6개월 일정을 불러온다. */
const PAST_DAYS = 180;
const FUTURE_DAYS = 185;

/** savedAt: offline에서 보여 주는 일정을 서버에서 받은 시각 */
type State = { mode: HikeScheduleMode; schedules: readonly HikeSchedule[]; savedAt?: string };

let state: State = { mode: "checking", schedules: [] };
const listeners = new Set<() => void>();

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  if (next.schedules) state = { ...state, schedules: [...next.schedules].sort((a, b) => a.date.localeCompare(b.date)) };
  // 서버와 맞춰진 목록만 저장한다.
  if (state.mode === "api" && (next.schedules || next.mode)) saveScheduleCache(getAuthSession()?.user.userId, state.schedules);
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

/** 통신이 끊겨 서버에 닿지 못했으면 이 계정의 저장본으로, 아니면(백엔드 없음·로그인 안 함) 예시 일정으로 동작한다. */
function fallBack(error: unknown) {
  const cache = error instanceof HikeScheduleApiError && error.kind === "network"
    ? loadScheduleCache(getAuthSession()?.user.userId) : null;
  if (cache) setState({ mode: "offline", schedules: cache.schedules, savedAt: cache.savedAt });
  else setState({ mode: "mock", schedules: sampleSchedules });
}

/** offline에서 서버에 다시 닿으면 api로 돌아간다. 닿지 못하면 network 오류를 던진다. */
async function reconnect() {
  const schedules = await fetchHikeSchedules(dateOffset(-PAST_DAYS), dateOffset(FUTURE_DAYS));
  setState({ mode: "api", schedules, savedAt: undefined });
}

/** 백엔드 연결 여부를 확인하고 일정을 불러온다. 처음 구독할 때 한 번만 실행된다. */
function start() {
  if (started) return;
  started = true;
  fetchHikeSchedules(dateOffset(-PAST_DAYS), dateOffset(FUTURE_DAYS), PROBE_TIMEOUT_MS)
    .then(schedules => setState({ mode: "api", schedules }))
    .catch(fallBack);
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => { if (state.mode === "offline") reconnect().catch(() => {}); });
  }
}

export function useHikeSchedules() {
  start();
  return useSyncExternalStore(subscribe, () => state.schedules);
}

export function useHikeScheduleMode() {
  start();
  return useSyncExternalStore(subscribe, () => state.mode);
}

/** offline이면 보여 주는 일정을 서버에서 받은 시각, 아니면 undefined */
export function useScheduleSavedAt() {
  start();
  return useSyncExternalStore(subscribe, () => state.mode === "offline" ? state.savedAt : undefined);
}

/** 백엔드 연결 확인이 끝나면 api·offline·mock 중 하나를 돌려준다. */
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
  // 초기 조회가 끝나기 전에 실제 일정이 로컬 예시로 저장되는 것을 막는다.
  await whenScheduleModeReady();
  // 오프라인 저장본은 서버와 다를 수 있어 화면에서만 바꾸지 않는다. 다시 연결되면 저장한다.
  if (state.mode === "offline") await reconnect();
  if (schedule.courseId.startsWith("db-")) {
    toBackendCourseId(schedule.courseId);
    if (state.mode !== "api") {
      // 실제 코스는 API에만 저장한다. 서버가 복구되면 같은 입력으로 다시 시도할 수 있다.
      const schedules = await fetchHikeSchedules(dateOffset(-PAST_DAYS), dateOffset(FUTURE_DAYS));
      setState({ mode: "api", schedules });
    }
  }
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
  if (state.mode === "offline") await reconnect();
  const target = findSchedule(date);
  if (state.mode === "api" && target?.scheduleId !== undefined) await deleteHikeSchedule(target.scheduleId);
  setState({ schedules: state.schedules.filter(schedule => schedule.date !== date) });
}
