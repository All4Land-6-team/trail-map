import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateSunArcState, sunTimesForCoordinate } from "../src/utils/sunTimes.ts";

const sunrise = new Date("2026-11-11T07:00:00+09:00");
const sunset = new Date("2026-11-11T17:30:00+09:00");

test("태양은 초기 왼쪽 위치를 노출하지 않고 계산된 현재 위치에 나타난다", () => {
  const component = readFileSync(new URL("../src/components/hike/SunArc.tsx", import.meta.url), "utf8");

  assert.match(component, /useState<[^>]*\| null>\(null\)/);
  assert.match(component, /sunPoint && <g/);
  assert.doesNotMatch(component, /useState\(START_POINT\)/);
});

test("일출 전과 일몰 후에는 태양 위치를 궤적 양 끝으로 제한한다", () => {
  const before = calculateSunArcState(new Date("2026-11-11T06:30:00+09:00"), sunrise, sunset);
  const after = calculateSunArcState(new Date("2026-11-11T18:00:00+09:00"), sunrise, sunset);

  assert.equal(before.progress, 0);
  assert.equal(before.phase, "before-sunrise");
  assert.equal(before.message, "일출 전이에요");
  assert.equal(after.progress, 1);
  assert.equal(after.phase, "after-sunset");
  assert.equal(after.message, "일몰이 지났어요");
});

test("주간에는 일출부터 일몰까지의 시간 비율과 남은 시간을 계산한다", () => {
  const noon = calculateSunArcState(new Date("2026-11-11T12:15:00+09:00"), sunrise, sunset);
  assert.equal(noon.progress, 0.5);
  assert.equal(noon.phase, "daylight");
  assert.equal(noon.message, "일몰까지 5시간 15분");
});

test("일몰까지 60분 이하면 임박 상태로 구분한다", () => {
  const soon = calculateSunArcState(new Date("2026-11-11T16:45:00+09:00"), sunrise, sunset);
  assert.equal(soon.phase, "sunset-soon");
  assert.equal(soon.message, "일몰까지 45분");
});

test("유효하지 않은 좌표는 실제 일출·일몰 값처럼 계산하지 않는다", () => {
  assert.equal(sunTimesForCoordinate(new Date(), undefined), null);
  assert.equal(sunTimesForCoordinate(new Date(), [181, 37]), null);
  assert.equal(sunTimesForCoordinate(new Date(), [127, 91]), null);
});

test("유효한 좌표와 날짜는 일출보다 늦은 일몰을 반환한다", () => {
  const times = sunTimesForCoordinate(new Date("2026-11-11T12:00:00+09:00"), [126.98, 37.66]);
  assert.ok(times);
  assert.ok(Number.isFinite(times.sunrise.getTime()));
  assert.ok(times.sunset > times.sunrise);
});
