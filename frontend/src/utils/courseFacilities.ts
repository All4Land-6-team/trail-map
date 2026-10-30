import type { CourseSpot } from '../types/courseDetail';
import type { CourseFacility, CourseFacilityType } from '../types/facility';

/** 시설 유형을 SpotMarker·아이콘이 쓰는 스팟 종류로 바꾼다. */
export function facilitySpotKind(type: CourseFacilityType) {
  return { RESTROOM: 'restroom', DRINKING_WATER: 'water', SHELTER: 'shelter' }[type] as 'restroom' | 'water' | 'shelter';
}

export function toCourseFacilitySpots(facilities: readonly CourseFacility[], courseId: string): CourseSpot[] {
  return facilities.map(facility => ({
    id: `facility-${facility.facilityId}`, courseId, kind: facilitySpotKind(facility.type),
    name: facility.name?.trim() || `${facility.type === 'DRINKING_WATER' ? '음수대' : facility.type === 'SHELTER' ? '쉼터' : '화장실'} ${facility.facilityId}`,
    coordinate: [facility.longitude, facility.latitude], facilityId: facility.facilityId,
    distanceMeters: facility.distanceMeters, sourceDate: facility.sourceDate,
  }));
}

/** 조회 실패·빈 결과에서도 합성 화장실·음수대·쉼터를 실제 결과로 대신 표시하지 않는다. */
export function withCourseFacilities(spots: readonly CourseSpot[], facilities: readonly CourseSpot[]): CourseSpot[] {
  return [...spots.filter(spot => spot.kind !== 'restroom' && spot.kind !== 'water' && spot.kind !== 'shelter'), ...facilities];
}
