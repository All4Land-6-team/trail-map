import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

// 등산을 시작했거나 마친 일정은 코스 화면에서 「일정 수정·삭제」 대상으로 고르지 않는다.
const server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false }, appType: "custom", logLevel: "silent" });
after(() => server.close());
const { editableCourseSchedule } = await server.ssrLoadModule("/src/store/scheduleRecord.ts");

const schedule = (scheduleId, date, record) => ({ scheduleId, date, startTime: "08:00", courseId: "db-1", serverCourseId: 1,
  mountainName: "북한산", courseName: "북한산성코스", distanceKm: 3.4, ...(record ? { record } : {}) });

test("마친 일정만 있으면 수정할 일정이 없다 (새 일정 등록으로 연다)", () => {
  const done = schedule(13, "2026-11-19", { hikeRecordId: 11, status: "COMPLETED", startedAt: "2026-11-19T08:00:00+09:00" });
  assert.equal(editableCourseSchedule([done], "db-1", null), undefined);
});

test("마친 일정과 앞으로의 일정이 같이 있으면 앞으로의 일정을 고른다", () => {
  const done = schedule(13, "2026-11-19", { hikeRecordId: 11, status: "COMPLETED", startedAt: "2026-11-19T08:00:00+09:00" });
  const planned = schedule(14, "2026-11-25");
  assert.equal(editableCourseSchedule([done, planned], "db-1", null)?.scheduleId, 14);
});

test("이 기기에서 진행 중인 등산의 일정도 고르지 않는다", () => {
  const today = schedule(15, "2026-11-20");
  const session = { schedule: today, phase: "active", alertsOn: false, startedAt: "2026-11-20T08:00:00+09:00", traveledPath: [] };
  assert.equal(editableCourseSchedule([today], "db-1", session), undefined);
  assert.equal(editableCourseSchedule([today], "db-1", null)?.scheduleId, 15);
});
