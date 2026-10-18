import type { ActiveHike, HikeCourse, HikeResult, HikeSchedule, LngLat } from "../types/hike";

// 백엔드 일정·기록 API가 준비되기 전 화면 확인용 임시 데이터.
// API가 생기면 같은 타입을 반환하는 요청 함수로 교체한다.

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysFromToday(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}

// 좌표는 북한산 백운대 코스를 따라 대략 찍은 예시 값이다.
const baegundaeRoute: LngLat[] = [
  [126.9905, 37.662], [126.9885, 37.6618], [126.9866, 37.6612], [126.9852, 37.6608],
  [126.9836, 37.6603], [126.9818, 37.66], [126.9803, 37.6596], [126.979, 37.6592], [126.9776, 37.6588],
];

// 도봉산 코스 수치와 좌표는 화면 확인용 예시 값이다.
const sinseondaeRoute: LngLat[] = [
  [127.0465, 37.6895], [127.0432, 37.6907], [127.0398, 37.6921], [127.0369, 37.6936],
  [127.0341, 37.6949], [127.0318, 37.6963], [127.0296, 37.6978],
];

export const sampleCourses: HikeCourse[] = [
  {
    id: "bukhansan-baegundae", mountainName: "북한산", courseName: "백운대 코스",
    distanceKm: 4.2, durationMinutes: 130, maxAltitudeM: 836, averageSlopePercent: 12, sunset: "18:30",
    route: baegundaeRoute,
    spots: [
      { id: "restroom-1", kind: "restroom", name: "화장실 1", position: [126.9893, 37.6614] },
      { id: "shelter-1", kind: "shelter", name: "쉼터 1", position: [126.9858, 37.6602] },
      { id: "water-1", kind: "water", name: "음수대 1", position: [126.9838, 37.6609] },
      { id: "photo-1", kind: "photo", name: "사진 스팟 1", position: [126.9826, 37.6607] },
      { id: "shelter-2", kind: "shelter", name: "쉼터 2", position: [126.981, 37.6604] },
      { id: "photo-2", kind: "photo", name: "사진 스팟 2", position: [126.9794, 37.6598] },
    ],
  },
  {
    id: "dobongsan-sinseondae", mountainName: "도봉산", courseName: "신선대 코스",
    distanceKm: 5.1, durationMinutes: 160, maxAltitudeM: 726, averageSlopePercent: 10, sunset: "18:30",
    route: sinseondaeRoute,
    spots: [
      { id: "dobong-shelter-1", kind: "shelter", name: "쉼터 1", position: [127.0405, 37.6912] },
      { id: "dobong-water-1", kind: "water", name: "음수대 1", position: [127.0355, 37.6948] },
    ],
  },
];

export function findCourse(courseId: string) {
  return sampleCourses.find(course => course.id === courseId);
}

export function scheduleFor(course: HikeCourse, date: string, startTime: string): HikeSchedule {
  return {
    date, startTime, courseId: course.id,
    mountainName: course.mountainName, courseName: course.courseName, distanceKm: course.distanceKm,
  };
}

// 언제 열어도 일정이 보이도록 오늘 기준 날짜를 쓴다.
export const sampleSchedules: HikeSchedule[] = [
  scheduleFor(sampleCourses[0], daysFromToday(0), "07:30"),
  scheduleFor(sampleCourses[1], daysFromToday(4), "08:00"),
];

const baegundae = sampleCourses[0];

export const sampleActiveHike: ActiveHike = {
  mountainName: baegundae.mountainName,
  courseName: baegundae.courseName,
  route: baegundae.route,
  currentIndex: 4,
  peak: baegundae.route[baegundae.route.length - 1],
  traveledKm: 2,
  remainingKm: 2.2,
  sunset: baegundae.sunset,
  spots: baegundae.spots,
  nearby: { title: "쉼터가 가까워요", detail: "쉼터 2 · 약 350m 앞" },
};

/** 정상에서 출발지로 내려가는 중 (HIKE-07) */
export const sampleDescentHike: ActiveHike = {
  ...sampleActiveHike,
  route: [...baegundae.route].reverse(),
  currentIndex: 5,
  traveledKm: 2.6,
  remainingKm: 1.6,
  nearby: undefined,
};

export const sampleHikeResult: HikeResult = {
  mountainId: "bukhansan",
  mountainName: "북한산",
  courseName: "백운대 코스",
  distanceKm: 4.2,
  durationMinutes: 130,
  sunset: "18:30",
  finishedBeforeSunset: true,
};
