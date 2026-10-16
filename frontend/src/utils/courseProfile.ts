import type { CourseProfileSample, CourseSpot, ProfileVisibility, SpotCategory } from "../types/courseDetail";

export const SPOT_CATEGORIES: readonly { value: SpotCategory; label: string }[] = [
  { value: "all", label: "전체" }, { value: "shelter", label: "쉼터" },
  { value: "water", label: "음수대" }, { value: "restroom", label: "화장실" },
  { value: "photo", label: "사진 스팟" }, { value: "control", label: "통제정보" },
];
export function spotCategoryLabel(category: SpotCategory) {
  return SPOT_CATEGORIES.find(item => item.value === category)?.label ?? "전체";
}
export function selectCourseSpots(spots: readonly CourseSpot[], category: SpotCategory) {
  return spots.filter(spot => category === "all" || spot.kind === category);
}

/** 누적 선분 길이의 비율로 보간한다. 그래프와 지도는 반환된 동일 좌표를 참조한다. */
export function coordinateAlongRoute(route: readonly [number, number][], ratio: number): [number, number] | null {
  if (!route.length) return null;
  if (route.length === 1) return [...route[0]];
  const lengths = route.slice(1).map((point, index) => {
    const previous = route[index];
    const scale = Math.cos((point[1] + previous[1]) * Math.PI / 360);
    return Math.hypot((point[0] - previous[0]) * scale, point[1] - previous[1]);
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!total) return [...route[0]];
  const target = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0)) * total;
  let travelled = 0;
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index];
    if (length && travelled + length >= target) {
      const fraction = (target - travelled) / length;
      return [route[index][0] + (route[index + 1][0] - route[index][0]) * fraction,
        route[index][1] + (route[index + 1][1] - route[index][1]) * fraction];
    }
    travelled += length;
  }
  return [...route[route.length - 1]];
}

export function nearestProfileIndex(samples: readonly Pick<CourseProfileSample, "distanceKm">[], distanceKm: number) {
  if (!samples.length) return -1;
  if (!Number.isFinite(distanceKm)) return 0;
  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (samples[middle].distanceKm < distanceKm) low = middle + 1;
    else high = middle;
  }
  return low > 0 && distanceKm - samples[low - 1].distanceKm <= samples[low].distanceKm - distanceKm ? low - 1 : low;
}

/** V4 정책: 최소 한 가지 프로필을 유지한다. 마지막 항목 해제 시 같은 객체 반환. */
export function toggleProfileMetric(current: ProfileVisibility, key: keyof ProfileVisibility): ProfileVisibility {
  if (current[key] && !(key === "elevation" ? current.slope : current.elevation)) return current;
  return { ...current, [key]: !current[key] };
}
