import { DEV_COURSE_IDS } from "../constants/hikeCourseIds";
import type { HikeSchedule } from "../types/hike";

// 등산 일정 API (/api/v1/hike-schedules, 이슈 #56·#61).
// 로그인이 정해지기 전까지 사용자는 X-User-Id 헤더로 구분한다 (백엔드 CurrentUserIdArgumentResolver).

const DEFAULT_API_BASE_URL = "http://localhost:8080";
const DEFAULT_USER_ID = "1";
const TIMEOUT_MS = 8_000;

type ScheduleResponse = {
  scheduleId: number;
  date: string;
  startTime: string;
  courseId: number;
  courseName: string;
  mountainId: number;
  mountainName: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
};

export type HikeRecordCompletionResponse = {
  hikeRecordId: number;
  scheduleId: number;
  courseId: number;
  endedAt: string;
};

type Envelope<T> = { success: boolean; code: string; message: string; data: T };

/** 실패 이유. 화면은 kind로 안내 문구와 다음 동작(대체 확인 등)을 정한다. */
export type HikeScheduleApiErrorKind = "conflict" | "notFound" | "unsupportedCourse" | "network" | "server";

export class HikeScheduleApiError extends Error {
  readonly kind: HikeScheduleApiErrorKind;

  constructor(kind: HikeScheduleApiErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export function apiBaseUrl() {
  return (import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

export function userId() {
  return import.meta.env?.VITE_HIKE_USER_ID || DEFAULT_USER_ID;
}

const backendCourseIds = new Map(Object.entries(DEV_COURSE_IDS).map(([screenId, dbId]) => [dbId, screenId]));

/** 화면 코스 ID → DB 코스 번호. 매핑에 없는 코스는 아직 일정 API로 저장할 수 없다. */
function toBackendCourseId(courseId: string) {
  const id = DEV_COURSE_IDS[courseId];
  if (id === undefined) throw new HikeScheduleApiError("unsupportedCourse", "이 코스는 아직 일정 등록을 지원하지 않아요.");
  return id;
}

function toSchedule(response: ScheduleResponse): HikeSchedule {
  return {
    scheduleId: response.scheduleId,
    date: response.date,
    startTime: response.startTime,
    courseId: backendCourseIds.get(response.courseId) ?? `db-${response.courseId}`,
    mountainName: response.mountainName,
    courseName: response.courseName,
    distanceKm: response.distanceMeters == null ? 0 : Math.round(response.distanceMeters / 100) / 10,
  };
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api/v1/hike-schedules${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "X-User-Id": userId(), ...init.headers },
    });
  } catch {
    throw new HikeScheduleApiError("network", "서버에 연결하지 못했어요.");
  } finally {
    clearTimeout(timer);
  }
  const body = await response.json().catch(() => null) as Envelope<T> | null;
  if (response.ok && body?.success) return body.data;
  if (response.status === 409) throw new HikeScheduleApiError("conflict", body?.message ?? "해당 날짜에 이미 등산 일정이 있어요.");
  if (response.status === 404) throw new HikeScheduleApiError("notFound", body?.message ?? "일정을 찾을 수 없어요.");
  throw new HikeScheduleApiError("server", body?.message ?? `일정 요청에 실패했어요. (${response.status})`);
}

/** from~to(포함) 기간의 일정. 서버는 최대 366일까지 조회한다. */
export async function fetchHikeSchedules(from: string, to: string, timeoutMs?: number) {
  const data = await request<ScheduleResponse[]>(`?from=${from}&to=${to}`, {}, timeoutMs);
  return data.map(toSchedule);
}

export async function createHikeSchedule(schedule: HikeSchedule, replaceExisting: boolean) {
  const data = await request<ScheduleResponse>("", {
    method: "POST",
    body: JSON.stringify({ courseId: toBackendCourseId(schedule.courseId), date: schedule.date, startTime: schedule.startTime, replaceExisting }),
  });
  return toSchedule(data);
}

export async function updateHikeSchedule(scheduleId: number, schedule: HikeSchedule, replaceExisting: boolean) {
  const data = await request<ScheduleResponse>(`/${scheduleId}`, {
    method: "PATCH",
    body: JSON.stringify({ courseId: toBackendCourseId(schedule.courseId), date: schedule.date, startTime: schedule.startTime, replaceExisting }),
  });
  return toSchedule(data);
}

export async function deleteHikeSchedule(scheduleId: number) {
  await request<null>(`/${scheduleId}`, { method: "DELETE" });
}

export async function completeHikeSchedule(scheduleId: number) {
  return request<HikeRecordCompletionResponse>(`/${scheduleId}/complete`, { method: "POST" });
}
