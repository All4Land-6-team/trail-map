import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { detailAnalysisView } from '../src/utils/courseDetailAnalysis.ts';
import { DEFAULT_COURSE_FILTERS, selectCourses, formatCourseDuration } from '../src/utils/courseDiscovery.ts';

const server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false }, appType: 'custom' });
after(() => server.close());
const api = await server.ssrLoadModule('/src/api/courseRoutes.ts');
const { CourseCarousel } = await server.ssrLoadModule('/src/pages/CourseListPage/components/CourseCarousel.tsx');
const { CourseBasicInfo } = await server.ssrLoadModule('/src/pages/CourseDetailPage/components/CourseBasicInfo.tsx');
const nativeFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = nativeFetch; });
const signal = () => new AbortController().signal;
const route = (overrides = {}) => ({
  courseId: 101, mountainId: 11, mountainKey: 'bukhansan', courseVersion: 1,
  courseName: '북한산성코스', routeLabel: '탐방지원센터~백운대', distanceMeters: 3733.52,
  officialDistanceMeters: 3400, durationSeconds: null, difficulty: null,
  geometry: { type: 'LineString', coordinates: [[126.95, 37.65], [126.99, 37.66]] },
  source: { name: '13개 추출 경로', provider: null, url: null, version: '20261031', recordId: 'BUKHAN_01',
    validationStatus: 'candidate_smap_unverified', checkNote: '현장 검증 전' },
  ...overrides,
});
const envelope = data => ({ success: true, data });
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });

test('공식 안내를 필터와 기본 상세에 연결하고 경로 길이와 안내 거리를 구분한다', () => {
  const guide = { officialCourseId: '121500V001', routeLabel: '탐방지원센터~백운대', difficultyGrade: '중', checkedOn: '2026-11-01',
    sourceUrl: 'https://www.knps.or.kr/front/portal/visit/visitCourseSubMain.do?menuNo=8000275&parkId=121500&parkNavGb=guide&vcursId=121500V001' };
  const course = api.parseCourseRoute(route({ guide, durationSeconds: 9600, difficulty: 'INTERMEDIATE' }), 'bukhansan');
  assert.equal(course.durationMinutes, 160);
  assert.equal(selectCourses([course], { ...DEFAULT_COURSE_FILTERS, difficulty: 'intermediate' }, 'difficulty').length, 1);
  assert.equal(selectCourses([course], { ...DEFAULT_COURSE_FILTERS, difficulty: 'advanced' }, 'difficulty').length, 0);
  const html = renderToStaticMarkup(createElement(CourseBasicInfo, { course }));
  for (const label of ['중급', '공식 등급 중', '2시간 40분', '3.73 km', '3.4 km', '국립공원공단', '왕복 시간이 아니에요']) assert.ok(html.includes(label));
  assert.equal(course.elevationGainMeters, null);
  for (const malformed of [{ ...guide, sourceUrl: 'javascript:alert(1)' }, { ...guide, difficultyGrade: '상' }]) {
    assert.throws(() => api.parseCourseRoute(route({ guide: malformed, durationSeconds: 9600, difficulty: 'INTERMEDIATE' }), 'bukhansan'));
  }
});

test('실제 DB 식별자·LineString·출처를 보존하고 미계산 시간과 난이도를 만들지 않는다', () => {
  const value = route(), course = api.parseCourseRoute(value, 'bukhansan', 101);
  assert.equal(course.id, 'db-101');
  assert.deepEqual(course.analysisReference, { courseId: 101, mountainId: 11, development: false });
  assert.equal(course.backendCourseId, 101);
  assert.equal(course.durationMinutes, null); assert.equal(course.difficulty, null);
  assert.equal(course.distanceKm, 3.73352);
  assert.deepEqual(course.routeCoordinates, value.geometry.coordinates);
  assert.deepEqual(course.routeSource, value.source);
  assert.equal(api.databaseCourseId('db-101'), 101);
  for (const id of ['101', 'db-0', 'db-01', 'db--1', 'db-1.5', 'db-9007199254740993', 'bukhansan-baegundae']) {
    assert.equal(api.databaseCourseId(id), null);
  }
});

test('다른 코스·산, 잘못된 geometry·좌표·중복 식별자 응답을 거절한다', () => {
  for (const overrides of [
    { mountainKey: 'dobongsan' }, { courseId: 102 }, { mountainId: 0 }, { courseVersion: 0 },
    { distanceMeters: -1 }, { durationSeconds: '10' }, { difficulty: 'EASY' },
    { geometry: { type: 'MultiLineString', coordinates: [] } },
    { geometry: { type: 'LineString', coordinates: [[127, 37]] } },
    { geometry: { type: 'LineString', coordinates: [[37, 127], [38, 127]] } },
    { geometry: { type: 'LineString', coordinates: [[127, 37, 0], [127, 38, 0]] } },
    { geometry: { type: 'LineString', coordinates: [[Infinity, 37], [127, 38]] } },
  ]) assert.throws(() => api.parseCourseRoute(route(overrides), 'bukhansan', 101), /형식/);
  assert.throws(() => api.parseCourseRouteList(envelope([route(), route()]), 'bukhansan'), /형식/);
  assert.throws(() => api.parseCourseRouteList({ success: false, data: [] }, 'bukhansan'), /형식/);
  assert.deepEqual(api.parseCourseRouteList(envelope([]), 'bukhansan'), []);
});

