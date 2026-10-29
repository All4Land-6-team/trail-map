import { apiBaseUrl, userId } from "./hikeScheduleApi";
import type { LngLat } from "../types/hike";

// 등산 기록 API (/api/v1/hike-records, 이슈 #76·#78). 시작 → 위치 기록 → 하산 → 종료.

const TIMEOUT_MS = 8_000;

export type HikeRecordStatus = "IN_PROGRESS" | "DESCENDING" | "COMPLETED";

export type HikeRecord = {
  hikeRecordId: number;
  scheduleId: number;
  courseId: number;
  status: HikeRecordStatus;
  startedAt: string;
  endedAt: string | null;
  /** 아직 반영한 위치가 없으면 null */
  traveledDistanceMeters: number | null;
  /** 종료한 기록만 있다 */
  actualDurationSeconds: number | null;
  traveledPath: LngLat[];
};

/** 서버로 보낼 GPS 위치 한 건 */
export type HikePosition = {
  longitude: number;
  latitude: number;
  recordedAt: string;
  accuracyMeters?: number;
};

export type HikePositionsResult = {
  hikeRecordId: number;
  acceptedCount: number;
  traveledDistanceMeters: number | null;
};

/** 서버가 한 번에 받는 위치 수 (HikePositionsRequest) */
export const MAX_POSITIONS_PER_REQUEST = 500;

type Envelope<T> = { success: boolean; code: string; message: string; data: T };

/** code는 서버 오류 코드(HIKE_409_4 등). 연결 실패면 "NETWORK"다. */
export class HikeRecordApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const HIKE_RECORD_ERROR = {
  scheduleNotToday: "HIKE_409_2",
  recordAlreadyExists: "HIKE_409_3",
  activeRecordExists: "HIKE_409_4",
  recordAlreadyCompleted: "HIKE_409_5",
} as const;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api/v1/hike-records${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "X-User-Id": userId(), ...init.headers },
    });
  } catch {
    throw new HikeRecordApiError(0, "NETWORK", "서버에 연결하지 못했어요.");
  } finally {
    clearTimeout(timer);
  }
  const body = await response.json().catch(() => null) as Envelope<T> | null;
  if (response.ok && body?.success) return body.data;
  throw new HikeRecordApiError(response.status, body?.code ?? "UNKNOWN",
    body?.message ?? `등산 기록 요청에 실패했어요. (${response.status})`);
}

function post<T>(path: string, body?: unknown) {
  return request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

function toRecord(record: Omit<HikeRecord, "traveledPath"> & { traveledPath: number[][] | null }): HikeRecord {
  return { ...record, traveledPath: (record.traveledPath ?? []).map(([longitude, latitude]) => [longitude, latitude]) };
}

export async function startHikeRecord(scheduleId: number) {
  return toRecord(await post("", { scheduleId }));
}

/** 진행 중(등산 중·하산 중)인 기록. 없으면 null */
export async function fetchActiveHikeRecord() {
  const record = await request<Parameters<typeof toRecord>[0] | null>("/active");
  return record ? toRecord(record) : null;
}

export function sendHikePositions(hikeRecordId: number, positions: HikePosition[]) {
  return post<HikePositionsResult>(`/${hikeRecordId}/positions`, { positions });
}

export async function descendHikeRecord(hikeRecordId: number) {
  return toRecord(await post(`/${hikeRecordId}/descend`));
}

/** 이미 종료한 기록이면 서버는 그 기록을 그대로 돌려준다 */
export async function finishHikeRecord(hikeRecordId: number) {
  return toRecord(await post(`/${hikeRecordId}/finish`));
}

/** 기록을 시작한다. 같은 일정의 기록이 이미 진행 중이면(다른 탭·재시도) 그 기록을 이어 간다. */
export async function startOrResumeHikeRecord(scheduleId: number) {
  try {
    return await startHikeRecord(scheduleId);
  } catch (error) {
    if (!(error instanceof HikeRecordApiError)
      || (error.code !== HIKE_RECORD_ERROR.activeRecordExists && error.code !== HIKE_RECORD_ERROR.recordAlreadyExists)) throw error;
    const active = await fetchActiveHikeRecord();
    if (active?.scheduleId === scheduleId) return active;
    throw error;
  }
}

/** 등산 시작 실패 안내 문구 */
export function hikeStartErrorMessage(error: unknown) {
  if (!(error instanceof HikeRecordApiError) || error.code === "NETWORK") return "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
  switch (error.code) {
    case HIKE_RECORD_ERROR.scheduleNotToday: return "오늘 일정만 등산을 시작할 수 있어요.";
    case HIKE_RECORD_ERROR.recordAlreadyExists: return "이미 등산을 마친 일정이에요.";
    case HIKE_RECORD_ERROR.activeRecordExists: return "진행 중인 다른 등산이 있어요.";
    default: return "등산을 시작하지 못했어요. 다시 시도해 주세요.";
  }
}
