import assert from 'node:assert/strict';
import test from 'node:test';
import { courseComparisonUrl, loadCourseComparison, parseCourseAnalysis, parseCourseAnalysisProfile, parseCourseComparison } from '../src/api/courseAnalysis.ts';
import { analysisQualityReasons, comparisonCourseViews, comparisonRequest, developmentAnalysisReference,
  elevationAxisBounds, formatAnalysisDistance, formatAnalysisDuration } from '../src/utils/courseComparison.ts';
import { analysis, noAnalysis, comparison, profile } from './fixtures/course-analysis.mjs';

test('개발용 코스 연결은 시드 번호를 사용하고 운영 환경에는 연결하지 않는다', () => {
  assert.deepEqual(developmentAnalysisReference('bukhansan-baegundae', 'bukhansan', true), { courseId: 1, mountainId: 1, development: true });
  assert.equal(developmentAnalysisReference('bukhansan-baegundae', 'bukhansan', false), undefined);
  assert.equal(developmentAnalysisReference('unmapped', 'bukhansan', true), undefined);
  const courses = [1, 2, 3].map(id => ({ id: String(id), analysisReference: { courseId: id, mountainId: 1, development: true } }));
  assert.deepEqual(comparisonRequest(courses), { connected: true, courseIds: [1, 2, 3], mountainId: 1 });
  for (const invalid of [[], courses.slice(0, 1), [...courses, { ...courses[0], id: '4' }],
    [courses[0], courses[0]], [courses[0], { id: 'missing' }],
    [courses[0], { ...courses[1], analysisReference: { courseId: 1, mountainId: 1 } }],
    [courses[0], { ...courses[1], analysisReference: { courseId: 2, mountainId: 2 } }]]) {
    assert.equal(comparisonRequest(invalid).connected, false);
  }
});

test('2~3개의 양의 안전한 정수 ID를 요청한 순서로 전송한다', () => {
  assert.equal(courseComparisonUrl([3, 1], 'http://localhost:8080/'), 'http://localhost:8080/api/v1/course-comparisons?courseIds=3%2C1');
  for (const ids of [[], [1], [1, 1], [1, 2, 3, 4], [0, 1], [-1, 2], [1.5, 2], [NaN, 2], [Number.MAX_SAFE_INTEGER + 1, 2]]) {
    assert.throws(() => courseComparisonUrl(ids));
  }
});

test('요청 순서·산·코스·버전의 계약을 검증하고 NO_DATA와 OUTDATED를 보존한다', () => {
  const payload = comparison([analysis(3, { qualityStatus: 'OUTDATED', currentCourseVersion: 2 }), noAnalysis(2), analysis(1)]);
  const result = parseCourseComparison(payload, [3, 2, 1]);
  assert.deepEqual(result.courses.map(c => c.courseId), [3, 2, 1]);
  assert.equal(result.courses[0].analysis.analyzedCourseVersion, 1);
  assert.equal(result.courses[1].analysis.metrics.distanceMeters, null);
  assert.equal(result.courses[1].analysis.profileUrl, null);
  for (const mutate of [p => p.data.courses.reverse(), p => p.data.courses.pop(),
    p => { p.data.courses[0].analysis.mountainId = 2; }, p => { p.data.courses[0].analysis.courseId = 9; },
    p => { p.data.courses[0].currentCourseVersion = 10; }, p => { p.success = false; }]) {
    const invalid = structuredClone(payload); mutate(invalid); assert.throws(() => parseCourseComparison(invalid, [3, 2, 1]));
  }
});

test('미확정 수치는 null로 보존하고 음수 고도·0 상승량을 허용한다', () => {
  const value = analysis(); value.metrics.minElevationMeters = -30;
  assert.equal(parseCourseAnalysis(value).metrics.elevationLossMeters, 0);
  assert.equal(parseCourseAnalysis(value).metrics.estimatedDurationSeconds, null);
  for (const mutate of [p => { p.metrics.elevationGainMeters = -1; }, p => { p.metrics.distanceMeters = Infinity; },
    p => { delete p.metrics.maxElevationMeters; }, p => { p.metrics.steepSectionRatioPercent = 101; },
    p => { p.coverage.sampleCoveragePercent = -1; }, p => { p.qualityStatus = 'unknown'; },
    p => { p.profileUrl = 'https://another-host.example/profile'; }, p => { p.calculatedAt = 'today'; }]) {
    const invalid = structuredClone(value); mutate(invalid); assert.throws(() => parseCourseAnalysis(invalid));
  }
  const invalid = noAnalysis(); invalid.metrics.distanceMeters = 0;
  assert.throws(() => parseCourseAnalysis(invalid));
});

