import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { analysis, noAnalysis } from './fixtures/course-analysis.mjs';
import { comparisonGuideView } from '../src/utils/courseGuideComparison.ts';

const server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false }, appType: 'custom' });
after(() => server.close());
const { comparisonGuideRequest, loadCourseComparisonGuides } = await server.ssrLoadModule('/src/api/courseComparisonGuides.ts');
const { ComparisonMetricsScreen } = await server.ssrLoadModule('/src/pages/CartPage/components/ComparisonMetricsScreen.tsx');
const nativeFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = nativeFetch; });

const names = { 8: '백운대코스', 1: '북한산성코스', 10: '비봉코스' };
const durations = { 8: 5400, 1: 9600, 10: 3600 };
const colors = ['#1b6a53', '#5b8bd6', '#d9964a'];
const sourceUrl = id => `https://www.knps.or.kr/front/portal/visit/visitCourseSubMain.do?menuNo=8000275&parkId=121500&parkNavGb=guide&vcursId=121500V${String(id).padStart(3, '0')}`;
const signal = () => new AbortController().signal;
const response = value => new Response(JSON.stringify({ success: true, data: value }));
const selected = (ids = [8, 1, 10]) => ids.map((id, index) => ({
  id: `db-${id}`, mountainId: 'bukhansan', analysisReference: { courseId: id, mountainId: 1, development: false },
  name: names[id], shortName: names[id], mountain: '북한산', color: colors[index],
  distanceKm: 99, durationMinutes: 9999, scheduleAvailable: false, routeCoordinates: [], elevationProfile: [],
}));
const route = (id, overrides = {}) => ({
  courseId: id, mountainId: 1, mountainKey: 'bukhansan', courseVersion: 1,
  courseName: names[id], routeLabel: `안내 시작~${names[id]} 도착`, distanceMeters: 1800,
  officialDistanceMeters: 1900, durationSeconds: durations[id], difficulty: 'INTERMEDIATE',
  geometry: { type: 'LineString', coordinates: [[126.95, 37.65], [126.99, 37.66]] },
  source: { name: '코스 경로', provider: null, url: null, version: 'v1', recordId: `route-${id}`,
    validationStatus: 'candidate_smap_unverified', checkNote: null },
  guide: { officialCourseId: `121500V${String(id).padStart(3, '0')}`, routeLabel: `공식 안내 시작~${names[id]} 도착`,
    difficultyGrade: '중', sourceUrl: sourceUrl(id), checkedOn: '2026-11-01' },
  ...overrides,
});
const available = (id, overrides = {}) => ({ id: `db-${id}`, status: 'available', guide: {
  courseId: id, mountainId: 1, courseVersion: 1, durationSeconds: durations[id],
  routeLabel: `공식 안내 시작~${names[id]} 도착`, sourceUrl: sourceUrl(id), checkedOn: '2026-11-01', ...overrides,
} });
const ready = () => ({ status: 'success', courses: [8, 1, 10].map(id => available(id)) });
function render(guideState, values = null) {
  const courses = selected();
  const analysisCourses = courses.map((course, index) => ({
    id: course.id, name: course.name, shortName: course.shortName, color: course.color,
    development: false, analysis: values?.[index] ?? null, profile: null, profileError: null,
  }));
  return renderToStaticMarkup(createElement(ComparisonMetricsScreen, {
    courses, analysisCourses, guideState,
    analysisState: values ? { status: 'success', data: { mountainId: 1, mountainName: '북한산' } }
      : { status: 'error', message: '분석을 불러오지 못했어요.' },
    onRetry() {}, onRetryGuides() {}, onBack() {}, onCourseDetail() {}, onKeepCart() {}, onNavigate() {},
    plannedHikes: [], onPlanHike() {},
  }));
}
function timeCard(html) {
  const match = html.match(/<section class="cart-metric-card" aria-label="공식 안내 시간 비교">([\s\S]*?)<\/section>/);
  assert.ok(match, '공식 안내 시간 비교 카드');
  return match[1];
}

