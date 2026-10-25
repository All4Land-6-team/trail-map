import type { CourseSpot } from '../types/courseDetail';
import type { CourseRestroom } from '../types/facility';

export function toCourseRestroomSpots(restrooms: readonly CourseRestroom[], courseId: string): CourseSpot[] {
  return restrooms.map(facility => ({
    id: `facility-${facility.facilityId}`, courseId, kind: 'restroom',
    name: facility.name?.trim() || `화장실 ${facility.facilityId}`,
    coordinate: [facility.longitude, facility.latitude], facilityId: facility.facilityId,
    distanceMeters: facility.distanceMeters, sourceDate: facility.sourceDate,
  }));
}

/** 조회 실패·빈 결과에서도 합성 화장실을 실제 결과로 대신 표시하지 않는다. */
export function withCourseRestrooms(spots: readonly CourseSpot[], restrooms: readonly CourseSpot[]): CourseSpot[] {
  return [...spots.filter(spot => spot.kind !== 'restroom'), ...restrooms];
}
