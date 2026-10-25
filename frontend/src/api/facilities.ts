import type { Facility, FacilityFeatureCollection } from '../types/facility';

const FORMAT_ERROR = '시설 응답 형식이 올바르지 않습니다.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function coordinate(value: unknown, limit: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
}

export function parseFacilityReview(value: unknown, sourceId: number): FacilityFeatureCollection {
  if (!isRecord(value) || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) {
    throw new Error(FORMAT_ERROR);
  }
  const ids = new Set<number>();
  for (const feature of value.features) {
    if (!isRecord(feature) || feature.type !== 'Feature' || !isId(feature.id)
      || ids.has(feature.id) || !isRecord(feature.geometry) || feature.geometry.type !== 'Point'
      || !Array.isArray(feature.geometry.coordinates) || feature.geometry.coordinates.length !== 2
      || !isRecord(feature.properties)) throw new Error(FORMAT_ERROR);
    const p = feature.properties;
    const [longitude, latitude] = feature.geometry.coordinates;
    if (!coordinate(longitude, 180) || !coordinate(latitude, 90)
      || p.longitude !== longitude || p.latitude !== latitude || p.facilityId !== feature.id
      || p.type !== 'RESTROOM' || !(p.mountainId === null || isId(p.mountainId))
      || !nullableString(p.name) || !nullableString(p.sourceRecordId)
      || !nullableString(p.sourceReportedStatus) || !nullableString(p.sourceDate)
      || typeof p.importedAt !== 'string'
      || !(p.distanceMeters === null || (typeof p.distanceMeters === 'number' && Number.isFinite(p.distanceMeters) && p.distanceMeters >= 0))
      || !isRecord(p.source) || p.source.sourceId !== sourceId
      || typeof p.source.name !== 'string' || typeof p.source.format !== 'string'
      || !nullableString(p.source.provider) || !nullableString(p.source.url)
      || !nullableString(p.source.crs) || !nullableString(p.source.version)) throw new Error(FORMAT_ERROR);
    ids.add(feature.id);
  }
  return value as FacilityFeatureCollection;
}

export function facilityReviewUrl(sourceId: number,
  apiBaseUrl = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8080') {
  if (!isId(sourceId)) throw new Error('출처 ID는 양의 정수여야 합니다.');
  return `${apiBaseUrl.replace(/\/+$/, '')}/api/v1/facilities/review?sourceId=${sourceId}&type=RESTROOM`;
}

export async function loadFacilityReview(sourceId: number, {
  signal, timeoutMs = 10_000,
}: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<FacilityFeatureCollection> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(facilityReviewUrl(sourceId), {
      headers: { Accept: 'application/geo+json' }, signal: controller.signal, cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(response.status === 404
        ? '검토 API 또는 출처를 찾지 못했습니다. sourceId와 백엔드 facility.review.enabled=true 설정을 확인해 주세요.'
        : `시설을 불러오지 못했습니다. (HTTP ${response.status})`);
    }
    return parseFacilityReview(await response.json(), sourceId);
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted) throw new Error('조회 시간이 초과됐습니다. 백엔드 연결을 확인하고 다시 시도해 주세요.');
    if (error instanceof TypeError) throw new Error('백엔드에 연결할 수 없습니다. 서버 실행 상태와 API 주소를 확인해 주세요.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export function filterFacilities(facilities: readonly Facility[], query: string): Facility[] {
  const needle = query.trim().toLocaleLowerCase('ko-KR');
  return facilities.filter(facility => !needle
    || (facility.name ?? '').toLocaleLowerCase('ko-KR').includes(needle)
    || (facility.sourceRecordId ?? '').toLowerCase().includes(needle));
}

export function groupFacilityLocations(facilities: readonly Facility[]): Facility[][] {
  const groups = new Map<string, Facility[]>();
  for (const facility of facilities) {
    const key = `${facility.longitude},${facility.latitude}`;
    const group = groups.get(key) ?? [];
    group.push(facility);
    groups.set(key, group);
  }
  return [...groups.values()];
}
