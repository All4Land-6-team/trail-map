const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

/** 9월 23일 수요일 */
export function formatDateTitle(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdays[date.getDay()]}요일`;
}

/** YYYY-MM-DD 문자열을 현지 시각 자정의 Date로 바꾼다. */
export function parseDateKey(value: string) {
  return new Date(`${value}T00:00:00`);
}

/** 130 → 2시간 10분 */
export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}분`;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

/** 07:30 → 오전 7:30 */
export function formatKoreanTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours < 12 ? "오전" : "오후";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${period} ${hour12}:${String(minutes).padStart(2, "0")}`;
}
