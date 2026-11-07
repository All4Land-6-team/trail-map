import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { canScheduleCourse } from '../src/utils/courseIdentity.ts';

const server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false }, appType: 'custom' });
after(() => server.close());
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
let counter = 0;
const store = () => server.ssrLoadModule(`/src/store/hikeScheduleStore.ts?test=${++counter}`);
const { HikeScheduleApiError } = await server.ssrLoadModule('/src/api/hikeScheduleApi.ts');
const { scheduleErrorMessage } = await server.ssrLoadModule('/src/utils/hikeSchedule.ts');
const api = await server.ssrLoadModule('/src/api/courseRoutes.ts');
const { toCartCourse } = await server.ssrLoadModule('/src/pages/CartPage/catalog.ts');
const date = '2099-03-17';
const selected = { courseId: 'db-8', mountainName: '북한산', courseName: '백운대코스', distanceKm: 1.82, date, startTime: '09:00' };
const saved = (overrides = {}) => ({ scheduleId: 91, date, startTime: '09:00', courseId: 8, mountainId: 1,
  courseName: '백운대코스', mountainName: '북한산', distanceMeters: 1820, durationSeconds: 5400, ...overrides });
const ok = data => new Response(JSON.stringify({ success: true, data }), { status: 200 });
const fail = (status, code = 'FAILED') => new Response(JSON.stringify({ success: false, code, message: '저장 실패' }), { status });
const route = (overrides = {}) => ({
  courseId: 8, mountainId: 1, mountainKey: 'bukhansan', courseVersion: 1, courseName: '백운대코스',
  routeLabel: '탐방지원센터~백운대', distanceMeters: 1820, officialDistanceMeters: null, durationSeconds: null, difficulty: null,
  geometry: { type: 'LineString', coordinates: [[126.95, 37.65], [126.99, 37.66]] },
  source: { name: '코스 경로', provider: null, url: null, version: 'v1', recordId: 'route-8',
    validationStatus: 'candidate_smap_unverified', checkNote: null }, ...overrides,
});

test('실제 코스는 일치하는 DB ID로 등록하고 잘못 연결된 ID는 버튼을 열지 않는다', () => {
  const course = api.parseCourseRoute(route(), 'bukhansan');
  assert.equal(canScheduleCourse(course), true);
  assert.equal(toCartCourse(course, 0).scheduleAvailable, true);
  for (const broken of [{ ...course, backendCourseId: 1 }, { ...course, backendCourseId: undefined },
    { ...course, id: 'db-0' }, { ...course, id: 'not-a-db-course' }]) assert.equal(canScheduleCourse(broken), false);
  assert.equal(canScheduleCourse({ id: 'seoraksan-example' }), true);
});

test('일정 주소용 조회는 예시 목록에 없는 DB 코스도 현재 경로 API에서 읽는다', async () => {
  const calls = [];
  globalThis.fetch = async url => { calls.push(url); return ok(route()); };
  const detail = await api.loadCourseDetailData({ mountainId: 'bukhansan', courseId: 'db-8' }, new AbortController().signal);
  assert.equal(detail.course.id, 'db-8');
  assert.equal(detail.course.name, '백운대코스');
  assert.equal(detail.course.distanceKm, 1.82);
  assert.equal(canScheduleCourse(detail.course), true);
  assert.match(calls[0], /\/courses\/8\/route$/);
  await assert.rejects(api.loadCourseDetailData({ mountainId: 'dobongsan', courseId: 'db-8' }, new AbortController().signal));
});

test('현재 산에 없는 코스·404·조회 실패를 다른 예시 일정으로 대체하지 않는다', async () => {
  globalThis.fetch = async () => new Response('', { status: 404 });
  assert.equal(await api.loadCourseDetailData({ mountainId: 'bukhansan', courseId: 'db-8' }, new AbortController().signal), null);
  assert.equal(await api.loadCourseDetailData({ mountainId: 'bukhansan', courseId: 'bukhansan-baegundae' }, new AbortController().signal), null);
  globalThis.fetch = async () => fail(503);
  await assert.rejects(api.loadCourseDetailData({ mountainId: 'bukhansan', courseId: 'db-8' }, new AbortController().signal));
});

