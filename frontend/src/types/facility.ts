export type Facility = {
  facilityId: number;
  mountainId: number | null;
  name: string | null;
  type: 'RESTROOM' | 'SHELTER' | 'DRINKING_WATER';
  longitude: number;
  latitude: number;
  sourceReportedStatus: string | null;
  sourceRecordId: string | null;
  sourceDate: string | null;
  importedAt: string;
  distanceMeters: number | null;
  source: {
    sourceId: number;
    name: string;
    provider: string | null;
    url: string | null;
    format: string;
    crs: string | null;
    version: string | null;
  };
};

export type FacilityFeatureCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    id: number;
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: Facility;
  }[];
};

/** 코스 주변 조회 화면에서 사용하는 시설 응답 필드. 거리값은 반드시 존재한다. */
export type CourseRestroom = Pick<Facility, 'facilityId' | 'name' | 'longitude' | 'latitude' | 'sourceDate'> & {
  type: 'RESTROOM';
  distanceMeters: number;
};
