import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as chartCore from 'echarts/core';
import * as chartTypes from 'echarts/charts';
import * as chartComponents from 'echarts/components';
import * as chartFeatures from 'echarts/features';
import * as chartRenderers from 'echarts/renderers';
import * as profileUtils from '../src/utils/courseProfile.ts';
import * as analysisUtils from '../src/utils/courseDetailAnalysis.ts';
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

test('상세의 급경사 비중은 등급만 표시하고 첨부된 설명과 분석 상태는 표시하지 않는다', () => {
  const value = analysis();
  value.metrics.steepSectionRatioPercent = 12.34567;
  value.settings.steepSlopeThresholdPercent = 20;
  value.settings.steepSlopeMethod = 'absolute_slope_gte_distance_weighted';
  const html = render({ status: 'success', data: { analysis: value, profile: profile(value).data, profileError: null } });
  assert.match(html, /급경사 비중 하/);
  assert.doesNotMatch(html, /급경사 12\.3%|12\.34567%|분석 상태 ·|현재 코스 v|급경사 비율은/);
});

function renderMetrics(thresholds, ratios = [0, 12.34567, null]) {
  const courses = cartCatalog.slice(0, 3);
  const analysisCourses = courses.map((course, index) => {
    const value = analysis(index + 1);
    value.settings.steepSlopeThresholdPercent = thresholds[index];
    value.settings.steepSlopeMethod = 'absolute_slope_gte_distance_weighted';
    value.metrics.steepSectionRatioPercent = ratios[index];
    return { id: course.id, name: course.name, shortName: course.shortName, color: course.color,
      development: false, analysis: value, profile: null, profileError: null };
  });
  return renderToStaticMarkup(createElement(ComparisonMetricsScreen, {
    courses, analysisCourses, analysisState: { status: 'success', data: { mountainName: '북한산' } },
    onRetry() {}, onBack() {}, onCourseDetail() {}, onKeepCart() {}, onNavigate() {}, plannedHikes: [], onPlanHike() {},
  }));
}

test('비교표의 급경사 카드는 등급만 표시하고 퍼센트·숫자·비율 막대를 제거한다', () => {
  const html = renderMetrics([20, 20, 20]);
  const card = html.match(/<section class="cart-metric-card" aria-label="급경사 비중 비교">[\s\S]*?<\/section>/)?.[0];
  assert.ok(card);
  assert.equal((card.match(/data-steep-grade="하"/g) ?? []).length, 2);
  assert.match(card, /data-steep-grade="—"/);
  assert.doesNotMatch(card, /%|cart-metric-track|30|60/);
  assert.equal((html.match(/class="cart-metric-track"/g) ?? []).length, 3);
});

test('두세 코스의 상중하 경계와 결측을 독립적으로 표시하고 기준이 다르면 등급 비교를 만들지 않는다', () => {
  const html = renderMetrics([20, 20, 20], [29.99, 30, 60]);
  for (const grade of ['하', '중', '상']) assert.match(html, new RegExp(`data-steep-grade="${grade}"`));
  const incompatible = renderMetrics([20, 30, 20], [10, 50, 90]);
  assert.equal((incompatible.match(/data-steep-grade="—"/g) ?? []).length, 3);
  assert.doesNotMatch(incompatible, /data-steep-grade="[상중하]"/);
});

test('상세는 50m 평균·원본 전환과 방향·퍼센트·결측 해석을 제공하며 원본 선택 값을 보존한다', () => {
  const value = analysis(), stored = profile(value).data;
  value.settings.steepSlopeThresholdPercent = 30;
  value.settings.steepSlopeMethod = 'absolute_slope_gte_distance_weighted';
  stored.samples[1].slopePercent = -12.3456789;
  const html = render({ status: 'success', data: { analysis: value, profile: stored, profileError: null } }, 1);
  for (const label of ['50m 평균', '선택 위치 원본 경사', '경사 그래프 읽는 법', '+ 오르막', '− 내리막', '각도 20°와 달라요', '점선 ±30%', '짧은 급경사는 원본으로']) assert.ok(html.includes(label), label);
  assert.match(html, /aria-pressed="true"[^>]*>50m 평균/);
  assert.match(html, /-12\.3%/);
  assert.match(html, /course-profile-chart--stacked/);
});

