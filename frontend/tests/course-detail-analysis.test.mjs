import assert from 'node:assert/strict';
import test from 'node:test';
import { courseAnalysisUrl, loadCourseAnalysis, parseCourseAnalysisProfile } from '../src/api/courseAnalysis.ts';
import { detailAnalysisView, courseProfileAxes, formatProfileValue } from '../src/utils/courseDetailAnalysis.ts';
import { developmentAnalysisReference } from '../src/utils/courseComparison.ts';
import { analysis, noAnalysis, profile, envelope, fullCoverageAnalysis, fullCoverageProfile } from './fixtures/course-analysis.mjs';

const reference = { courseId: 1, mountainId: 1, development: true };
const course = { id: 'bukhansan-baegundae', analysisReference: reference, backendCourseId: 2,
  distanceKm: 99, peakElevationMeters: 9999, routeCoordinates: [[0, 0], [1, 1]] };
const originalFetch = globalThis.fetch;
function intercept(t, handler) {
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = handler;
}
const json = data => new Response(JSON.stringify(data));

test('단일 요약 주소는 양의 안전한 정수만 받으며 API base의 끝 슬래시를 정리한다', () => {
  assert.equal(courseAnalysisUrl(1, 'http://localhost:8080///'), 'http://localhost:8080/api/v1/courses/1/analysis');
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null]) assert.throws(() => courseAnalysisUrl(id));
});

test('시설용 ID 대신 분석용 ID로 조회하고 같은 분석 ID의 원본 프로필을 읽는다', async t => {
  const calls = [];
  intercept(t, async (url, options) => {
    calls.push(url); assert.equal(options.cache, 'no-store');
    assert.deepEqual(options.headers, { Accept: 'application/json' });
    return json(url.endsWith('/analysis') ? envelope(analysis()) : profile());
  });
  const result = await loadCourseAnalysis(course.analysisReference);
  assert.deepEqual(calls, ['http://localhost:8080/api/v1/courses/1/analysis', 'http://localhost:8080/api/v1/course-analyses/101/profile']);
  assert.equal(result.analysis.courseId, 1);
  assert.equal(result.profile.samples.length, 4);
  assert.equal(result.profileError, null);
});

test('산·코스 ID가 다른 응답과 잘못된 요청은 프로필 조회 전에 거절한다', async t => {
  let count = 0;
  intercept(t, async () => { count++; return json(envelope(analysis(2))); });
  await assert.rejects(loadCourseAnalysis(reference), /산·코스/);
  assert.equal(count, 1);
  intercept(t, async () => json(envelope(analysis(1, { mountainId: 2 }))));
  await assert.rejects(loadCourseAnalysis(reference), /산·코스/);
  intercept(t, async () => assert.fail('유효하지 않은 연결은 요청하지 않는다'));
  await assert.rejects(loadCourseAnalysis({ ...reference, courseId: 0 }));
  await assert.rejects(loadCourseAnalysis({ ...reference, mountainId: -1 }));
});

test('분석 미존재는 NO_DATA로 보존하며 프로필 요청을 생략한다', async t => {
  let count = 0;
  intercept(t, async () => { count++; return json(envelope(noAnalysis(1))); });
  const loaded = await loadCourseAnalysis(reference);
  assert.equal(count, 1); assert.equal(loaded.analysis.qualityStatus, 'NO_DATA');
  assert.equal(loaded.profile, null);
  const view = detailAnalysisView(course, { status: 'success', data: loaded });
  assert.deepEqual(view.samples, []); assert.deepEqual(view.routeCoordinates, []);
  assert.equal(view.analysis.metrics.distanceMeters, null);
});

test('PARTIAL·OUTDATED와 분석 버전·설정을 요약과 프로필에 유지한다', async t => {
  for (const qualityStatus of ['PARTIAL', 'OUTDATED']) {
    const value = analysis(1, { qualityStatus, currentCourseVersion: qualityStatus === 'OUTDATED' ? 2 : 1 });
    intercept(t, async url => json(url.endsWith('/analysis') ? envelope(value) : profile(value)));
    const loaded = await loadCourseAnalysis(reference);
    assert.equal(loaded.profile.analysis.qualityStatus, qualityStatus);
    assert.equal(loaded.profile.analysis.analyzedCourseVersion, 1);
    assert.equal(loaded.analysis.settings.verticalReference, null);
  }
});

test('프로필 실패·다른 분석 ID·버전 응답은 요약을 유지하고 경로만 비운다', async t => {
  for (const reply of [() => new Response('', { status: 503 }), () => json(profile(analysis(2))),
    () => json(profile(analysis(1, { currentCourseVersion: 2 })))]) {
    intercept(t, async url => url.endsWith('/analysis') ? json(envelope(analysis())) : reply());
    const loaded = await loadCourseAnalysis(reference);
    assert.equal(loaded.analysis.analysisId, 101); assert.equal(loaded.profile, null); assert.ok(loaded.profileError);
    assert.deepEqual(detailAnalysisView(course, { status: 'success', data: loaded }).routeCoordinates, []);
  }
});

