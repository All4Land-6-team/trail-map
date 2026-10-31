import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { analysis, profile, noAnalysis } from './fixtures/course-analysis.mjs';
import { detailAnalysisView } from '../src/utils/courseDetailAnalysis.ts';

const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' });
after(() => server.close());
const { CourseAnalysis } = await server.ssrLoadModule('/src/pages/CourseDetailPage/components/CourseAnalysis.tsx');
const { courseFixtures } = await server.ssrLoadModule('/src/api/courseMock.ts');
const { cartCatalog } = await server.ssrLoadModule('/src/pages/CartPage/catalog.ts');
const { loadCourseDetailData } = await server.ssrLoadModule('/src/api/courseDetailMock.ts');
const course = courseFixtures.find(c => c.id === 'bukhansan-baegundae');
const data = { course: { ...course, distanceKm: 99, elevationGainMeters: 9999 }, spots: [] };
function render(state, selectedIndex = 0) {
  return renderToStaticMarkup(createElement(CourseAnalysis, {
    data, analysisState: state, analysisView: detailAnalysisView(data.course, state), onRetryAnalysis() {},
    reviews: [], reviewTotal: 0, visibility: { elevation: true, slope: true }, selectedIndex, onSelect() {}, onToggle() {},
  }));
}

test('연결된 개발용 코스는 상세 진입 가능하고 비교·상세의 분석 연결은 같으며 시설 ID는 별도다', async () => {
  for (const [id, db] of [['bukhansan-baegundae', 1], ['daenammun', 2], ['bibong', 3]]) {
    const item = courseFixtures.find(c => c.id === id);
    assert.equal(item.detailAvailable, true); assert.equal(item.analysisReference.courseId, db);
    assert.deepEqual(item.analysisReference, cartCatalog.find(c => c.id === id).analysisReference);
    const base = await loadCourseDetailData({ mountainId: 'bukhansan', courseId: id }, new AbortController().signal);
    assert.equal('samples' in base, false);
  }
  assert.equal(course.backendCourseId, 2); assert.equal(course.analysisReference.courseId, 1);
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
