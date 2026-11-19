import { test } from "node:test";
import assert from "node:assert/strict";

// 브라우저 localStorage 대신 쓰는 메모리 저장소
const memory = new Map();
globalThis.window = { localStorage: {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
} };

const { clearHikeSnapshot, loadHikeSnapshot, loadHikeSpots, saveHikeSnapshot, saveHikeSpots } = await import("../src/store/hikeSessionSnapshot.ts");
const { nearbyFacility, NEARBY_FACILITY_METERS } = await import("../src/utils/nearbyFacility.ts");

const schedule = { scheduleId: 7, date: "2026-11-19", startTime: "08:00", courseId: "db-1", serverCourseId: 1,
  serverMountainId: 1, mountainName: "북한산", courseName: "북한산성코스", distanceKm: 3.4 };
const session = { schedule, phase: "active", alertsOn: false, startedAt: "2026-11-19T08:00:00Z", hikeRecordId: 11,
  traveledPath: [[126.95, 37.65], [126.951, 37.651]], coursePath: [[126.95, 37.65], [126.96, 37.66]],
  courseProgress: { alongMeters: 10, remainingMeters: 100, totalMeters: 110, offCourseMeters: 0 } };

test("진행 중 등산을 저장하고 다시 읽는다 (진행 정보는 다시 계산하도록 빼고 저장)", () => {
  memory.clear();
  saveHikeSnapshot(session);
  const saved = loadHikeSnapshot();
  assert.equal(saved.hikeRecordId, 11);
  assert.deepEqual(saved.traveledPath, session.traveledPath);
  assert.equal(saved.courseProgress, undefined);
  assert.equal(saved.schedule.courseName, "북한산성코스");
});

test("종료한 등산·예시 데이터 등산은 저장본을 남기지 않는다", () => {
  memory.clear();
  saveHikeSnapshot(session);
  saveHikeSnapshot({ ...session, phase: "complete" });
  assert.equal(loadHikeSnapshot(), null);
  saveHikeSnapshot({ ...session, hikeRecordId: undefined });
  assert.equal(loadHikeSnapshot(), null);
});

test("저장본과 코스 시설은 기록 번호로 지운다", () => {
  memory.clear();
  saveHikeSnapshot(session);
  saveHikeSpots(11, [{ id: "restroom-1", kind: "restroom", name: "화장실", position: [126.95, 37.65] }]);
  assert.equal(loadHikeSpots(11).length, 1);
  clearHikeSnapshot(12);
  assert.notEqual(loadHikeSnapshot(), null);
  clearHikeSnapshot(11);
  assert.equal(loadHikeSnapshot(), null);
  assert.deepEqual(loadHikeSpots(11), []);
});

test("깨진 저장본은 무시한다", () => {
  memory.clear();
  memory.set("trail-map.hike-session", "{not json");
  assert.equal(loadHikeSnapshot(), null);
  memory.set("trail-map.hike-session", JSON.stringify({ ...session, phase: "complete" }));
  assert.equal(loadHikeSnapshot(), null);
});

test("100m 안의 가장 가까운 시설을 알리고, 닫은 시설은 다시 알리지 않는다", () => {
  const here = [127.0, 37.0];
  // 위도 0.0005° ≈ 55m, 0.0003° ≈ 33m, 0.002° ≈ 222m
  const spots = [
    { id: "shelter-1", kind: "shelter", name: "쉼터 1", position: [127.0, 37.0005] },
    { id: "water-1", kind: "water", name: "약수터", position: [127.0, 37.0003] },
    { id: "restroom-1", kind: "restroom", name: "화장실", position: [127.0, 37.002] },
  ];
  const first = nearbyFacility(here, spots, new Set());
  assert.equal(first.id, "water-1");
  assert.equal(first.title, "음수대가 가까워요");
  assert.equal(first.detail, "약수터 · 약 30m");
  assert.equal(nearbyFacility(here, spots, new Set(["water-1"])).id, "shelter-1");
  assert.equal(nearbyFacility(here, spots, new Set(["water-1", "shelter-1"])), null);
  assert.equal(nearbyFacility(undefined, spots, new Set()), null);
  assert.equal(NEARBY_FACILITY_METERS, 100);
});