test('실제 목록·직접 상세 주소가 API를 읽고 분석·예시 스팟을 섞지 않는다', async () => {
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(url);
    return json(envelope(url.includes('course-routes?') ? [route()] : route()));
  };
  const list = await api.loadCourseDiscoveryData('bukhansan', signal());
  assert.equal(list.courses.length, 1); assert.equal(list.courses[0].id, 'db-101');
  const detail = await api.loadCourseDetailData({ mountainId: 'bukhansan', courseId: 'db-101' }, signal());
  assert.equal(detail.course.name, '북한산성코스'); assert.deepEqual(detail.spots, []);
  assert.match(urls[0], /\/api\/v1\/course-routes\?mountainKey=bukhansan$/);
  assert.match(urls[1], /\/api\/v1\/courses\/101\/route$/);
  assert.equal(await api.loadCourseDetailData({ mountainId: 'bukhansan', courseId: 'bukhansan-baegundae' }, signal()), null);
});

test('빈 목록과 404 상세를 구분하고 실패 시 예시 경로로 대체하지 않는다', async () => {
  globalThis.fetch = async () => json(envelope([]));
  assert.deepEqual((await api.loadCourseDiscoveryData('dobongsan', signal())).courses, []);
  globalThis.fetch = async () => new Response('', { status: 404 });
  assert.equal(await api.loadCourseDetailData({ mountainId: 'bukhansan', courseId: 'db-101' }, signal()), null);
  await assert.rejects(api.loadCourseDiscoveryData('bukhansan', signal()), /HTTP 404/);
  globalThis.fetch = async () => new Response('', { status: 500 });
  await assert.rejects(api.loadCourseDiscoveryData('bukhansan', signal()), /HTTP 500/);
});

test('화면 이탈 취소·시간 초과 및 응답 후 취소를 처리한다', async () => {
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  const controller = new AbortController();
  const pending = api.requestCourseRoutes('course-routes?mountainKey=bukhansan', controller.signal);
  controller.abort(); await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(api.requestCourseRoutes('course-routes?mountainKey=bukhansan', signal(), 5), /시간이 초과/);
  await assert.rejects(api.requestCourseRoutes('course-routes', controller.signal), { name: 'AbortError' });
  const later = new AbortController();
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => { later.abort(); return envelope([]); } });
  await assert.rejects(api.requestCourseRoutes('course-routes', later.signal), { name: 'AbortError' });
});

test('시간·난이도 미확인은 필터로 초급·짧은 코스로 오인되지 않는다', () => {
  const course = api.parseCourseRoute(route(), 'bukhansan');
  assert.equal(formatCourseDuration(course.durationMinutes), '정보 없음');
  assert.equal(selectCourses([course], DEFAULT_COURSE_FILTERS, 'difficulty').length, 1);
  for (const filter of [{ duration: 'under2' }, { duration: '2to4' }, { difficulty: 'beginner' }]) {
    assert.equal(selectCourses([course], { ...DEFAULT_COURSE_FILTERS, ...filter }, 'difficulty').length, 0);
  }
});

test('분석 로딩·오류·없음에도 실제 LineString을 유지하고 그래프는 별개다', () => {
  const course = api.parseCourseRoute(route(), 'bukhansan');
  for (const state of [{ status: 'loading' }, { status: 'error', message: '실패' }, { status: 'unavailable', message: '없음' }]) {
    const view = detailAnalysisView(course, state);
    assert.deepEqual(view.routeCoordinates, course.routeCoordinates);
    assert.deepEqual(view.samples, []);
    assert.equal(view.development, false);
  }
  const view = detailAnalysisView(course, { status: 'success', data: { analysis: { sourceKind: 'official' }, profile: {
    samples: [{ distanceMeters: 0, elevationMeters: 10, slopePercent: null, coordinate: [127.1, 37.1] }],
  } } });
  assert.deepEqual(view.routeCoordinates, course.routeCoordinates);
  assert.deepEqual(view.samples[0].coordinate, [127.1, 37.1]);
});

