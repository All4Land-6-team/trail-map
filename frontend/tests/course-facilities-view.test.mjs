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
  coordinate: [127.02, 37.7], facilityId: 100, photoCount: 3, reviewCount: 2,
  communityTarget: { mountainId: '2', targetType: 'FACILITY', targetId: '100' },
};
function render(overrides = {}) {
  return renderToStaticMarkup(createElement(CourseSpots, {
    spots: [], category: 'water', spotsState: { status: 'success', spots: [] },
    onRetrySpots() {}, onCategory() {}, onOpen() {},
    ...overrides,
  }));
}

test('음수대 빈 결과는 0곳과 공식 시설·음수대 안내를 표시한다', () => {
  const html = render();
  assert.match(html, /음수대 · 0곳/);
  assert.match(html, /조회된 음수대가 없어요/);
  assert.match(html, /공식 시설은 코스 경로에 연결된 시설만 표시합니다/);
  assert.match(html, /음용 적합 여부는 확인되지 않았어요/);
  assert.doesNotMatch(html, /course-spot-card|250m/);
});

test('선택한 OSM 음식점·카페의 지도 출처와 위치를 표시한다', () => {
  const place = {
    id: 'osm-poi-101', courseId: 'db-7', kind: 'cafe', name: '능선 카페',
    coordinate: [126.9846, 37.6599],
  };
  const html = render({ category: 'food', spots: [place], selectedId: place.id, spotsState: { status: 'loading' } });
  assert.match(html, /음식점/);
  assert.match(html, /data-category="food"/);
  assert.match(html, /aria-label="능선 카페 상세 정보"/);
  assert.match(html, /카페/);
  assert.match(html, /능선 카페/);
  assert.match(html, /OpenStreetMap/);
  assert.match(html, /126\.9846, 37\.6599/);
  assert.doesNotMatch(html, /course-spot-card|스팟을 불러오는 중/);
  assert.doesNotMatch(html, /지도에 표시된 음식점이나 카페 아이콘/);
  assert.doesNotMatch(html, /카카오맵|전화번호|주소 정보 없음/);
});

test('스팟 로딩·오류·미연결은 0곳으로 단정하지 않고 각각 안내한다', () => {
  for (const category of ['water', 'shelter', 'photo', 'all']) {
    for (const [spotsState, text] of [
      [{ status: 'loading' }, /스팟을 불러오는 중/],
      [{ status: 'error', message: '연결 실패' }, /스팟 다시 조회/],
      [{ status: 'unavailable' }, /이 코스의 스팟 조회를 준비 중/],
    ]) {
      const html = render({ category, spotsState });
      assert.match(html, text);
      assert.doesNotMatch(html, /· 0곳|조회된 .*없어요|아직 등록된 스팟/);
    }
  }
  assert.match(render({ category: 'water', spotsState: { status: 'error', message: '연결 실패' } }), /연결 실패/);
});

test('사진 스팟은 실제 이름·사진 수를 표시한다', () => {
  const spot = { id: 'USER_SPOT:7', name: '전망 바위', kind: 'photo', photoCount: 3, reviewCount: 2,
    communityTarget: { mountainId: '2', targetType: 'USER_SPOT', targetId: '7' } };
  const html = render({ category: 'photo', spots: [spot], spotsState: { status: 'success', spots: [spot] } });
  assert.match(html, /사진 스팟 · 1곳/);
  assert.match(html, /전망 바위/);
  assert.match(html, /사용자 등록/);
  assert.match(html, /사진 3장 · 후기 2개/);
  assert.doesNotMatch(html, /화면 예시/);
});

test('예시 사진 스팟은 예시 안내와 함께 표시한다', () => {
  const example = { id: 'example', name: '사진 스팟 1', kind: 'photo', example: true };
  const html = render({ category: 'photo', spots: [example], spotsState: { status: 'success', spots: [] } });
  assert.match(html, /사진 스팟 1/);
  assert.match(html, /지도 표시 위치는 화면 예시입니다/);
});

test('공식 시설은 이름·사진·후기 수와 선택 상태를 표시하고, 거리 정보가 없으면 거리를 표시하지 않는다', () => {
  const html = render({ spots: [waterSpot], spotsState: { status: 'success', spots: [waterSpot] }, selectedId: waterSpot.id });
  assert.match(html, /시험 샘터 커뮤니티 상세 보기/);
  assert.match(html, /data-spot-id="facility-100"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /공식 시설/);
  assert.match(html, /사진 3장 · 후기 2개/);
  assert.doesNotMatch(html, /경로까지 약|최단거리/);
  const withDistance = render({ spots: [{ ...waterSpot, distanceMeters: 123.4 }], spotsState: { status: 'success', spots: [waterSpot] } });
  assert.match(withDistance, /경로까지 약 123m/);
  assert.match(withDistance, /경로까지의 최단거리로/);
});

test('전체 탭은 공식 시설과 사용자 스팟을 함께 세고, 빈 결과이면 빈 상태를 표시한다', () => {
  const shelter = { ...waterSpot, id: 'USER_SPOT:3', facilityId: undefined, kind: 'shelter', name: '시험 파고라',
    communityTarget: { mountainId: '2', targetType: 'USER_SPOT', targetId: '3' } };
  const html = render({ category: 'all', spots: [shelter, waterSpot], spotsState: { status: 'success', spots: [shelter, waterSpot] } });
  assert.match(html, /전체 · 2곳/);
  assert.match(html, /쉼터 · 시험 파고라/);
  assert.match(html, /음수대 · 시험 샘터/);
  assert.match(render({ category: 'all' }), /아직 등록된 스팟이 없어요/);
});
