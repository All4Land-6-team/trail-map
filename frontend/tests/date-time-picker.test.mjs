import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCalendarDays,
  formatDateDisplay,
  formatTimeDisplay,
  formatTimeValue,
  getNextAvailableTime,
  isTimeAtOrAfter,
  toLocalDateKey,
} from "../src/components/common/DateTimePicker/dateTime.ts";

test("달력은 일요일부터 시작하는 6주 그리드와 월 경계 날짜를 만든다", () => {
  const days = buildCalendarDays(2026, 9, { minDate: "2026-10-16", today: "2026-10-16" });

  assert.equal(days.length, 42);
  assert.equal(days[0].dateKey, "2026-09-27");
  assert.equal(days[4].dateKey, "2026-10-01");
  assert.equal(days.at(-1).dateKey, "2026-11-07");
  assert.equal(days.find((day) => day.dateKey === "2026-10-15")?.disabled, true);
  assert.equal(days.find((day) => day.dateKey === "2026-10-16")?.isToday, true);
});

test("윤년 2월 날짜와 로컬 날짜 키를 UTC 변환 없이 처리한다", () => {
  const days = buildCalendarDays(2028, 1);

  assert.equal(days.some((day) => day.dateKey === "2028-02-29"), true);
  assert.equal(toLocalDateKey(new Date(2026, 9, 16, 23, 30)), "2026-10-16");
  assert.equal(toLocalDateKey("2026-10-16T23:30:00+09:00"), "2026-10-16");
  assert.equal(formatDateDisplay("2026-10-16"), "2026. 10. 16.");
});

test("시간은 화면에는 오전과 오후로, 내부에는 24시간제로 유지한다", () => {
  assert.equal(formatTimeDisplay("09:00"), "오전 09:00");
  assert.equal(formatTimeDisplay("13:20"), "오후 01:20");
  assert.equal(formatTimeDisplay("00:10"), "오전 12:10");
  assert.equal(formatTimeValue(13, 20), "13:20");
});

test("현재 이후의 다음 10분 단위 시간과 선택 가능 여부를 계산한다", () => {
  assert.equal(getNextAvailableTime("09:03", 10), "09:10");
  assert.equal(getNextAvailableTime("09:00", 10), "09:10");
  assert.equal(getNextAvailableTime("23:51", 10), null);
  assert.equal(isTimeAtOrAfter("09:00", "09:10"), false);
  assert.equal(isTimeAtOrAfter("09:10", "09:10"), true);
});