test('HTTP·JSON·네트워크 오류 시 예시 분석으로 대체하지 않는다', async t => {
  for (const handler of [async () => new Response('', { status: 400 }), async () => new Response('', { status: 404 }), async () => new Response('', { status: 503 }),
    async () => new Response('invalid-json'), async () => { throw new TypeError('network'); }]) {
    intercept(t, handler); await assert.rejects(loadCourseAnalysis(reference));
  }
});

test('단일 조회의 시간 초과·화면 이탈 취소 후 이전 결과를 반환하지 않는다', async t => {
  intercept(t, (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  }));
  await assert.rejects(loadCourseAnalysis(reference, { timeoutMs: 1 }), /응답이 늦어/);
  const controller = new AbortController();
  const pending = loadCourseAnalysis(reference, { signal: controller.signal }); controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
});

test('617개 실제 산출물 형태와 100% 경계 오차를 단일 상세에서도 읽는다', async t => {
  const value = fullCoverageAnalysis(2);
  intercept(t, async url => json(url.endsWith('/analysis') ? envelope(value) : fullCoverageProfile(value)));
  const loaded = await loadCourseAnalysis({ ...reference, courseId: 2 });
  assert.equal(loaded.profile.samples.length, 617);
  assert.equal(loaded.analysis.coverage.distanceCoveragePercent, 100);
});

test('지도·그래프는 같은 샘플 좌표를 사용하며 결측·음수 경사·원본 정밀도를 보존한다', () => {
  const payload = profile(); payload.data.samples[1].slopePercent = -12.3456789;
  const stored = parseCourseAnalysisProfile(payload, analysis());
  const view = detailAnalysisView(course, { status: 'success', data: { analysis: stored.analysis, profile: stored, profileError: null } });
  assert.equal(view.samples[1].distanceKm, 0.5);
  assert.equal(view.samples[1].slopePercent, -12.3456789);
  assert.equal(view.samples[2].elevationMeters, null);
  assert.equal(view.samples[0].slopePercent, null);
  assert.deepEqual(view.routeCoordinates, stored.samples.map(s => s.coordinate));
  assert.equal(view.samples[1].coordinate, stored.samples[1].coordinate);
  assert.equal(view.development, true);
  for (const state of [{ status: 'loading' }, { status: 'error', message: '실패' }, { status: 'unavailable', message: '미연결' }]) {
    const empty = detailAnalysisView(course, state);
    assert.deepEqual(empty.samples, []); assert.deepEqual(empty.routeCoordinates, []); assert.equal(empty.analysis, null);
  }
});

test('거리 2자리·고도/경사 1자리로 표시하며 결측과 0·음수를 구별한다', () => {
  assert.equal(formatProfileValue(1.23456789, 'km', 2), '1.23 km');
  assert.equal(formatProfileValue(812.250997, 'm'), '812.3 m');
  assert.equal(formatProfileValue(-12.3456789, '%'), '-12.3%');
  assert.equal(formatProfileValue(0, '%'), '0.0%');
  for (const value of [null, undefined, NaN, Infinity]) assert.equal(formatProfileValue(value, 'm'), '—');
});

test('내리막·고도 음수·평평한 구간·전체 결측에 대해 유효한 축 범위를 구한다', () => {
  const samples = [
    { distanceKm: 0, elevationMeters: -35, slopePercent: null },
    { distanceKm: 8.5, elevationMeters: 1200, slopePercent: -75.25 },
    { distanceKm: 11.2, elevationMeters: null, slopePercent: 33.5 },
  ];
  const axes = courseProfileAxes(samples);
  assert.ok(axes.slopeMin < -75.25 && axes.slopeMax > 33.5);
  assert.ok(axes.elevationMin < -35 && axes.elevationMax > 1200 && axes.distanceMax === 11.2);
  for (const points of [[], [{ distanceKm: 0, elevationMeters: null, slopePercent: null }],
    [{ distanceKm: 1, elevationMeters: 500, slopePercent: 0 }]]) {
    const a = courseProfileAxes(points);
    assert.ok(Object.values(a).every(Number.isFinite));
    assert.ok(a.elevationMin < a.elevationMax && a.slopeMin < a.slopeMax && a.distanceMax > 0);
  }
  const many = Array.from({ length: 100_000 }, (_, index) => ({ distanceKm: index, elevationMeters: index, slopePercent: -index }));
  assert.ok(courseProfileAxes(many).slopeMin < -99_999);
});

test('운영 빌드는 개발 시드 ID를 연결하지 않으며 개발용 세 코스 ID는 기존 비교와 같다', () => {
  for (const [name, id] of [['bukhansan-baegundae', 1], ['daenammun', 2], ['bibong', 3]]) {
    assert.equal(developmentAnalysisReference(name, 'bukhansan', true).courseId, id);
    assert.equal(developmentAnalysisReference(name, 'bukhansan', false), undefined);
  }
});