test('프로필은 동일 분석 ID·버전·설정·수치이며, 좌표와 결측을 그대로 보존한다', () => {
  const expected = analysis();
  const payload = profile(expected);
  const result = parseCourseAnalysisProfile(payload, expected);
  assert.deepEqual(result.samples[1].coordinate, payload.data.samples[1].coordinate);
  assert.equal(result.samples[0].slopePercent, null);
  assert.equal(result.samples[2].elevationMeters, null);
  assert.equal(result.samples[3].slopePercent, null);
  // JSON 객체의 필드 순서는 데이터의 동일성을 바꾸지 않는다.
  const reordered = profile(expected);
  reordered.data.analysis.settings = Object.fromEntries(Object.entries(expected.settings).reverse());
  assert.equal(parseCourseAnalysisProfile(reordered, expected).samples.length, 4);
  for (const mutate of [p => { p.data.analysis.analysisId = 999; }, p => { p.data.analysis.currentCourseVersion = 2; },
    p => { p.data.analysis.settings.sampleIntervalMeters = 10; }, p => { p.data.analysis.metrics.elevationGainMeters = 5; },
    p => { p.data.samples[1].coordinate = [181, 37]; }, p => { p.data.samples[1].distanceMeters = 0; },
    p => { p.data.samples[0].slopePercent = 0; }, p => { p.data.samples[3].distanceMeters = 2000; },
    p => { p.data.samples[1].sampleIndex = 10; }, p => { p.data.samples[1].elevationMeters = Infinity; },
    p => { p.data.samples.pop(); }]) {
    const invalid = profile(expected); mutate(invalid); assert.throws(() => parseCourseAnalysisProfile(invalid, expected));
  }
});

test('NO_DATA에도 저장된 분석이 있으면 경로와 빈 고도 프로필을 읽을 수 있다', () => {
  const value = analysis(1, { qualityStatus: 'NO_DATA', recordedQualityStatus: 'NO_DATA' });
  Object.assign(value.metrics, { minElevationMeters: null, maxElevationMeters: null, elevationGainMeters: null, elevationLossMeters: null });
  const payload = profile(value);
  payload.data.samples.forEach(p => { p.elevationMeters = null; p.slopePercent = null; p.sampleStatus = 'OUTSIDE_DEM'; });
  assert.equal(parseCourseAnalysisProfile(payload, value).samples.length, 4);
});

test('분석 유무에 따라 프로필 요청을 생략하고 불변 분석 ID 주소만 조회한다', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url); assert.equal(options.cache, 'no-store'); assert.deepEqual(options.headers, { Accept: 'application/json' });
    const payload = url.includes('course-comparisons?') ? comparison() : profile(analysis(url.includes('/103/') ? 3 : 1,
      url.includes('/103/') ? { qualityStatus: 'OUTDATED', currentCourseVersion: 2 } : {}));
    return new Response(JSON.stringify(payload));
  };
  const result = await loadCourseComparison([1, 2, 3]);
  assert.equal(calls.length, 3);
  assert.ok(calls.some(url => url.endsWith('/101/profile')));
  assert.ok(!calls.some(url => url.endsWith('/102/profile')));
  assert.equal(result.courses[1].profile, null);
  assert.equal(result.courses[2].analysis.qualityStatus, 'OUTDATED');
});

test('프로필 한 건 실패는 해당 경로만 비우고 다른 코스의 실제 결과를 유지한다', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async url => url.includes('/103/profile') ? new Response('', { status: 503 })
    : new Response(JSON.stringify(url.includes('course-comparisons?') ? comparison() : profile()));
  const result = await loadCourseComparison([1, 2, 3]);
  assert.equal(result.courses[0].profile.samples.length, 4);
  assert.equal(result.courses[2].profile, null);
  assert.match(result.courses[2].profileError, /불러오지 못/);
});