test('선택한 2~3개 DB 코스의 공식 안내를 입력 순서로 읽고 분석 API와 별도로 조회한다', async () => {
  for (const ids of [[10, 8], [8, 1, 10]]) {
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push(url);
      assert.equal(options.cache, 'no-store');
      assert.deepEqual(options.headers, { Accept: 'application/json' });
      return response(route(Number(url.match(/courses\/(\d+)\/route$/)[1])));
    };
    const rows = await loadCourseComparisonGuides(selected(ids), signal());
    assert.deepEqual(rows.map(row => row.id), ids.map(id => `db-${id}`));
    assert.deepEqual(rows.map(row => row.guide.durationSeconds), ids.map(id => durations[id]));
    assert.deepEqual(rows.map(row => row.guide.sourceUrl), ids.map(sourceUrl));
    assert.ok(rows.every(row => row.guide.checkedOn === '2026-11-01' && row.guide.courseVersion === 1));
    assert.equal(calls.length, ids.length);
    assert.ok(calls.every(url => /\/api\/v1\/courses\/\d+\/route$/.test(url)));
  }
});

test('도봉산의 실제 DB 산 ID도 고정 번호로 가정하지 않고 안내를 연결한다', async () => {
  const courses = [3, 4].map(id => ({ id: `db-${id}`, mountainId: 'dobongsan',
    analysisReference: { courseId: id, mountainId: 22, development: false } }));
  globalThis.fetch = async url => {
    const id = Number(url.match(/courses\/(\d+)/)[1]);
    return response(route(id, { mountainId: 22, mountainKey: 'dobongsan', courseName: `도봉산 ${id}코스`,
      routeLabel: '탐방지원센터~도봉산', durationSeconds: 7200,
      guide: { ...route(id).guide, routeLabel: '탐방지원센터~도봉산' } }));
  };
  const rows = await loadCourseComparisonGuides(courses, signal());
  assert.ok(rows.every(row => row.status === 'available' && row.guide.mountainId === 22));
  assert.ok(rows.every(row => row.guide.durationSeconds === 7200));
});

test('예시·개발용 시드·중복·다른 산·불일치 ID는 공식 안내로 요청하지 않는다', async () => {
  globalThis.fetch = () => assert.fail('잘못 연결된 코스는 요청하지 않아야 함');
  const courses = selected([8, 1]);
  for (const invalid of [
    [], courses.slice(0, 1), [...courses, ...courses], [courses[0], courses[0]],
    [courses[0], { ...courses[1], id: 'bukhansan-example' }],
    [courses[0], { ...courses[1], mountainId: 'seoraksan' }],
    [courses[0], { ...courses[1], mountainId: 'dobongsan' }],
    [courses[0], { ...courses[1], analysisReference: undefined }],
    [courses[0], { ...courses[1], analysisReference: { courseId: 1, mountainId: 1, development: true } }],
    [courses[0], { ...courses[1], analysisReference: { courseId: 99, mountainId: 1, development: false } }],
    [courses[0], { ...courses[1], analysisReference: { courseId: 1, mountainId: 2, development: false } }],
  ]) {
    assert.equal(comparisonGuideRequest(invalid).connected, false);
    await assert.rejects(loadCourseComparisonGuides(invalid, signal()));
  }
});

test('출처 없는 시간·정보 없음·0은 공식 소요 시간이나 예시 시간으로 보충하지 않는다', async () => {
  for (const change of [{ guide: null }, { guide: null, durationSeconds: null }, { durationSeconds: 0 }]) {
    globalThis.fetch = async url => response(route(Number(url.match(/courses\/(\d+)/)[1]), change));
    const rows = await loadCourseComparisonGuides(selected([8, 1]), signal());
    assert.ok(rows.every(row => row.status === 'missing'));
    assert.ok(rows.every(row => !('guide' in row)));
  }
});

test('원본 초 단위 값을 보존하고 소수·비정상적으로 큰 시간은 거절한다', async () => {
  for (const seconds of [1, 31, 3601, 9600]) {
    globalThis.fetch = async url => response(route(Number(url.match(/courses\/(\d+)/)[1]), { durationSeconds: seconds }));
    const rows = await loadCourseComparisonGuides(selected([8, 1]), signal());
    assert.ok(rows.every(row => row.guide.durationSeconds === seconds));
  }
  for (const seconds of [1.5, Number.MAX_SAFE_INTEGER + 1, Number.MAX_VALUE]) {
    globalThis.fetch = async url => response(route(Number(url.match(/courses\/(\d+)/)[1]), { durationSeconds: seconds }));
    const rows = await loadCourseComparisonGuides(selected([8, 1]), signal());
    assert.ok(rows.every(row => row.status === 'error'));
  }
});

