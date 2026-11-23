import { authHeaders } from "../store/authStore";

// 등산 담기 API (/api/v1/saved-courses, 이슈 #196). 로그인한 계정에 담은 코스를 저장한다.

const DEFAULT_API_BASE_URL = "http://localhost:8080";
const TIMEOUT_MS = 8_000;

export type SavedCourseItem = {
  /** DB 코스 번호 */
  courseId: number;
  mountainId: number;
  /** 코스 경로 카탈로그의 산 키(예: bukhansan). 경로가 없는 코스면 null */
  mountainKey: string | null;
  savedAt: string;
};

type Envelope<T> = { success: boolean; code: string; message: string; data: T };

export class SavedCourseApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function baseUrl() {
  return (import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/api/v1/saved-courses${path}`, {
      ...init, signal: controller.signal, headers: authHeaders({ Accept: "application/json", ...init.headers }),
    });
  } catch {
    throw new SavedCourseApiError(0, "서버에 연결하지 못했어요.");
  } finally {
    clearTimeout(timer);
  }
  const body = await response.json().catch(() => null) as Envelope<T> | null;
  if (response.ok && body?.success) return body.data;
  throw new SavedCourseApiError(response.status, body?.message ?? `등산 담기 요청에 실패했어요. (${response.status})`);
}

/** 내가 담은 코스 (먼저 담은 것부터) */
export function fetchSavedCourses() {
  return request<SavedCourseItem[]>("");
}

/** 담기. 이미 담겨 있으면 그대로 */
export function putSavedCourse(courseId: number) {
  return request<SavedCourseItem>(`/${courseId}`, { method: "PUT" });
}

/** 빼기. 담겨 있지 않아도 성공 */
export function deleteSavedCourse(courseId: number) {
  return request<null>(`/${courseId}`, { method: "DELETE" });
}
