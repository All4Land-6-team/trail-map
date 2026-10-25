import type { CourseRestroom } from '../types/facility';

export const COURSE_FACILITY_RADIUS_METERS = 250;
const FORMAT_ERROR = '화장실 응답 형식이 올바르지 않아요. 다시 시도해 주세요.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isCoordinate(value: unknown, limit: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
}

export function courseFacilitiesUrl(courseId: number, radiusMeters = COURSE_FACILITY_RADIUS_METERS,
  apiBaseUrl = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8080') {
  if (!isId(courseId)) throw new Error('조회할 코스가 연결되지 않았어요.');
  if (!Number.isFinite(radiusMeters) || radiusMeters < 1 || radiusMeters > 5000) {
    throw new Error('조회 거리는 1m 이상 5,000m 이하여야 해요.');
  }
  const query = new URLSearchParams({ type: 'RESTROOM', radiusMeters: String(radiusMeters) });
  return `${apiBaseUrl.replace(/\/+$/, '')}/api/v1/courses/${courseId}/facilities?${query}`;
}

/** 코스 조회 API는 GeoJSON이 아닌 SuccessResponse.data 목록을 반환한다. */
export function parseCourseRestrooms(value: unknown, radiusMeters = COURSE_FACILITY_RADIUS_METERS): CourseRestroom[] {
  if (!isRecord(value) || value.success !== true || !Array.isArray(value.data)) throw new Error(FORMAT_ERROR);
  const ids = new Set<number>();
  const restrooms = value.data.map((item): CourseRestroom => {
    if (!isRecord(item) || !isId(item.facilityId) || ids.has(item.facilityId)
      || item.type !== 'RESTROOM' || !(item.name === null || typeof item.name === 'string')
      || !isCoordinate(item.longitude, 180) || !isCoordinate(item.latitude, 90)
      || typeof item.distanceMeters !== 'number' || !Number.isFinite(item.distanceMeters)
      || item.distanceMeters < 0 || item.distanceMeters > radiusMeters
      || !(item.sourceDate === null || (typeof item.sourceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.sourceDate)))) {
      throw new Error(FORMAT_ERROR);
    }
    ids.add(item.facilityId);
    return {
      facilityId: item.facilityId, name: item.name as string | null, type: 'RESTROOM',
      longitude: item.longitude, latitude: item.latitude, distanceMeters: item.distanceMeters,
      sourceDate: item.sourceDate as string | null,
    };
  });
  return restrooms.sort((a, b) => a.distanceMeters - b.distanceMeters || a.facilityId - b.facilityId);
}

export async function loadCourseRestrooms(courseId: number, {
  signal, radiusMeters = COURSE_FACILITY_RADIUS_METERS, timeoutMs = 10_000,
}: { signal?: AbortSignal; radiusMeters?: number; timeoutMs?: number } = {}): Promise<CourseRestroom[]> {
  const url = courseFacilitiesUrl(courseId, radiusMeters);
  signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' }, signal: controller.signal, cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(response.status === 404
        ? '연결된 코스를 찾을 수 없어요. 코스 목록에서 다시 선택해 주세요.'
        : '화장실을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    const result = parseCourseRestrooms(await response.json(), radiusMeters);
    controller.signal.throwIfAborted();
    return result;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted) throw new Error('응답이 늦어지고 있어요. 다시 시도해 주세요.');
    if (error instanceof TypeError) throw new Error('서버에 연결할 수 없어요. 연결 상태를 확인하고 다시 시도해 주세요.');
    if (error instanceof SyntaxError) throw new Error(FORMAT_ERROR);
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
