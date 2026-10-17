import type { CartCourse } from "./types";

export const BUKHANSAN_CENTER: [longitude: number, latitude: number] = [126.977, 37.659];

export const savedCourses: readonly CartCourse[] = [
  {
    id: "daenammun",
    name: "대남문 코스",
    shortName: "대남문",
    mountain: "북한산",
    distanceKm: 5.6,
    durationMinutes: 160,
    averageSlopePercent: 8,
    color: "#1b6a53",
    routeCoordinates: [
      [126.955, 37.636], [126.963, 37.644], [126.972, 37.651],
      [126.982, 37.66], [126.989, 37.67], [126.993, 37.681],
    ],
    elevationProfile: [
      { distanceKm: 0, elevationMeters: 105 },
      { distanceKm: 1, elevationMeters: 195 },
      { distanceKm: 2, elevationMeters: 305 },
      { distanceKm: 3, elevationMeters: 420 },
      { distanceKm: 4, elevationMeters: 570 },
      { distanceKm: 4.8, elevationMeters: 735 },
      { distanceKm: 5.6, elevationMeters: 520 },
    ],
  },
  {
    id: "bibong",
    name: "비봉 코스",
    shortName: "비봉",
    mountain: "북한산",
    distanceKm: 3.8,
    durationMinutes: 120,
    averageSlopePercent: 10,
    color: "#5b8bd6",
    routeCoordinates: [
      [126.948, 37.641], [126.956, 37.648], [126.966, 37.655],
      [126.977, 37.663], [126.986, 37.674], [126.992, 37.682],
    ],
    elevationProfile: [
      { distanceKm: 0, elevationMeters: 110 },
      { distanceKm: 0.8, elevationMeters: 245 },
      { distanceKm: 1.6, elevationMeters: 395 },
      { distanceKm: 2.4, elevationMeters: 545 },
      { distanceKm: 3.2, elevationMeters: 655 },
      { distanceKm: 3.8, elevationMeters: 575 },
    ],
  },
  {
    id: "sumunbyeok",
    name: "숨은벽 코스",
    shortName: "숨은벽",
    mountain: "북한산",
    distanceKm: 6.1,
    durationMinutes: 200,
    color: "#d9964a",
    routeCoordinates: [
      [126.962, 37.633], [126.971, 37.642], [126.981, 37.65],
      [126.99, 37.659], [126.997, 37.67], [127.001, 37.681],
    ],
    elevationProfile: [],
  },
] as const;

export function formatCourseDuration(durationMinutes: number) {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}
