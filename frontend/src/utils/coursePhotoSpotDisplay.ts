import type { CourseFacilitiesState, CourseSpot } from '../types/courseDetail';

/** 예시 모드는 명시적으로 선택한다. 빈 결과·오류를 예시로 대체하지 않는다. */
export function coursePhotoSpotDisplay(state: CourseFacilitiesState, examples: readonly CourseSpot[], exampleMode: boolean): CourseFacilitiesState {
  return exampleMode ? { status: 'success', spots: examples.filter(spot => spot.kind === 'photo' && spot.example) } : state;
}
