import type { SpotKind } from "../components/map";

export type LngLat = [number, number];

export type HikeSpot = {
  id: string;
  kind: SpotKind;
  name: string;
  position: LngLat;
};

/** 일정에 연결되는 코스 정보 (HIKE-02·03 표시용) */
export type HikeCourse = {
  id: string;
  mountainName: string;
  courseName: string;
  distanceKm: number;
  durationMinutes: number;
  maxAltitudeM: number | null;
  averageSlopePercent: number | null;
  sunset: string;
  /** 출발지에서 정상까지 순서대로 찍은 좌표 */
  route: LngLat[];
  spots: HikeSpot[];
};

/** hike_schedule 한 건. 같은 날짜에는 일정 1개만 둔다. */
export type HikeSchedule = {
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  startTime: string;
  courseId: string;
  mountainName: string;
  courseName: string;
  distanceKm: number;
};

/** 등산 중·하산 중 화면에 필요한 코스·진행 정보 */
export type ActiveHike = {
  mountainName: string;
  courseName: string;
  /** 진행 방향 순서의 좌표. 하산 중에는 정상에서 출발지 방향이다. */
  route: LngLat[];
  /** route에서 현재 위치에 해당하는 좌표 순번 */
  currentIndex: number;
  peak: LngLat;
  traveledKm: number;
  remainingKm: number;
  sunset: string;
  spots: HikeSpot[];
  /** 가까운 시설 안내 (예시 기준 500m 이내일 때만) */
  nearby?: { title: string; detail: string };
};

/** hike_record 종료 결과 */
export type HikeResult = {
  mountainId: string;
  mountainName: string;
  courseName: string;
  distanceKm: number;
  durationMinutes: number;
  sunset: string;
  finishedBeforeSunset: boolean;
};
