import { after, test } from "node:test";
import { createServer } from "vite";
import assert from "node:assert/strict";

// 브라우저 localStorage·online 이벤트 대신 쓰는 메모리 저장소
const memory = new Map();
const onlineHandlers = [];
globalThis.localStorage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};
globalThis.window = { localStorage: globalThis.localStorage, addEventListener: (type, handler) => { if (type === "online") onlineHandlers.push(handler); } };

// 로그인 상태 (userId 5)
memory.set("trail-map.auth-session", JSON.stringify({ accessToken: "test", tokenType: "Bearer",
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: { userId: 5, nickname: "등산객", email: "a@example.com" } }));

const { clearScheduleCache, loadScheduleCache, saveScheduleCache } = await import("../src/store/scheduleCache.ts");

const serverSchedule = { scheduleId: 7, date: "2026-11-19", startTime: "08:00", courseId: "db-1", serverCourseId: 1,
  serverMountainId: 1, mountainName: "북한산", courseName: "북한산성코스", distanceKm: 3.4 };

test("일정 저장본은 저장한 사용자에게만 돌려준다", () => {
  memory.delete("trail-map.hike-schedules");
  saveScheduleCache(5, [serverSchedule], new Date("2026-11-19T07:05:00+09:00"));
  assert.equal(loadScheduleCache(5).schedules[0].courseName, "북한산성코스");
  assert.equal(loadScheduleCache(5).savedAt, "2026-11-18T22:05:00.000Z");
  assert.equal(loadScheduleCache(6), null);
  assert.equal(loadScheduleCache(undefined), null);
  clearScheduleCache();
  assert.equal(loadScheduleCache(5), null);
});

test("로그인하지 않았으면 저장하지 않는다", () => {
  memory.delete("trail-map.hike-schedules");
  saveScheduleCache(undefined, [serverSchedule]);
  assert.equal(memory.has("trail-map.hike-schedules"), false);
});

test("통신이 끊긴 채 켜면 예시 일정이 아니라 받아 둔 일정을 보여 주고, 저장은 막고, 다시 연결되면 서버 일정으로 돌아간다", async () => {
  memory.delete("trail-map.hike-schedules");
  saveScheduleCache(5, [serverSchedule], new Date("2026-11-19T07:05:00+09:00"));
  let online = false;
  globalThis.fetch = async () => {
    if (!online) throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify({ success: true, code: "OK", message: "", data: [] }), { status: 200 });
  };
  const server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false }, appType: "custom", logLevel: "silent" });
  after(() => server.close());
  const store = await server.ssrLoadModule("/src/store/hikeScheduleStore.ts");
  const cache = await server.ssrLoadModule("/src/store/scheduleCache.ts");
  assert.equal(await store.whenScheduleModeReady(), "offline");
  assert.equal(store.findScheduleById(7)?.courseName, "북한산성코스");

  await assert.rejects(store.deleteSchedule("2026-11-19"), error => error.kind === "network");
  assert.equal(store.findScheduleById(7)?.courseName, "북한산성코스", "오프라인에서는 화면에서도 지우지 않는다");

  online = true;
  onlineHandlers.forEach(handler => handler());
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(await store.whenScheduleModeReady(), "api");
  assert.equal(store.findScheduleById(7), undefined);
  assert.deepEqual(cache.loadScheduleCache(5).schedules, [], "다시 받은 서버 일정으로 저장본을 바꾼다");
});
