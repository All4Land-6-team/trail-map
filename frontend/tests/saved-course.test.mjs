import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

// 등산 담기 계정 저장(#196): 로그인했으면 실제 코스 담기·빼기를 서버에 보내고, 실패하면 되돌린다.
const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};
const server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false }, appType: "custom", logLevel: "silent" });
after(() => server.close());
const auth = await server.ssrLoadModule("/src/store/authStore.ts");
const store = await server.ssrLoadModule("/src/store/courseSelectionStore.ts");

const ok = data => new Response(JSON.stringify({ success: true, code: "OK", message: "", data }), { status: 200 });
const calls = [];
let reply = () => ok(null);
globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), method: init.method ?? "GET" }); return reply(String(url), init); };
const course = id => ({ id, mountainId: "bukhansan", name: "백운대 코스" });

beforeEach(() => {
  calls.length = 0;
  reply = () => ok(null);
  store.clearSavedCourses();
  auth.saveAuthSession({ accessToken: "t", tokenType: "Bearer", expiresAt: new Date(Date.now() + 864e5).toISOString(),
    user: { userId: 5, nickname: "등산객", email: "a@example.com" } });
});

test("로그인하면 실제 코스 담기·빼기를 서버에 저장한다 (예시 코스는 화면에서만)", async () => {
  await store.setCourseSaved("db-3", true, course("db-3"));
  await store.setCourseSaved("bukhansan-baegundae", true);
  await store.setCourseSaved("db-3", false);
  assert.deepEqual(calls.map(c => `${c.method} ${c.url.replace(/.*\/api\/v1/, "")}`),
    ["PUT /saved-courses/3", "DELETE /saved-courses/3"]);
  assert.deepEqual(store.getSavedCourseIds(), ["bukhansan-baegundae"]);
});

test("서버가 거절하면 화면을 되돌리고 오류를 알린다", async () => {
  reply = () => new Response(JSON.stringify({ success: false, code: "SAVED_404_2", message: "코스를 찾을 수 없습니다." }), { status: 404 });
  const pending = store.setCourseSaved("db-9", true, course("db-9"));
  assert.deepEqual(store.getSavedCourseIds(), ["db-9"]);          // 누른 즉시 화면에 반영
  await assert.rejects(pending);
  assert.deepEqual(store.getSavedCourseIds(), []);                // 실패하면 되돌림
});

test("로그인하지 않았으면 서버에 보내지 않는다", async () => {
  auth.clearAuthSession();
  await store.setCourseSaved("db-3", true, course("db-3"));
  assert.equal(calls.length, 0);
  assert.deepEqual(store.getSavedCourseIds(), ["db-3"]);
});

test("앱을 열면 서버 목록으로 채우고, 예시 코스 담기는 그대로 둔다", async () => {
  await store.setCourseSaved("bukhansan-baegundae", true);
  await store.setCourseSaved("db-3", true, course("db-3"));
  reply = url => url.endsWith("/saved-courses")
    ? ok([{ courseId: 7, mountainId: 1, mountainKey: null, savedAt: "2026-11-23T09:00:00+09:00" },
          { courseId: 3, mountainId: 1, mountainKey: null, savedAt: "2026-11-23T09:05:00+09:00" }])
    : ok(null);
  await store.syncSavedCoursesFromServer();
  // 서버 순서대로(다른 기기에서 뺀 코스는 사라짐), 이미 불러온 코스 정보는 다시 쓰고, 예시 코스는 뒤에 유지
  assert.deepEqual(store.getSavedCourseIds(), ["db-7", "db-3", "bukhansan-baegundae"]);
  assert.equal(store.getSavedCourse("db-3")?.name, "백운대 코스");
});
