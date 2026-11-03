import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer, loadEnv } from 'vite';
import { analysis, profile, noAnalysis } from './fixtures/course-analysis.mjs';
import { detailAnalysisView } from '../src/utils/courseDetailAnalysis.ts';

const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' });
after(() => server.close());
const { CourseAnalysis } = await server.ssrLoadModule('/src/pages/CourseDetailPage/components/CourseAnalysis.tsx');
const { CourseAnalysisStatus } = await server.ssrLoadModule('/src/pages/CourseDetailPage/components/CourseAnalysisStatus.tsx');
const { ComparisonAnalysisStatus } = await server.ssrLoadModule('/src/pages/CartPage/components/ComparisonAnalysisStatus.tsx');
const { ComparisonMetricsScreen } = await server.ssrLoadModule('/src/pages/CartPage/components/ComparisonMetricsScreen.tsx');
const { courseFixtures } = await server.ssrLoadModule('/src/api/courseMock.ts');
const { cartCatalog } = await server.ssrLoadModule('/src/pages/CartPage/catalog.ts');
const { loadCourseDetailData } = await server.ssrLoadModule('/src/api/courseDetailMock.ts');
const course = courseFixtures.find(c => c.id === 'bukhansan-baegundae');
const env = loadEnv('development', process.cwd(), 'VITE_');
const localAnalysisCourseId = Number(env.VITE_MOCK_BAEGUNDAE_ANALYSIS_COURSE_ID);
const localAnalysisMountainId = Number(env.VITE_MOCK_BAEGUNDAE_ANALYSIS_MOUNTAIN_ID);
const localAnalysisConfigured = Number.isSafeInteger(localAnalysisCourseId) && localAnalysisCourseId > 0
  && Number.isSafeInteger(localAnalysisMountainId) && localAnalysisMountainId > 0;
const data = { course: { ...course, distanceKm: 99, elevationGainMeters: 9999 }, spots: [] };
function render(state, selectedIndex = 0) {
  return renderToStaticMarkup(createElement(CourseAnalysis, {
    data, analysisState: state, analysisView: detailAnalysisView(data.course, state), onRetryAnalysis() {},
    reviews: [], reviewTotal: 0, visibility: { elevation: true, slope: true }, selectedIndex, onSelect() {}, onToggle() {},
  }));
}

test('상세 급경사 비율은 API 값을 반올림하고 서비스 계산 기준을 설명한다', () => {
  const value = analysis();
  value.metrics.steepSectionRatioPercent = 12.34567;
  value.settings.steepSlopeThresholdPercent = 20;
  value.settings.steepSlopeMethod = 'absolute_slope_gte_distance_weighted';
  const html = render({ status: 'success', data: { analysis: value, profile: profile(value).data, profileError: null } });
  assert.match(html, /급경사 12\.3%/);
  assert.match(html, /오르막·내리막 경사 절댓값 20% 이상/);
  assert.match(html, /경사를 계산할 수 없는 구간은 제외/);
  assert.doesNotMatch(html, /12\.34567%/);
});

function renderMetrics(thresholds) {
  const courses = cartCatalog.slice(0, 3);
  const analysisCourses = courses.map((course, index) => {
    const value = analysis(index + 1);
    value.settings.steepSlopeThresholdPercent = thresholds[index];
    value.settings.steepSlopeMethod = 'absolute_slope_gte_distance_weighted';
    value.metrics.steepSectionRatioPercent = [0, 12.34567, null][index];
    return { id: course.id, name: course.name, shortName: course.shortName, color: course.color,
      development: false, analysis: value, profile: null, profileError: null };
  });
  return renderToStaticMarkup(createElement(ComparisonMetricsScreen, {
    courses, analysisCourses, analysisState: { status: 'success', data: { mountainName: '북한산' } },
    onRetry() {}, onBack() {}, onCourseDetail() {}, onKeepCart() {}, onNavigate() {}, plannedHikes: [], onPlanHike() {},
  }));
}

test('비교표는 평균 경사 대신 급경사 비율을 표시하고 미계산 시간과 결측을 유지한다', () => {
  const html = renderMetrics([20, 20, 20]);
  assert.match(html, /급경사 비율 비교/);
  assert.doesNotMatch(html, /평균 경사 비교|12\.34567%/);
  assert.match(html, /0\.0%/);
  assert.match(html, /12\.3%/);
  assert.match(html, /경사 절댓값 20% 이상/);
  assert.equal((html.match(/class="cart-metric-track"/g) ?? []).length, 5);
});

test('서로 다른 급경사 기준은 안내하고 비교 막대로 같은 기준처럼 표시하지 않는다', () => {
  const html = renderMetrics([20, 30, 20]);
  assert.match(html, /급경사 기준이 다르거나 확인되지 않은/);
  assert.equal((html.match(/class="cart-metric-track"/g) ?? []).length, 3);
});

test('연결된 개발용 코스는 상세 진입 가능하고 비교·상세의 분석 연결은 같으며 시설 ID는 별도다', async () => {
  for (const [id, db] of [['bukhansan-baegundae', localAnalysisConfigured ? localAnalysisCourseId : 1], ['daenammun', 2], ['bibong', 3]]) {
    const item = courseFixtures.find(c => c.id === id);
    assert.equal(item.detailAvailable, true); assert.equal(item.analysisReference.courseId, db);
    assert.deepEqual(item.analysisReference, cartCatalog.find(c => c.id === id).analysisReference);
    const base = await loadCourseDetailData({ mountainId: 'bukhansan', courseId: id }, new AbortController().signal);
    assert.equal('samples' in base, false);
  }
  assert.equal(course.backendCourseId, 2);
  assert.equal(course.analysisReference.courseId, localAnalysisConfigured ? localAnalysisCourseId : 1);
  assert.equal(course.analysisReference.mountainId, localAnalysisConfigured ? localAnalysisMountainId : 1);
});

