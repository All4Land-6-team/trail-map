import test from "node:test";
import assert from "node:assert/strict";
import { HIKE_RECORD_ERROR, hikeStartErrorMessage, startOrResumeHikeRecord } from "../src/api/hikeRecordApi.ts";
import { flushHikePositions } from "../src/hooks/useHikeTracking.ts";
import {
  finishHikeSession, getCompletedHikes, getHikeSession, recordHikePosition, restoreHikeSession, setHikeTraveledMeters,
  startHikeDescent, startHikeSession,
} from "../src/store/hikeSessionStore.ts";

// 서버 응답을 차례대로 돌려주는 가짜 fetch. 받은 요청은 requests에 남긴다.
let responses = [];
let requests = [];
globalThis.fetch = async (url, init = {}) => {
  requests.push({ url: String(url), method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : undefined });
  const next = responses.shift();
  if (!next) throw new Error("예상하지 못한 요청");
  if (next === "network") throw new TypeError("Failed to fetch");
  return new Response(JSON.stringify(next.body), { status: next.status });
};
const ok = data => ({ status: 200, body: { success: true, code: "SUCCESS_200", message: "", data } });
const fail = (status, code) => ({ status, body: { success: false, code, message: "서버 오류" } });
function reset(...next) {
  responses = next;
  requests = [];
}

const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  },
};
const queued = hikeRecordId => JSON.parse(storage.get(`trail-map.hike-positions.${hikeRecordId}`) ?? "[]");
const positions = count => Array.from({ length: count }, (_, index) => ({
  longitude: 126.95 + index * 0.0001, latitude: 37.63, recordedAt: new Date(1_000 * index).toISOString(), accuracyMeters: 5,
}));

const schedule = { scheduleId: 6, date: "2026-10-29", startTime: "11:40", courseId: "daenammun",
  mountainName: "북한산", courseName: "대남문 코스", distanceKm: 5.6 };
const record = (overrides = {}) => ({
  hikeRecordId: 10, scheduleId: 6, courseId: 2, courseName: "대남문 코스", mountainId: 1, mountainName: "북한산",
  status: "IN_PROGRESS", startedAt: "2026-10-29T02:40:00Z", endedAt: null,
  traveledDistanceMeters: null, actualDurationSeconds: null, traveledPath: null,
  courseDistanceMeters: 2_224, coursePath: [[126.95, 37.63], [126.95, 37.65]], ...overrides,
});

test("등산 시작 응답의 빈 이동 경로는 빈 배열로 바꾼다", async () => {
  reset(ok(record()));
  const started = await startOrResumeHikeRecord(6);
  assert.deepEqual(started.traveledPath, []);
  assert.deepEqual(requests[0], { url: "http://localhost:8080/api/v1/hike-records", method: "POST", body: { scheduleId: 6 } });
});

test("같은 일정의 기록이 이미 진행 중이면 그 기록을 이어 간다", async () => {
  reset(fail(409, HIKE_RECORD_ERROR.activeRecordExists), ok(record({ hikeRecordId: 11, traveledPath: [[126.95, 37.63], [126.96, 37.64]] })));
  const resumed = await startOrResumeHikeRecord(6);
  assert.equal(resumed.hikeRecordId, 11);
  assert.deepEqual(resumed.traveledPath, [[126.95, 37.63], [126.96, 37.64]]);
  assert.equal(requests[1].url, "http://localhost:8080/api/v1/hike-records/active");
});

test("다른 일정의 등산이 진행 중이면 시작하지 않고 안내한다", async () => {
  reset(fail(409, HIKE_RECORD_ERROR.activeRecordExists), ok(record({ scheduleId: 99 })));
  const error = await startOrResumeHikeRecord(6).catch(caught => caught);
  assert.equal(hikeStartErrorMessage(error), "진행 중인 다른 등산이 있어요.");
});

