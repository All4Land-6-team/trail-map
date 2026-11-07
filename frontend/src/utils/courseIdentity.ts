/** 실제 경로 화면 ID만 DB 식별자로 해석한다. 개발용 별칭은 변환하지 않는다. */
export function databaseCourseId(value: string): number | null {
  if (!/^db-[1-9]\d*$/.test(value)) return null;
  const result = Number(value.slice(3));
  return Number.isSafeInteger(result) && result > 0 ? result : null;
}

/** 실제 경로는 화면 ID와 서버 ID가 일치할 때 기존 일정 API에 연결한다. */
export function canScheduleCourse(course: { id: string; backendCourseId?: number; routeSource?: unknown }): boolean {
  const actualId = databaseCourseId(course.id);
  if (actualId !== null) return course.backendCourseId === actualId;
  return !course.id.startsWith("db-") && !course.routeSource;
}
