import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// 브라우저 조작과 별개로 실제 컴포넌트의 상태별 안내·목록 출력을 검증한다.
const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom' });
after(() => server.close());
const { CourseSpots } = await server.ssrLoadModule('/src/pages/CourseDetailPage/components/CourseSpots.tsx');
const waterSpot = {
  id: 'facility-100', courseId: 'test-course', kind: 'water', name: '시험 샘터',
  coordinate: [127.02, 37.7], facilityId: 100, distanceMeters: 123.4, sourceDate: '2024-05-22',
};
function render(overrides = {}) {
  return renderToStaticMarkup(createElement(CourseSpots, {
    spots: [], category: 'water', restrooms: { status: 'success', spots: [] },
    shelters: { status: 'success', spots: [] }, onRetryShelters() {},
    water: { status: 'success', spots: [] }, onRetryRestrooms() {}, onRetryWater() {}, onCategory() {}, onOpen() {},
    ...overrides,
  }));
}

test('음수대 빈 결과는 0곳과 범위 안내를 표시한다', () => {
  const html = render();
  assert.match(html, /음수대 · 0곳/);
  assert.match(html, /조회된 음수대가 없어요/);
  assert.match(html, /음용 적합 여부는 확인되지 않았어요/);
  assert.doesNotMatch(html, /음수대 1|course-spot-card/);
});

test('음수대 로딩·오류·미연결은 0건으로 단정하지 않고 각각 안내한다', () => {
  for (const [water, text] of [
    [{ status: 'loading' }, /주변 음수대를 불러오는 중/],
    [{ status: 'error', message: '조회 실패' }, /음수대 다시 조회/],
    [{ status: 'unavailable' }, /이 코스의 음수대 조회를 준비 중/],
  ]) {
    const html = render({ water });
    assert.match(html, text);
    assert.doesNotMatch(html, /음수대 · 0곳|조회된 음수대가 없어요/);
  }
});

test('실제 음수대는 원본 이름·기준일·거리와 지도 선택 ID를 표시한다', () => {
  const html = render({ spots: [waterSpot], water: { status: 'success', spots: [waterSpot] }, selectedId: waterSpot.id });
  assert.match(html, /시험 샘터 지도에서 보기/);
  assert.match(html, /data-spot-id="facility-100"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /경로까지 약 123m/);
  assert.match(html, /자료 기준 2024-05-22/);
});

test('전체 탭에서 화장실 오류가 발생해도 성공한 음수대 목록을 유지한다', () => {
  const html = render({ category: 'all', spots: [waterSpot],
    water: { status: 'success', spots: [waterSpot] }, restrooms: { status: 'error', message: '화장실 조회 실패' } });
  assert.match(html, /화장실 다시 조회/);
  assert.match(html, /음수대 · 시험 샘터/);
  assert.doesNotMatch(html, /전체 · 1곳/); // 일부 요청 실패 상태의 수를 전체 개수로 확정하지 않는다.
});

test('쉼터도 로딩·실패·미연결·빈 결과를 구분하며 실제 좌표의 시설을 선택한다', () => {
  for (const [shelters, expected] of [
    [{ status: 'loading' }, /주변 쉼터를 불러오는 중/],
    [{ status: 'error', message: '조회 실패' }, /쉼터 다시 조회/],
    [{ status: 'unavailable' }, /이 코스의 쉼터 조회를 준비 중/],
    [{ status: 'success', spots: [] }, /조회된 쉼터가 없어요/],
  ]) {
    const html = render({ category: 'shelter', shelters });
    assert.match(html, expected);
    if (shelters.status !== 'success') assert.doesNotMatch(html, /쉼터 · 0곳/);
  }
  const shelter = { ...waterSpot, id: 'facility-101', facilityId: 101, kind: 'shelter', name: '시험 파고라' };
  const html = render({ category: 'shelter', spots: [shelter], selectedId: shelter.id,
    shelters: { status: 'success', spots: [shelter] } });
  assert.match(html, /시험 파고라 지도에서 보기/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /data-spot-id="facility-101"/);
});

test('전체 탭의 세 시설이 모두 빈 결과이면 빈 상태를 표시하고 일부 실패이면 개수를 확정하지 않는다', () => {
  assert.match(render({ category: 'all' }), /아직 등록된 스팟이 없어요/);
  const html = render({ category: 'all', shelters: { status: 'error', message: '조회 실패' } });
  assert.match(html, /쉼터 다시 조회/);
  assert.doesNotMatch(html, /전체 · 0곳|아직 등록된 스팟이 없어요/);
});
