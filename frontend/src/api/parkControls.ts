import type { ParkControl, ControlOffice, ControlAsset } from '../types/parkControl';
const FORMAT_ERROR = '통제정보 응답을 확인할 수 없어요.';
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const nullableText = (v: unknown) => v === null || typeof v === 'string';
const date = (v: unknown) => v === null || (typeof v === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v)));
const url = (v: unknown) => { try { return typeof v === 'string' && new URL(v).protocol === 'https:'; } catch { return false; } };
export function parseParkControl(value: unknown, courseId: number, mountainKey: string): ParkControl {
  const fail = () => { throw new Error(FORMAT_ERROR); };
  if (!record(value) || value.success !== true || !record(value.data)) return fail();
  const d = value.data;
  if (d.courseId !== courseId || (d.mountainKey !== mountainKey && !(d.availability === 'UNSUPPORTED' && d.mountainKey === null)) || d.coverage !== 'OFFICE_REGION'
    || !['AVAILABLE', 'MISSING', 'UNSUPPORTED'].includes(d.availability as string)) return fail();
  if (d.availability !== 'AVAILABLE') {
    if (d.office !== null) return fail();
    return d as ParkControl;
  }
  const o = d.office;
  if (!record(o) || typeof o.sourceRecordId !== 'string' || !o.sourceRecordId || typeof o.name !== 'string'
    || !['NORMAL', 'PARTIAL', 'CLOSED', 'UNKNOWN'].includes(o.status as string)
    || !['READY', 'MISSING', 'ERROR', 'ASSET_ERROR'].includes(o.collectionState as string) || typeof o.stale !== 'boolean'
    || ![o.sourceAsOf, o.checkedAt, o.detailFetchedAt].every(date)
    || ![o.reason, o.restrictedSection, o.restrictionPeriodText, o.contentText, o.contact].every(nullableText)
    || !url(o.sourceUrl) || !Array.isArray(o.assets)) return fail();
  const assets = o.assets.map((a): ControlAsset => {
    if (!record(a) || !['INLINE', 'ATTACHMENT'].includes(a.kind as string) || typeof a.name !== 'string'
      || !url(a.sourceUrl) || !(a.imageUrl === null || url(a.imageUrl))) return fail();
    return a as ControlAsset;
  });
  return { ...d, office: { ...o, assets } as ControlOffice } as ParkControl;
}
export async function loadParkControl(courseId: number, mountainKey: string, signal: AbortSignal): Promise<ParkControl> {
  const base = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8080';
  const timeout = AbortSignal.timeout(10_000);
  const response = await fetch(`${base.replace(/\/+$/, '')}/api/v1/courses/${courseId}/access-control`, {
    signal: AbortSignal.any([signal, timeout]), headers: { Accept: 'application/json' }, cache: 'no-store',
  });
  if (!response.ok) throw new Error('통제정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  return parseParkControl(await response.json(), courseId, mountainKey);
}