function renderProfileChart(samples, highlightedSections, options = {}) {
  const source = readFileSync(new URL('../src/components/chart/CourseProfileChart.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  chartCore.use([chartTypes.LineChart, chartTypes.ScatterChart, chartComponents.AriaComponent,
    chartComponents.GridComponent, chartComponents.MarkLineComponent, chartComponents.TitleComponent,
    chartComponents.VisualMapPiecewiseComponent, chartFeatures.LabelLayout, chartRenderers.SVGRenderer]);
  const sections = analysisUtils.summarizeProfileSlope(samples);
  const size = { width: options.width ?? 350, height: 360 };
  const chart = chartCore.init(null, null, { renderer: 'svg', ssr: true, ...size });
  const resize = chart.resize.bind(chart);
  // SSR에는 크기를 재측정할 DOM이 없으므로 컴포넌트의 resize도 지정 크기를 사용한다.
  chart.resize = () => resize(size);
  const effects = [];
  let refIndex = 0;
  const modules = {
    react: { useMemo: f => f(), useRef: value => ({ current: refIndex++ === 0 ? {} : value }),
      useEffect: effect => effects.push(effect) },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'echarts/core': { ...chartCore, init: () => chart }, 'echarts/charts': chartTypes,
    'echarts/components': chartComponents, 'echarts/features': chartFeatures, 'echarts/renderers': chartRenderers,
    '../../utils/courseProfile': profileUtils, '../../utils/courseDetailAnalysis': analysisUtils,
  };
  const context = vm.createContext({ exports: {}, require: name => {
    assert.ok(name in modules, name); return modules[name];
  }, ResizeObserver: class { observe() {} disconnect() {} } });
  try {
    vm.runInContext(compiled, context);
    context.exports.CourseProfileChart({ samples, visibility: { elevation: true, slope: true }, selectedIndex: 0,
      onSelect() {}, slopeMode: 'summary', slopeSections: sections, steepThreshold: 20, highlightedSections, ...options });
    effects.forEach(effect => effect());
    return { svg: chart.renderToSVGString(), option: chart.getOption() };
  } finally { chart.dispose(); }
}