test('API 요약·반올림된 읽기 값·미확인 상태가 표시되고 기본 정보의 예시 지표는 섞이지 않는다', () => {
  const value = analysis(), stored = profile(value).data;
  stored.samples[1].slopePercent = -12.3456789;
  const html = render({ status: 'success', data: { analysis: value, profile: stored, profileError: null } }, 1);
  assert.match(html, /1\.50 km/); assert.match(html, /812\.3 m/); assert.match(html, /-12\.3%/);
  assert.match(html, /확인 필요/); assert.match(html, /실제 등산로 정보가 아니에요/);
  assert.doesNotMatch(html, /99\.00|9999|12\.3456789%/);
});

test('첫 경사의 null과 고도 결측을 0이나 문자열 null로 표시하지 않는다', () => {
  const value = analysis(), stored = profile(value).data;
  for (const index of [0, 2]) {
    const html = render({ status: 'success', data: { analysis: value, profile: stored, profileError: null } }, index);
    assert.match(html, /—/);
    assert.doesNotMatch(html, /null%|null m|약 null/);
  }
});

test('로딩·미연결·오류·NO_DATA는 예시 그래프 없이 상태와 재시도를 구분한다', () => {
  for (const [state, text] of [
    [{ status: 'loading' }, /불러오는 중/],
    [{ status: 'unavailable', message: '아직 연결되지 않았어요' }, /아직 연결되지/],
    [{ status: 'error', message: '서버 연결 실패' }, /분석 다시 불러오기/],
    [{ status: 'success', data: { analysis: noAnalysis(1), profile: null, profileError: null } }, /분석 없음/],
  ]) {
    const html = render(state);
    assert.match(html, text); assert.match(html, /표시할 분석 프로필이 없어요/);
    assert.doesNotMatch(html, /role="slider"|9999|99\.00/);
  }
});

test('이전 분석과 프로필 조회 실패를 현재 분석으로 오인하지 않게 표시한다', () => {
  const value = analysis(1, { qualityStatus: 'OUTDATED', currentCourseVersion: 2 });
  const html = render({ status: 'success', data: { analysis: value, profile: null, profileError: '조회 실패' } });
  assert.match(html, /이전 분석/); assert.match(html, /현재 코스 v2/); assert.match(html, /분석 코스 v1/);
  assert.match(html, /프로필을 불러오지 못/); assert.match(html, /분석 다시 불러오기/);
});

test('실제 후보 경로의 단위 가정은 접힌 상세 상태 바깥에 표시하고 예시 경로로 바꾸지 않는다', () => {
  for (const qualityStatus of ['PARTIAL', 'OUTDATED', 'NO_DATA']) {
    const value = analysis(1, { sourceKind: 'unknown', qualityStatus, qualityReasons: ['ASSUMED_ELEVATION_UNIT'] });
    value.settings.elevationUnitSource = 'assumed';
    const html = renderToStaticMarkup(createElement(CourseAnalysisStatus, {
      state: { status: 'success', data: { analysis: value, profile: null, profileError: null } },
      development: false, onRetry() {},
    }));
    const visible = html.slice(0, html.indexOf('<details'));
    assert.match(visible, /m로 가정한 분석/);
    assert.match(visible, /검증 전 수치/);
    assert.doesNotMatch(html, /개발용 예시 경로|실제 등산로 정보가 아니/);
  }
});

test('비교 화면은 m·ft 가정을 코스별로 접힌 상태 바깥에 표시하고 확인된 코스는 구분한다', () => {
  const courses = ['대남문', '비봉', '백운대'].map((name, index) => {
    const value = analysis(index + 1, { sourceKind: 'unknown' });
    value.settings.elevationUnitSource = index < 2 ? 'assumed' : 'raster_metadata';
    value.settings.elevationUnit = index === 1 ? 'ft' : 'm';
    return { id: String(index), name, shortName: name, analysis: value, development: false, profileError: null };
  });
  const html = renderToStaticMarkup(createElement(ComparisonAnalysisStatus, {
    state: { status: 'success', data: {} }, courses, onRetry() {},
  }));
  const visible = html.slice(0, html.indexOf('<details'));
  assert.match(visible, /대남문<\/strong> · 원본 고도 단위를 m로 가정/);
  assert.match(visible, /비봉<\/strong> · 원본 고도 단위를 ft로 가정해 m로 환산/);
  assert.doesNotMatch(visible, /백운대/);
  assert.equal((visible.match(/검증 전 수치/g) ?? []).length, 2);
  assert.doesNotMatch(html, /개발용 예시 경로/);
});

test('비교하는 세 코스의 가정이 같으면 코스명을 묶어 안내를 한 번만 표시한다', () => {
  const courses = ['대남문', '비봉', '백운대'].map((name, index) => {
    const value = analysis(index + 1);
    value.settings.elevationUnitSource = 'assumed';
    return { id: String(index), name, shortName: name, analysis: value, development: false, profileError: null };
  });
  const html = renderToStaticMarkup(createElement(ComparisonAnalysisStatus, {
    state: { status: 'success', data: {} }, courses, onRetry() {},
  }));
  const visible = html.slice(0, html.indexOf('<details'));
  assert.match(visible, /대남문 · 비봉 · 백운대<\/strong>/);
  assert.equal((visible.match(/검증 전 수치/g) ?? []).length, 1);
});