test("시작 실패 이유별로 안내 문구를 고른다", async () => {
  reset(fail(409, HIKE_RECORD_ERROR.scheduleNotToday));
  assert.equal(hikeStartErrorMessage(await startOrResumeHikeRecord(6).catch(caught => caught)), "오늘 일정만 등산을 시작할 수 있어요.");
  reset(fail(409, HIKE_RECORD_ERROR.recordAlreadyExists), ok(null));
  assert.equal(hikeStartErrorMessage(await startOrResumeHikeRecord(6).catch(caught => caught)), "이미 등산을 마친 일정이에요.");
  reset("network");
  assert.equal(hikeStartErrorMessage(await startOrResumeHikeRecord(6).catch(caught => caught)),
    "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
});

test("기록으로 시작한 등산은 서버 기록 번호와 경로로 상태를 만든다", () => {
  startHikeSession(schedule, "bukhansan", true, { ...record(), traveledPath: [[126.95, 37.63]] });
  const session = getHikeSession();
  assert.equal(session.hikeRecordId, 10);
  assert.equal(session.phase, "active");
  assert.equal(session.startedAt, "2026-10-29T02:40:00Z");
  assert.deepEqual(session.currentPosition, [126.95, 37.63]);
});

test("받은 위치는 현재 위치로 옮기고, 경로에 넣을 위치만 경로에 더한다", () => {
  recordHikePosition([126.951, 37.631], false);
  assert.deepEqual(getHikeSession().currentPosition, [126.951, 37.631]);
  assert.equal(getHikeSession().traveledPath.length, 1);
  recordHikePosition([126.952, 37.632], true);
  assert.equal(getHikeSession().traveledPath.length, 2);
});

test("이동 거리는 진행 중인 기록의 응답만 반영한다", () => {
  setHikeTraveledMeters(999, 500);
  assert.equal(getHikeSession().traveledMeters, undefined);
  setHikeTraveledMeters(10, 320.5);
  assert.equal(getHikeSession().traveledMeters, 320.5);
});

test("기록으로 종료하면 서버가 계산한 이동 거리·소요 시간을 남긴다", () => {
  finishHikeSession(record({ status: "COMPLETED", endedAt: "2026-10-29T05:10:00Z",
    traveledDistanceMeters: 4_250, actualDurationSeconds: 9_000, traveledPath: [[126.95, 37.63], [126.97, 37.65]] }));
  const session = getHikeSession();
  assert.equal(session.phase, "complete");
  assert.equal(session.finishedAt, "2026-10-29T05:10:00Z");
  assert.equal(session.traveledMeters, 4_250);
  assert.equal(session.durationSeconds, 9_000);
  assert.deepEqual(getCompletedHikes()[0], { id: "10", mountainId: "bukhansan", courseId: "daenammun",
    courseName: "대남문 코스", distanceKm: 4.25, finishedAt: "2026-10-29T05:10:00Z" });
});

test("위치 전송에 실패하면 보관한 위치를 남기고, 다음 전송에서 보낸 뒤 비운다", async () => {
  startHikeSession(schedule, "bukhansan", true, record({ hikeRecordId: 20, traveledPath: [] }));
  storage.set("trail-map.hike-positions.20", JSON.stringify(positions(3)));
  reset("network");
  await assert.rejects(flushHikePositions(20));
  assert.equal(queued(20).length, 3);

  reset(ok({ hikeRecordId: 20, acceptedCount: 3, traveledDistanceMeters: 17.6 }));
  await flushHikePositions(20);
  assert.equal(requests[0].url, "http://localhost:8080/api/v1/hike-records/20/positions");
  assert.equal(requests[0].body.positions.length, 3);
  assert.equal(queued(20).length, 0);
  assert.equal(getHikeSession().traveledMeters, 17.6);
});

test("한 번에 500개까지만 보내고 나머지는 이어서 보낸다", async () => {
  storage.set("trail-map.hike-positions.21", JSON.stringify(positions(501)));
  reset(ok({ hikeRecordId: 21, acceptedCount: 500, traveledDistanceMeters: 100 }),
    ok({ hikeRecordId: 21, acceptedCount: 1, traveledDistanceMeters: 101 }));
  await flushHikePositions(21);
  assert.deepEqual(requests.map(request => request.body.positions.length), [500, 1]);
  assert.equal(queued(21).length, 0);
});

test("이미 종료된 기록의 위치는 다시 보내지 않고 버린다", async () => {
  storage.set("trail-map.hike-positions.22", JSON.stringify(positions(2)));
  reset(fail(409, HIKE_RECORD_ERROR.recordAlreadyCompleted));
  await flushHikePositions(22);
  assert.equal(requests.length, 1);
  assert.equal(queued(22).length, 0);
});

test("서버 오류(500)면 위치를 버리지 않는다", async () => {
  storage.set("trail-map.hike-positions.23", JSON.stringify(positions(2)));
  reset(fail(500, "COMMON_500"));
  await assert.rejects(flushHikePositions(23));
  assert.equal(queued(23).length, 2);
});

test("등산 기록 응답의 코스 경로와 길이를 받는다", async () => {
  reset(ok(record()));
  const started = await startOrResumeHikeRecord(6);
  assert.deepEqual(started.coursePath, [[126.95, 37.63], [126.95, 37.65]]);
  assert.equal(started.courseDistanceMeters, 2_224);
  reset(ok(record({ coursePath: null, courseDistanceMeters: null })));
  assert.deepEqual((await startOrResumeHikeRecord(6)).coursePath, []);
});

test("위치를 받으면 코스상 남은 거리를 다시 계산하고, 하산 중에는 시작점까지 남은 거리를 계산한다", () => {
  finishHikeSession();
  startHikeSession(schedule, "bukhansan", true, record({ hikeRecordId: 30, traveledPath: [] }));
  assert.equal(getHikeSession().courseProgress, undefined);

  // 코스 시작점에서 북쪽으로 약 1.11km
  recordHikePosition([126.95, 37.64], true);
  const ascent = getHikeSession().courseProgress;
  assert.ok(Math.abs(ascent.alongMeters - 1_112) < 2);
  assert.ok(Math.abs(ascent.remainingMeters - 1_112) < 2);

  // 정상 근처에서 하산 시작: 진행 방향이 반대라 남은 거리는 시작점까지다.
  recordHikePosition([126.95, 37.649], true);
  startHikeDescent();
  assert.ok(Math.abs(getHikeSession().courseProgress.remainingMeters - 2_113) < 3);
});

test("새로고침 후 이어 간 등산은 마지막 위치로 남은 거리를 계산한다", () => {
  finishHikeSession();
  restoreHikeSession({ schedule, mountainId: "bukhansan", alertsOn: true, phase: "active", startedAt: "2026-10-29T02:40:00Z",
    hikeRecordId: 31, traveledPath: [[126.95, 37.635]], currentPosition: [126.95, 37.635],
    coursePath: [[126.95, 37.63], [126.95, 37.65]], courseDistanceMeters: 2_224 });
  assert.ok(Math.abs(getHikeSession().courseProgress.remainingMeters - 1_668) < 3);
});

test("하산을 시작하면 그 지점부터 하산 경로를 새로 그리고, 순번을 기록별로 보관한다", () => {
  finishHikeSession();
  startHikeSession(schedule, "bukhansan", true, record({ hikeRecordId: 40, traveledPath: [] }));
  recordHikePosition([126.95, 37.635], true);
  recordHikePosition([126.95, 37.649], true);
  startHikeDescent();
  assert.equal(getHikeSession().descentPathStart, 1);
  assert.equal(storage.get("trail-map.hike-descent-start.40"), "1");

  finishHikeSession();
  assert.equal(storage.has("trail-map.hike-descent-start.40"), false);
});

test("새로고침 후 하산 중이면 보관한 순번을 쓰고, 없으면 정상에 가장 가까운 지점부터 그린다", () => {
  const restored = (hikeRecordId, traveledPath) => ({ schedule, mountainId: "bukhansan", alertsOn: true, phase: "downhill",
    startedAt: "2026-10-29T02:40:00Z", hikeRecordId, traveledPath, currentPosition: traveledPath.at(-1),
    coursePath: [[126.95, 37.63], [126.95, 37.65]], courseDistanceMeters: 2_224 });
  const path = [[126.95, 37.63], [126.95, 37.64], [126.95, 37.6495], [126.95, 37.645]];

  finishHikeSession();
  storage.set("trail-map.hike-descent-start.41", "1");
  restoreHikeSession(restored(41, path));
  assert.equal(getHikeSession().descentPathStart, 1);

  finishHikeSession();
  restoreHikeSession(restored(42, path));
  assert.equal(getHikeSession().descentPathStart, 2);
});