test('목록·상세의 경로 안내 UI는 제거하고 카드와 출처 데이터는 유지한다', () => {
  const course = api.parseCourseRoute(route(), 'bukhansan');
  const list = readFileSync(new URL('../src/pages/CourseListPage/CourseListPage.tsx', import.meta.url), 'utf8');
  const detail = readFileSync(new URL('../src/pages/CourseDetailPage/components/CourseAnalysis.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(list + detail, /CourseRouteSource|검토용 경로|후속 연동 예정/);
  assert.match(list, /dataLabel=\{hasRouteCatalog\(mountainId\) \? null : undefined\}/);
  assert.equal(course.routeSource.validationStatus, 'candidate_smap_unverified');
  assert.equal(course.routeSource.checkNote, '현장 검증 전');
  const html = renderToStaticMarkup(createElement(CourseCarousel, { courses: [course], selectedId: course.id,
    savedIds: [], scheduledIds: [], onSelect() {}, onSave() {}, onSchedule() {}, onOpen() {} }));
  assert.match(html, /난이도 정보 없음/); assert.match(html, /정보 없음/);
  const saveButton = html.match(/<button[^>]*aria-label="북한산성코스 등산 담기"[^>]*>/)?.[0];
  assert.ok(saveButton);
  assert.doesNotMatch(saveButton, /disabled/);
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-label="북한산성코스 일정 등록 \(연동 예정\)"/);
  assert.match(html, /코스 상세 보기/);
});

test('실제 코스 담기 → 장바구니 변환 → 해제는 DB 식별자와 결측을 보존한다', async () => {
  const store = await server.ssrLoadModule('/src/store/courseSelectionStore.ts');
  const catalog = await server.ssrLoadModule('/src/pages/CartPage/catalog.ts');
  const { formatCourseDuration } = await server.ssrLoadModule('/src/pages/CartPage/data.ts');
  const course = api.parseCourseRoute(route({ courseName: '대남문 코스' }), 'bukhansan');
  try {
    store.setCourseSaved(course.id, true, course);
    store.setCourseSaved(course.id, true, course);
    store.setCourseSaved('daenammun', true);
    const saved = catalog.getSavedCartCourses(store.getSavedCourseIds());
    assert.equal(saved.length, 2);
    const actual = saved.find(item => item.id === course.id);
    assert.equal(actual.mountainId, 'bukhansan');
    assert.deepEqual(actual.analysisReference, { courseId: 101, mountainId: 11, development: false });
    assert.deepEqual(actual.routeCoordinates, course.routeCoordinates);
    assert.equal(actual.durationMinutes, null);
    assert.equal(formatCourseDuration(actual.durationMinutes), '정보 없음');
    assert.deepEqual(actual.elevationProfile, []);
    assert.equal(actual.averageSlopePercent, undefined);
    assert.equal(actual.scheduleAvailable, false);
    const { CourseSelectionScreen } = await server.ssrLoadModule('/src/pages/CartPage/components/CourseSelectionScreen.tsx');
    const html = renderToStaticMarkup(createElement(CourseSelectionScreen, {
      courses: [actual], selectedCourseIds: new Set([actual.id]),
      onBack() {}, onCompare() {}, onCourseDetail() {}, onNavigate() {}, onToggleCourse() {},
    }));
    assert.match(html, /3\.73/);
    assert.match(html, /정보 없음/);
    assert.match(html, /대남문 코스 상세 보기/);
    assert.throws(() => store.setCourseSaved('db-999', true, course), /ID/);
    assert.equal(store.getSavedCourseIds().includes('db-999'), false);
    const previousIds = store.getSavedCourseIds();
    store.setCourseSaved(course.id, true, { ...course, durationMinutes: 180 });
    assert.notEqual(store.getSavedCourseIds(), previousIds);
    assert.equal(catalog.getSavedCartCourses(store.getSavedCourseIds()).find(item => item.id === course.id).durationMinutes, 180);
    store.setCourseSaved(course.id, false);
    assert.equal(store.getSavedCourse(course.id), undefined);
    assert.deepEqual(catalog.getSavedCartCourses(store.getSavedCourseIds()).map(item => item.id), ['daenammun']);
  } finally {
    store.setCourseSaved(course.id, false);
    store.setCourseSaved('daenammun', false);
  }
});

test('DEM 지원 산 목록은 개선된 지도와 시트 미리보기 생명주기를 함께 연결한다', () => {
  const list = readFileSync(new URL('../src/pages/CourseListPage/CourseListPage.tsx', import.meta.url), 'utf8');
  assert.match(list, /const enhancedMap = supportsTerrain\(mountainId\)/);
  assert.match(list, /trackSettledInset: enhancedMap/);
  assert.match(list, /enhanced=\{enhancedMap\}/);
  assert.match(list, /onPreviewStart=\{previewControls.begin\}/);
  assert.match(list, /onPreviewEnd=\{previewControls.end\}/);
});