test('실제 차트 SVG의 고도 선은 강조 범위 색상을 사용하고 강조가 없으면 원래 녹색을 유지한다', () => {
  const samples = [0, 1, 2, 3, 4].map(i => ({ distanceKm: i * .05, elevationMeters: 100 + i * 10,
    slopePercent: i ? 20 : null, coordinate: [127, 37] }));
  const top = analysisUtils.topSteepProfileSections(analysisUtils.summarizeProfileSlope(samples), 20);
  const { svg: highlighted, option } = renderProfileChart(samples, top);
  const gradient = [...highlighted.matchAll(/<linearGradient\b[^>]*id="([^"]+)"[^>]*>[\s\S]*?<\/linearGradient>/g)]
    .find(match => match[0].includes('#c44f2c'));
  assert.ok(gradient, '급경사 색상이 포함된 고도 gradient');
  assert.ok(highlighted.includes(`stroke="url(#${gradient[1]})"`), '고도 선이 실제로 해당 gradient를 사용');
  const highlight = option.series.find(series => series.id === 'steep-highlight');
  const outline = option.series.find(series => series.id === 'steep-outline');
  assert.equal(highlight.lineStyle.width, 5);
  assert.ok(outline.lineStyle.width > highlight.lineStyle.width);
  assert.match(highlighted, /stroke="#c44f2c" stroke-width="5"/);
  assert.ok(option.series.find(series => series.id === 'elevation-selection').z > highlight.z);
  const { svg: plain, option: plainOption } = renderProfileChart(samples, []);
  assert.doesNotMatch(plain, /#c44f2c/);
  assert.match(plain, /stroke="#19765b"/);
  assert.equal(plainOption.series.some(series => series.id === 'steep-ranks'), false);
});

test('긴 코스의 인접한 50m 강조 세 곳은 좁은 SVG에서도 번호가 겹치지 않고 모드와 선택을 유지한다', () => {
  const samples = Array.from({ length: 511 }, (_, i) => ({ distanceKm: i / 100, elevationMeters: 100 + i,
    slopePercent: i ? 20 : null, coordinate: [127, 37] }));
  const sections = [{ startKm: 2.2, endKm: 2.25, slopePercent: 60 },
    { startKm: 2.25, endKm: 2.3, slopePercent: -50 }, { startKm: 2.3, endKm: 2.35, slopePercent: 40 }];
  for (const width of [280, 350]) for (const slopeMode of ['summary', 'raw']) {
    const { svg, option } = renderProfileChart(samples, sections, { width, slopeMode, selectedIndex: 225 });
    const ranks = [...svg.matchAll(/<text\b([^>]*)>([123])<\/text>/g)].filter(match => match[1].includes('fill="#fff"'));
    assert.deepEqual(ranks.map(match => match[2]).sort(), ['1', '2', '3']);
    const centers = ranks.map(match => {
      const translation = match[1].match(/translate\(([-\d.]+) ([-\d.]+)\)/).slice(1).map(Number);
      return [translation[0] + Number(match[1].match(/\bx="([-\d.]+)"/)?.[1] ?? 0),
        translation[1] + Number(match[1].match(/\by="([-\d.]+)"/)?.[1] ?? 0)];
    });
    for (let i = 0; i < centers.length; i++) {
      assert.ok(centers[i][0] >= 13 && centers[i][0] <= width - 13);
      for (let j = i + 1; j < centers.length; j++) {
        assert.ok(Math.abs(centers[i][0] - centers[j][0]) >= 24 || Math.abs(centers[i][1] - centers[j][1]) >= 24,
          `번호 겹침: ${width}px, ${slopeMode}, ${JSON.stringify(centers)}`);
      }
    }
    const selected = option.series.find(series => series.id === 'elevation-selection');
    assert.deepEqual(selected.data, [[samples[225].distanceKm, samples[225].elevationMeters]]);
    const ranges = option.visualMap.find(map => map.dimension === 0).pieces;
    assert.deepEqual(ranges.map(range => [range.gte, range.lt]), sections.map(section => [section.startKm, section.endKm]));
  }
  const slopeOnly = renderProfileChart(samples, sections, { visibility: { elevation: false, slope: true } });
  assert.equal(slopeOnly.option.series.some(series => series.id === 'steep-ranks'), false);
});

test('강조 경계는 원본 선 위에서 보간하고 고도 결측은 연결하거나 번호로 만들지 않는다', () => {
  const samples = [0, 1, 2, 3, 4].map(i => ({ distanceKm: i * .05, elevationMeters: i === 2 ? null : 100 + i * 10,
    slopePercent: i ? 20 : null, coordinate: [127, 37] }));
  const { option } = renderProfileChart(samples, [{ startKm: .025, endKm: .175, slopePercent: 20 }]);
  const highlight = option.series.find(series => series.id === 'steep-highlight');
  assert.deepEqual(highlight.data, [[.025, 105], [.05, 110], [.1, null], [.15000000000000002, 130], [.175, 135], [.175, null]]);
  assert.equal(highlight.connectNulls, false);
  const missing = renderProfileChart(samples.map(point => ({ ...point, elevationMeters: null })),
    [{ startKm: 0, endKm: .05, slopePercent: 20 }]);
  assert.equal(missing.option.series.find(series => series.id === 'steep-ranks').data.length, 0);
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

test('API 요약·반올림된 원본 읽기 값과 개발용 경로 표시는 유지하고 삭제한 분석 상세는 숨긴다', () => {
  const value = analysis(), stored = profile(value).data;
  stored.samples[1].slopePercent = -12.3456789;
  const html = render({ status: 'success', data: { analysis: value, profile: stored, profileError: null } }, 1);
  assert.match(html, /1\.50 km/); assert.match(html, /812\.3 m/); assert.match(html, /-12\.3%/);
  assert.doesNotMatch(html, /분석 상태 ·|확인 필요/); assert.match(html, /실제 등산로 정보가 아니에요/);
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
    [{ status: 'success', data: { analysis: noAnalysis(1), profile: null, profileError: null } }, /표시할 분석 프로필이 없어요/],
  ]) {
    const html = render(state);
    assert.match(html, text); assert.match(html, /표시할 분석 프로필이 없어요/);
    assert.doesNotMatch(html, /role="slider"|9999|99\.00/);
  }
});

test('프로필 조회 실패와 재시도를 유지하고 삭제한 버전·분석 상세를 다시 표시하지 않는다', () => {
  const value = analysis(1, { qualityStatus: 'OUTDATED', currentCourseVersion: 2 });
  const html = render({ status: 'success', data: { analysis: value, profile: null, profileError: '조회 실패' } });
  assert.doesNotMatch(html, /이전 분석|현재 코스 v2|분석 코스 v1/);
  assert.match(html, /프로필을 불러오지 못/); assert.match(html, /분석 다시 불러오기/);
});

test('실제 코스의 성공 상태 설명을 제거해도 API 단위·품질 정보 자체는 유지한다', () => {
  for (const qualityStatus of ['PARTIAL', 'OUTDATED', 'NO_DATA']) {
    const value = analysis(1, { sourceKind: 'unknown', qualityStatus, qualityReasons: ['ASSUMED_ELEVATION_UNIT'] });
    value.settings.elevationUnitSource = 'assumed';
    const html = renderToStaticMarkup(createElement(CourseAnalysisStatus, {
      state: { status: 'success', data: { analysis: value, profile: null, profileError: null } },
      development: false, onRetry() {},
    }));
    assert.equal(html, '');
    assert.equal(value.settings.elevationUnitSource, 'assumed');
    assert.equal(value.qualityStatus, qualityStatus);
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
