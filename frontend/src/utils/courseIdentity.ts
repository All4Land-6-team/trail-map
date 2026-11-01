/** 실제 경로 화면 ID만 DB 식별자로 해석한다. 개발용 별칭은 변환하지 않는다. */
export function databaseCourseId(value: string): number | null {
  if (!/^db-[1-9]\d*$/.test(value)) return null;
  const result = Number(value.slice(3));
  return Number.isSafeInteger(result) && result > 0 ? result : null;
}