test('안내 조회 한 건 실패는 그 코스만 비우고 다른 공식 시간과 출처를 유지한다', async () => {
  globalThis.fetch = async url => url.includes('/1/route') ? new Response('', { status: 503 })
    : response(route(Number(url.match(/courses\/(\d+)/)[1])));
  const rows = await loadCourseComparisonGuides(selected(), signal());
  assert.equal(rows[0].guide.durationSeconds, 5400);
  assert.equal(rows[1].status, 'error');
  assert.equal(rows[2].guide.durationSeconds, 3600);
});

test('다른 코스·산·잘못된 출처·404·JSON·네트워크 오류를 안내 시간으로 표시하지 않는다', async () => {
  const wrongSource = route(8).guide;
  const failures = [
    () => response(route(8, { courseId: 10 })),
    () => response(route(8, { mountainId: 99 })),
    () => response(route(8, { mountainKey: 'dobongsan' })),
    () => response(route(8, { courseVersion: 0 })),
    () => response(route(8, { guide: { ...wrongSource, sourceUrl: 'javascript:alert(1)' } })),
    () => new Response('', { status: 404 }),
    () => new Response('invalid-json'),
    () => new Response(JSON.stringify({ success: false, data: route(8) })),
    () => { throw new TypeError('network'); },
  ];
  for (const failure of failures) {
    globalThis.fetch = async url => url.includes('/8/route') ? failure() : response(route(1));
    const rows = await loadCourseComparisonGuides(selected([8, 1]), signal());
    assert.equal(rows[0].status, 'error');
    assert.equal(rows[1].guide.durationSeconds, 9600);
  }
});

test('이미 취소한 안내 요청은 전송하지 않는다', async () => {
  const controller = new AbortController(); controller.abort();
  globalThis.fetch = () => assert.fail('이미 취소된 요청');
  await assert.rejects(loadCourseComparisonGuides(selected(), controller.signal), { name: 'AbortError' });
});