test('첫 일정 조회가 끝나기 전에는 로컬 저장하거나 POST하지 않고 실제 저장 결과를 기다린다', async () => {
  let release;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([url, options]);
    return options.method === 'POST' ? ok(saved()) : new Promise(resolve => { release = () => resolve(ok([])); });
  };
  const schedules = await store();
  const pending = schedules.saveSchedule(selected);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(schedules.findSchedule(date), undefined);
  release();
  const result = await pending;
  assert.equal(result.scheduleId, 91);
  assert.equal(result.courseId, 'db-8');
  assert.equal(result.serverCourseId, 8);
  assert.equal(result.serverMountainId, 1);
  assert.deepEqual(JSON.parse(calls[1][1].body), { courseId: 8, date, startTime: '09:00', replaceExisting: false });
  assert.equal(schedules.findSchedule(date).scheduleId, 91);
});

test('서버를 읽지 못한 상태에서는 실제 일정을 예시 저장하지 않으며 서버 복구 후 재시도한다', async () => {
  globalThis.fetch = async () => { throw new TypeError('network'); };
  const schedules = await store();
  assert.equal(await schedules.whenScheduleModeReady(), 'mock');
  await assert.rejects(schedules.saveSchedule(selected), error => error.kind === 'network');
  assert.equal(schedules.findSchedule(date), undefined);
  const posts = [];
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'POST') posts.push(JSON.parse(options.body));
    return ok(options.method === 'POST' ? saved() : []);
  };
  const result = await schedules.saveSchedule(selected);
  assert.equal(await schedules.whenScheduleModeReady(), 'api');
  assert.equal(result.scheduleId, 91);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].courseId, 8);
});

test('일정 조회의 인증·서버 오류도 실제 일정의 로컬 성공으로 처리하지 않는다', async () => {
  for (const status of [401, 403, 500]) {
    const methods = [];
    globalThis.fetch = async (_url, options) => { methods.push(options.method ?? 'GET'); return fail(status); };
    const schedules = await store();
    await schedules.whenScheduleModeReady();
    await assert.rejects(schedules.saveSchedule(selected), error => error.kind === 'server');
    assert.equal(schedules.findSchedule(date), undefined);
    assert.ok(methods.every(method => method === 'GET'));
  }
});

test('POST 실패 시 기존 일정과 날짜·시간은 유지하고 다음 저장을 재시도할 수 있다', async () => {
  const existing = saved({ courseId: 1, courseName: '북한산성코스', scheduleId: 70 });
  globalThis.fetch = async (_url, options) => options.method === 'POST' ? fail(503) : ok([existing]);
  const schedules = await store();
  await schedules.whenScheduleModeReady();
  const original = schedules.findSchedule(date);
  await assert.rejects(schedules.saveSchedule(selected), error => error.kind === 'server');
  assert.equal(schedules.findSchedule(date), original);
  assert.equal(original.courseId, 'db-1');
  assert.equal(selected.startTime, '09:00');
  globalThis.fetch = async () => ok(saved());
  await schedules.saveSchedule(selected, { replaceExisting: true });
  assert.equal(schedules.findSchedule(date).courseId, 'db-8');
});

test('같은 날짜의 서버 충돌은 보존하고 확인한 대체 요청에만 replaceExisting=true를 보낸다', async () => {
  const bodies = [];
  globalThis.fetch = async (_url, options) => {
    if (options.method !== 'POST') return ok([saved({ courseId: 1, scheduleId: 70 })]);
    const body = JSON.parse(options.body); bodies.push(body);
    return body.replaceExisting ? ok(saved()) : fail(409, 'HIKE_409_1');
  };
  const schedules = await store();
  await assert.rejects(schedules.saveSchedule(selected), error => error.kind === 'conflict');
  assert.equal(schedules.findSchedule(date).courseId, 'db-1');
  await schedules.saveSchedule(selected, { replaceExisting: true });
  assert.deepEqual(bodies.map(body => body.replaceExisting), [false, true]);
  assert.equal(schedules.findSchedule(date).courseId, 'db-8');
});

