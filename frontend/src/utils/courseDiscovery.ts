import type { Course, CourseDifficulty, CourseFilters, CourseSort, DetailedCourseFilters } from "../types/course";

export const DEFAULT_COURSE_FILTERS: CourseFilters = {
  difficulty: "all", duration: "all", minDistanceKm: 0, maxDistanceKm: 10, steepRatio: "all",
};
export const COURSE_DIFFICULTY_LABELS: Record<CourseDifficulty, string> = {
  beginner: "초급", intermediate: "중급", advanced: "고수",
};
export const COURSE_DURATION_LABELS: Record<CourseFilters["duration"], string> = {
  all: "전체", under2: "2시간 이내", "2to4": "2~4시간",
};
const difficultyOrder: Record<CourseDifficulty, number> = { beginner: 0, intermediate: 1, advanced: 2 };
const courseNameOrder = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });

export function hasDetailedCourseFilters(filters: DetailedCourseFilters): boolean {
  return filters.duration !== "all" || filters.minDistanceKm !== 0 || filters.maxDistanceKm !== 10 || filters.steepRatio !== "all";
}

export function hasCourseFilters(filters: CourseFilters): boolean {
  return filters.difficulty !== "all" || hasDetailedCourseFilters(filters);
}

export function selectCourses(courses: readonly Course[], filters: CourseFilters, sort: CourseSort): Course[] {
  return courses.filter(course => {
    if (filters.difficulty !== "all" && course.difficulty !== filters.difficulty) return false;
    if (filters.duration === "under2" && course.durationMinutes > 120) return false;
    if (filters.duration === "2to4" && (course.durationMinutes < 120 || course.durationMinutes > 240)) return false;
    // 0~10km는 거리 조건이 없는 초기 상태이므로 10km 초과 코스도 숨기지 않는다.
    if ((filters.minDistanceKm !== 0 || filters.maxDistanceKm !== 10)
      && (course.distanceKm < filters.minDistanceKm || course.distanceKm > filters.maxDistanceKm)) return false;
    if (filters.steepRatio !== "all" && (course.steepRatioPercent == null || course.steepRatioPercent > Number(filters.steepRatio))) return false;
    return true;
  }).sort((a, b) => {
    const byDifficulty = sort === "difficulty"
      ? (a.difficulty == null ? 3 : difficultyOrder[a.difficulty]) - (b.difficulty == null ? 3 : difficultyOrder[b.difficulty])
      : 0;
    return byDifficulty || courseNameOrder.compare(a.name, b.name) || a.id.localeCompare(b.id);
  });
}

/** 슬라이더 두 손잡이 사이의 최소 간격 0.5km와 0~10km 범위를 유지한다. */
export function changeCourseDistance(filters: DetailedCourseFilters, handle: "min" | "max", value: number): DetailedCourseFilters {
  if (!Number.isFinite(value)) return filters;
  const stepped = Math.max(0, Math.min(10, Math.round(value * 2) / 2));
  return handle === "min"
    ? { ...filters, minDistanceKm: Math.min(stepped, filters.maxDistanceKm - 0.5) }
    : { ...filters, maxDistanceKm: Math.max(stepped, filters.minDistanceKm + 0.5) };
}

export function formatCourseDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}시간${remainder ? ` ${remainder}분` : ""}` : `${remainder}분`;
}

export function getCourseFilterChips(filters: CourseFilters) {
  const chips: { key: "duration" | "distance" | "steepRatio"; label: string }[] = [];
  if (filters.duration !== "all") chips.push({ key: "duration", label: COURSE_DURATION_LABELS[filters.duration] });
  if (filters.minDistanceKm !== 0 || filters.maxDistanceKm !== 10) chips.push({
    key: "distance", label: `${filters.minDistanceKm}~${filters.maxDistanceKm} km`,
  });
  if (filters.steepRatio !== "all") chips.push({ key: "steepRatio", label: `급경사 ${filters.steepRatio}% 이하` });
  return chips;
}

export function removeCourseFilter(filters: CourseFilters, key: "duration" | "distance" | "steepRatio"): CourseFilters {
  if (key === "distance") return { ...filters, minDistanceKm: 0, maxDistanceKm: 10 };
  return { ...filters, [key]: "all" };
}