test('선택 변경·화면 이탈로 취소하면 부분 결과도 반환하지 않는다', async () => {
  const controller = new AbortController();
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  const pending = loadCourseComparisonGuides(selected(), controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('응답을 받은 직후 취소돼도 이전 코스의 안내를 표시하지 않는다', async () => {
  const controller = new AbortController();
  globalThis.fetch = async url => ({ ok: true, status: 200, json: async () => {
    controller.abort();
    return { success: true, data: route(Number(url.match(/courses\/(\d+)/)[1])) };
  } });
  await assert.rejects(loadCourseComparisonGuides(selected(), controller.signal), { name: 'AbortError' });
});

test('분석 없음과 이전 분석이어도 현재 경로 버전에 맞는 안내는 사용할 수 있다', () => {
  for (const value of [null, noAnalysis(8), analysis(8)]) {
    assert.equal(comparisonGuideView({ id: 'db-8', analysis: value }, ready()).status, 'available');
  }
  const oldAnalysis = analysis(8, { qualityStatus: 'OUTDATED', currentCourseVersion: 2 });
  const state = { status: 'success', courses: [available(8, { courseVersion: 2 })] };
  assert.equal(comparisonGuideView({ id: 'db-8', analysis: oldAnalysis }, state).status, 'available');
  assert.equal(oldAnalysis.analyzedCourseVersion, 1);
});

test('공식 안내와 분석 응답의 현재 코스 ID·산·버전이 다르면 시간을 섞지 않는다', () => {
  for (const changes of [{ currentCourseVersion: 2 }, { courseId: 1 }, { mountainId: 2 }]) {
    assert.equal(comparisonGuideView({ id: 'db-8', analysis: analysis(8, changes) }, ready()).status, 'outdated');
  }
  const reversed = { status: 'success', courses: ready().courses.toReversed() };
  assert.equal(comparisonGuideView({ id: 'db-8', analysis: null }, reversed).guide.durationSeconds, 5400);
});

test('분석 API 오류에도 공식 시간·출처·확인일·안내 구간과 비교 막대를 표시한다', () => {
  const html = render(ready()), card = timeCard(html);
  for (const text of ['1시간 30분', '2시간 40분', '1시간', '확인 2026-11-01', '왕복 시간이 아니에요', '공식 안내 시작']) {
    assert.ok(card.includes(text), text);
  }
  assert.equal((card.match(/class="cart-metric-track"/g) ?? []).length, 3);
  assert.equal((card.match(/target="_blank" rel="noopener noreferrer"/g) ?? []).length, 3);
  for (const id of [8, 1, 10]) assert.ok(card.includes(`vcursId=121500V${String(id).padStart(3, '0')}`));
  for (const color of colors) assert.ok(card.includes(color));
  assert.match(html, /분석을 불러오지 못/);
  assert.doesNotMatch(card, /9999|예상 시간 비교|>0분</);
  const disabledButtons = html.match(/<button\b[^>]*disabled=""[^>]*>[\s\S]*?<\/button>/g) ?? [];
  assert.ok(disabledButtons.some(button => button.includes('일정 연동 예정')));
});

test('분석 예상 시간과 담은 코스의 시간이 있어도 공식 안내 시간만 비교한다', () => {
  const values = [8, 1, 10].map(id => {
    const value = analysis(id); value.metrics.estimatedDurationSeconds = 600;
    value.settings.steepSlopeThresholdPercent = 20;
    value.settings.steepSlopeMethod = 'absolute_slope_gte_distance_weighted';
    value.metrics.steepSectionRatioPercent = 12.3;
    return value;
  });
  const html = render(ready(), values), card = timeCard(html);
  assert.match(card, /1시간 30분/);
  assert.doesNotMatch(card, />10분<|9999/);
  assert.match(html, /급경사 비율 비교/);
  assert.match(html, /12\.3%/);
  assert.match(html, /1\.5 km/);
});

test('안내가 없으면 분석의 예상 시간이나 예시 시간으로 대체하지 않고 막대도 숨긴다', () => {
  const values = [8, 1, 10].map(id => {
    const value = analysis(id); value.metrics.estimatedDurationSeconds = 600; return value;
  });
  const state = { status: 'success', courses: selected().map(course => ({ id: course.id, status: 'missing', message: '공식 안내 시간 정보가 없어요.' })) };
  const card = timeCard(render(state, values));
  assert.doesNotMatch(card, /cart-metric-track|>10분<|9999|국립공원공단 코스 안내 ↗/);
  assert.match(card, /공식 안내 시간 정보가 없어요/);
  assert.match(card, /공식 안내 다시 불러오기/);
});

test('공식 안내 일부 실패는 성공한 코스의 시간과 링크를 유지하며 재시도를 제공한다', () => {
  const state = ready();
  state.courses[1] = { id: 'db-1', status: 'error', message: '공식 안내 정보를 불러오지 못했어요.' };
  const card = timeCard(render(state));
  assert.match(card, /1시간 30분/);
  assert.doesNotMatch(card, /2시간 40분/);
  assert.equal((card.match(/class="cart-metric-track"/g) ?? []).length, 2);
  assert.equal((card.match(/target="_blank"/g) ?? []).length, 2);
  assert.match(card, /공식 안내 다시 불러오기/);
});

test('로딩·미연결·전체 오류에서는 예시 시간을 숨기고 안내 상태를 표시한다', () => {
  for (const [state, message] of [
    [{ status: 'loading' }, '공식 안내 시간을 불러오는 중이에요.'],
    [{ status: 'unavailable', message: '공식 안내 미연결' }, '공식 안내 미연결'],
    [{ status: 'error', message: '공식 안내 조회 오류' }, '공식 안내 조회 오류'],
  ]) {
    const card = timeCard(render(state));
    assert.ok(card.includes(message));
    assert.doesNotMatch(card, /cart-metric-track|9999|1시간 30분/);
  }
});

test('안내와 현재 코스 버전이 다르면 해당 시간만 비우고 다시 조회하도록 안내한다', () => {
  const card = timeCard(render(ready(), [analysis(8, { currentCourseVersion: 2 }), analysis(1), analysis(10)]));
  assert.match(card, /코스 정보가 변경됐어요/);
  assert.doesNotMatch(card, /1시간 30분/);
  assert.match(card, /2시간 40분/);
  assert.equal((card.match(/class="cart-metric-track"/g) ?? []).length, 2);
  assert.match(card, /공식 안내 다시 불러오기/);
});
