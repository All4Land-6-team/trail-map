import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

// 브라우저 localStorage 대신 쓰는 메모리 저장소. 타이머(30초 재시도)는 테스트에서 돌리지 않는다.
const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};
globalThis.window = { localStorage: globalThis.localStorage, addEventListener() {}, setTimeout: () => 0 };
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...args) => ms >= 30_000 ? 0 : realSetTimeout(fn, ms, ...args);

const server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false }, appType: "custom", logLevel: "silent" });
after(() => server.close());
const sync = await server.ssrLoadModule("/src/store/hikeOfflineSync.ts");

const record = { hikeRecordId: 11, scheduleId: 7, status: "COMPLETED", startedAt: "2026-11-19T08:00:00+09:00",
  endedAt: "2026-11-19T11:00:00+09:00", traveledDistanceMeters: 1686, actualDurationSeconds: 10800,
  traveledPath: [], coursePath: [], courseDistanceMeters: 3400 };
const reply = (status, body) => new Response(JSON.stringify(body), { status });
const requests = [];
const answer = handler => { globalThis.fetch = async (url, init) => { requests.push({ url: String(url), body: init?.body }); return handler(); }; };

test("로그인이 만료돼 거절되면(401) 종료를 버리지 않고 남겨 둔다", async () => {
  memory.clear();
  sync.queueHikeAction(11, { finishedAt: "2026-11-19T11:00:00+09:00" });
  answer(() => reply(401, { success: false, code: "AUTH_401_1", message: "로그인이 필요해요." }));
  await sync.syncPendingHikeActions();
  assert.equal(sync.pendingHikeActions(11).length, 1);
});

test("다시 보내 성공하면 누른 시각으로 종료하고 대기열을 비운다", async () => {
  requests.length = 0;
  answer(() => reply(200, { success: true, code: "OK", message: "", data: record }));
  await sync.syncPendingHikeActions();
  assert.equal(sync.pendingHikeActions(11).length, 0);
  const finish = requests.find(item => item.url.endsWith("/11/finish"));
  assert.deepEqual(JSON.parse(finish.body), { endedAt: "2026-11-19T11:00:00+09:00" });
});

test("서버가 받지 않는 요청(400)은 다시 보내도 같으므로 버린다", async () => {
  memory.clear();
  sync.queueHikeAction(12, { descend: true });
  answer(() => reply(400, { success: false, code: "COMMON_400", message: "잘못된 요청" }));
  await sync.syncPendingHikeActions();
  assert.equal(sync.pendingHikeActions(12).length, 0);
});

test("통신이 안 되면 남겨 둔다", async () => {
  memory.clear();
  sync.queueHikeAction(13, { descend: true });
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await sync.syncPendingHikeActions();
  assert.equal(sync.pendingHikeActions(13).length, 1);
});