test('요약 오류·잘못된 JSON·네트워크 오류를 예시 분석으로 대체하지 않는다', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  for (const [status, pattern] of [[400, /같은 산/], [404, /찾을 수/], [503, /불러오지 못/]]) {
    globalThis.fetch = async () => new Response('', { status });
    await assert.rejects(loadCourseComparison([1, 2]), pattern);
  }
  globalThis.fetch = async () => new Response('broken-json');
  await assert.rejects(loadCourseComparison([1, 2]), /올바르지/);
  globalThis.fetch = async () => { throw new TypeError('network'); };
  await assert.rejects(loadCourseComparison([1, 2]), /연결할 수/);
});

test('조회 시간 초과와 화면 이탈 취소를 구분하고 취소 후 결과를 반환하지 않는다', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  });
  await assert.rejects(loadCourseComparison([1, 2], { timeoutMs: 1 }), /응답이 늦어/);
  const controller = new AbortController();
  const pending = loadCourseComparison([1, 2], { signal: controller.signal }); controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  globalThis.fetch = () => { assert.fail('이미 취소한 요청'); };
  await assert.rejects(loadCourseComparison([1, 2], { signal: controller.signal }), error => error.name === 'AbortError');
});

test('지도와 차트는 같은 프로필을 사용하고 오류·미연결 시 mock 수치를 섞지 않는다', () => {
  const courses = ['bukhansan-baegundae', 'daenammun'].map(id => ({
    id, name: '예시 이름', shortName: '예시', color: '#000', analysisReference: developmentAnalysisReference(id, 'bukhansan', true),
    distanceKm: 99, elevationProfile: [{ distanceKm: 99, elevationMeters: 9999 }],
  }));
  const payload = comparison([analysis(), noAnalysis()]).data;
  const stored = parseCourseAnalysisProfile(profile(), analysis());
  const views = comparisonCourseViews(courses, { status: 'success', data: { ...payload,
    courses: payload.courses.map(c => ({ ...c, profile: c.courseId === 1 ? stored : null, profileError: null })) } });
  assert.equal(views[0].name, '백운대 코스');
  assert.equal(views[0].profile, stored);
  assert.equal(views[0].analysis.metrics.distanceMeters, 1500);
  assert.equal(views[1].analysis.metrics.distanceMeters, null);
  assert.equal(views[1].profile, null);
  for (const state of [{ status: 'loading' }, { status: 'error', message: '오류' }, { status: 'unavailable', message: '미연결' }]) {
    assert.ok(comparisonCourseViews(courses, state).every(c => c.analysis === null && c.profile === null));
  }
});

test('표시 단위만 변환하며 null과 0을 구분하고 품질 사유를 유지한다', () => {
  assert.equal(formatAnalysisDistance(1197.35), '1.2 km');
  assert.equal(formatAnalysisDistance(0), '0 km');
  assert.equal(formatAnalysisDistance(null), '—');
  assert.equal(formatAnalysisDuration(null), '—');
  assert.equal(formatAnalysisDuration(0), '0분');
  assert.equal(formatAnalysisDuration(3601), '1시간 1분');
  const reasons = analysisQualityReasons(analysis(1, { qualityStatus: 'OUTDATED' }));
  assert.ok(reasons.some(r => r.includes('현재 경로와 다른')));
  assert.ok(reasons.some(r => r.includes('수직 기준')));
});

test('긴 코스·800m 초과·해수면 아래·평평한 프로필과 큰 샘플 수를 축 범위에 반영한다', () => {
  const series = [{ points: [{ distanceKm: 0, elevationMeters: -30 }, { distanceKm: 10.8, elevationMeters: 1300 },
    { distanceKm: 11, elevationMeters: null }] }];
  const bounds = elevationAxisBounds(series);
  assert.equal(bounds.distanceMax, 11);
  assert.ok(bounds.elevationMin < -30 && bounds.elevationMax > 1300);
  const flat = elevationAxisBounds([{ points: [{ distanceKm: 0, elevationMeters: 0 }] }]);
  assert.ok(flat.elevationMax > flat.elevationMin);
  const many = elevationAxisBounds([{ points: Array.from({ length: 100_000 }, (_, i) => ({ distanceKm: i / 1000, elevationMeters: 10 })) }]);
  assert.ok(many.distanceMax >= 99.999);
  assert.equal(elevationAxisBounds([{ points: [{ distanceKm: 1.5, elevationMeters: null }] }]).distanceMax, 1.5);
});
