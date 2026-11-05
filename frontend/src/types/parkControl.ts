export type ControlStatus = 'NORMAL' | 'PARTIAL' | 'CLOSED' | 'UNKNOWN';
export type ControlAsset = { kind: 'INLINE' | 'ATTACHMENT'; name: string; sourceUrl: string; imageUrl: string | null };
export type ControlOffice = {
  sourceRecordId: string; name: string; status: ControlStatus;
  collectionState: 'READY' | 'MISSING' | 'ERROR' | 'ASSET_ERROR'; stale: boolean;
  sourceAsOf: string | null; checkedAt: string | null; detailFetchedAt: string | null;
  reason: string | null; restrictedSection: string | null; restrictionPeriodText: string | null;
  contentText: string | null; contact: string | null; sourceUrl: string; assets: ControlAsset[];
};
export type ParkControl = {
  courseId: number; mountainKey: string | null; coverage: 'OFFICE_REGION';
  availability: 'AVAILABLE' | 'MISSING' | 'UNSUPPORTED'; office: ControlOffice | null;
};
export type ParkControlState = { status: 'loading' | 'unavailable' } | { status: 'error'; message: string }
  | { status: 'success'; data: ParkControl };
