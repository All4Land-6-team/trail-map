import type { Course, CourseDiscoveryData, CourseRequest } from "../types/course";
import type { CourseDetailData } from "../types/courseDetail";
import { loadHomeDiscoveryData } from "./homeMock";
import { loadCourseDiscoveryData as loadExampleDiscovery } from "./courseMock";
import { loadCourseDetailData as loadExampleDetail } from "./courseDetailMock";
import { databaseCourseId } from "../utils/courseIdentity";
export { databaseCourseId } from "../utils/courseIdentity";

const FORMAT_ERROR = "경로 응답 형식이 올바르지 않습니다.";
export const hasRouteCatalog = (mountainKey: string) => mountainKey === "bukhansan" || mountainKey === "dobongsan";
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const id = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const nonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const textOrNull = (value: unknown): value is string | null => value === null || typeof value === "string";
const fail = (): never => { throw new Error(FORMAT_ERROR); };

/** API 경로는 분석 프로필과 독립적이며, 반환한 DB 식별자를 그대로 사용한다. */
export function parseCourseRoute(value: unknown, mountainKey: string, expectedId?: number): Course {
  if (!record(value) || !id(value.courseId) || !id(value.mountainId) || !id(value.courseVersion)
    || value.mountainKey !== mountainKey || (expectedId !== undefined && value.courseId !== expectedId)
    || typeof value.courseName !== "string" || !value.courseName.trim() || typeof value.routeLabel !== "string"
    || !nonnegative(value.distanceMeters) || !(value.officialDistanceMeters === null || nonnegative(value.officialDistanceMeters))
    || !(value.durationSeconds === null || nonnegative(value.durationSeconds))
    || ![null, "BEGINNER", "INTERMEDIATE", "EXPERT"].includes(value.difficulty as string | null)
    || !record(value.geometry) || value.geometry.type !== "LineString" || !Array.isArray(value.geometry.coordinates)
    || value.geometry.coordinates.length < 2 || !record(value.source)) return fail();
  const coordinates: [number, number][] = value.geometry.coordinates.map(point => {
    if (!Array.isArray(point) || point.length !== 2 || typeof point[0] !== "number" || !Number.isFinite(point[0])
      || Math.abs(point[0]) > 180 || typeof point[1] !== "number" || !Number.isFinite(point[1]) || Math.abs(point[1]) > 90) return fail();
    return [point[0], point[1]];
  });
  const source = value.source;
  if (typeof source.name !== "string" || typeof source.validationStatus !== "string" || !source.validationStatus.trim()
    || ![source.provider, source.url, source.version, source.recordId, source.checkNote].every(textOrNull)) return fail();
  return {
    id: `db-${value.courseId}`, backendCourseId: value.courseId,
    analysisReference: { courseId: value.courseId, mountainId: value.mountainId, development: false },
    mountainId: mountainKey, courseVersion: value.courseVersion, name: value.courseName, routeLabel: value.routeLabel,
    difficulty: value.difficulty === null ? null : ({ BEGINNER: "beginner", INTERMEDIATE: "intermediate", EXPERT: "advanced" } as const)[value.difficulty as "BEGINNER" | "INTERMEDIATE" | "EXPERT"],
    distanceKm: value.distanceMeters / 1000, officialDistanceMeters: value.officialDistanceMeters as number | null,
    durationMinutes: value.durationSeconds === null ? null : (value.durationSeconds as number) / 60,
    elevationGainMeters: null, peakElevationMeters: null, steepRatioPercent: null,
    analysisStatus: "pending", detailAvailable: true, routeCoordinates: coordinates,
    routeSource: source as Course["routeSource"],
  };
}

function unwrap(value: unknown): unknown {
  if (!record(value) || value.success !== true || !("data" in value)) return fail();
  return value.data;
}
export function parseCourseRouteList(value: unknown, mountainKey: string): Course[] {
  const data = unwrap(value);
  if (!Array.isArray(data)) return fail();
  const courses = data.map(item => parseCourseRoute(item, mountainKey));
  if (new Set(courses.map(course => course.id)).size !== courses.length) return fail();
  return courses;
}

export async function requestCourseRoutes(path: string, signal: AbortSignal, timeoutMs = 10_000): Promise<unknown> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, timeoutMs);
  try {
    const base = import.meta.env?.VITE_API_BASE_URL || "http://localhost:8080";
    const response = await fetch(`${base.replace(/\/+$/, "")}/api/v1/${path}`, {
      signal: controller.signal, headers: { Accept: "application/json" }, cache: "no-store",
    });
    controller.signal.throwIfAborted();
    if (response.status === 404 && path.startsWith("courses/")) return null;
    if (!response.ok) throw new Error(`경로를 불러오지 못했습니다. (HTTP ${response.status})`);
    const result: unknown = await response.json();
    controller.signal.throwIfAborted();
    return result;
  } catch (error) {
    signal.throwIfAborted();
    if (controller.signal.aborted) throw new Error("경로 조회 시간이 초과됐습니다. 다시 시도해 주세요.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}

export async function loadCourseDiscoveryData(mountainId: string, signal: AbortSignal): Promise<CourseDiscoveryData | undefined> {
  if (!hasRouteCatalog(mountainId)) return loadExampleDiscovery(mountainId, signal);
  const home = await loadHomeDiscoveryData(signal);
  const mountain = home.mountains.find(item => item.id === mountainId);
  if (!mountain) return undefined;
  const response = await requestCourseRoutes(`course-routes?mountainKey=${encodeURIComponent(mountainId)}`, signal);
  return { mountain, courses: parseCourseRouteList(response, mountainId) };
}

export async function loadCourseDetailData(request: CourseRequest, signal: AbortSignal): Promise<CourseDetailData | null> {
  const courseId = databaseCourseId(request.courseId);
  if (courseId === null) {
    // 실제 경로 산에서는 이전 합성 경로로 돌아가지 않는다.
    return hasRouteCatalog(request.mountainId) ? null : loadExampleDetail(request, signal);
  }
  const response = await requestCourseRoutes(`courses/${courseId}/route`, signal);
  return response === null ? null : { course: parseCourseRoute(unwrap(response), request.mountainId, courseId), spots: [] };
}