test('기존 일정 수정은 원래 scheduleId로 PATCH하며 성공한 날짜만 캘린더 저장소에 반영한다', async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push([url, options]);
    return ok(options.method === 'PATCH' ? saved({ date: '2099-03-18', scheduleId: 70 }) : [saved({ scheduleId: 70 })]);
  };
  const schedules = await store();
  await schedules.whenScheduleModeReady();
  const result = await schedules.saveSchedule({ ...selected, date: '2099-03-18' }, { previousDate: date });
  assert.equal(result.date, '2099-03-18');
  assert.match(requests[1][0], /\/hike-schedules\/70$/);
  assert.equal(requests[1][1].method, 'PATCH');
  assert.equal(schedules.findSchedule(date), undefined);
  assert.equal(schedules.findSchedule('2099-03-18').scheduleId, 70);
});

test('진행 중인 등산의 대체·수정 거절은 재확인 대상이 아니며 기존 일정을 유지한다', async () => {
  for (const change of [{ replaceExisting: true }, { previousDate: date }]) {
    globalThis.fetch = async (_url, options) => ['POST', 'PATCH'].includes(options.method) ? fail(409, 'HIKE_409_6') : ok([saved()]);
    const schedules = await store();
    await schedules.whenScheduleModeReady();
    const original = schedules.findSchedule(date);
    await assert.rejects(schedules.saveSchedule(selected, change), error => {
      assert.equal(error.kind, 'activeHike');
      assert.match(scheduleErrorMessage(error), /진행 중인 등산/);
      return true;
    });
    assert.equal(schedules.findSchedule(date), original);
  }
});

test('잘못된 DB ID는 예시 저장하지 않고 예시 코스의 기존 로컬 일정은 유지한다', async () => {
  globalThis.fetch = async () => { throw new TypeError('network'); };
  const schedules = await store();
  await assert.rejects(schedules.saveSchedule({ ...selected, courseId: 'db-0' }), error => error.kind === 'unsupportedCourse');
  assert.equal(schedules.findSchedule(date), undefined);
  const result = await schedules.saveSchedule({ ...selected, courseId: 'seoraksan-example' });
  assert.equal(result.courseId, 'seoraksan-example');
  assert.equal(schedules.findSchedule(date), result);
});

test('저장 오류 문구는 네트워크·진행 중인 일정·일반 실패를 구분한다', () => {
  assert.match(scheduleErrorMessage(new HikeScheduleApiError('network', '연결 실패')), /서버에 연결하지 못해/);
  assert.equal(scheduleErrorMessage(new HikeScheduleApiError('activeHike', '등산 중')), '등산 중');
  assert.match(scheduleErrorMessage(new Error('internal')), /잠시 후 다시 시도/);
});

test('실제 코스를 담은 비교표에서 분석 실패 여부와 관계없이 일정 등록을 열 수 있다', async () => {
  const { ComparisonMetricsScreen } = await server.ssrLoadModule('/src/pages/CartPage/components/ComparisonMetricsScreen.tsx');
  const courses = [8, 10].map((id, index) => toCartCourse(api.parseCourseRoute(route({ courseId: id }), 'bukhansan'), index));
  const html = renderToStaticMarkup(createElement(ComparisonMetricsScreen, {
    courses, analysisCourses: courses.map(course => ({ ...course, analysis: null, profile: null, profileError: null })),
    analysisState: { status: 'error', message: '분석 없음' }, plannedHikes: [],
    onRetry() {}, onBack() {}, onCourseDetail() {}, onKeepCart() {}, onNavigate() {}, async onPlanHike() {},
  }));
  assert.doesNotMatch(html, /일정 연동 예정/);
  const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
  const register = buttons.find(button => button[2].includes('일정 등록'));
  assert.ok(register);
  assert.doesNotMatch(register[1], /disabled/);
  assert.match(html, /분석 없음/);
});
