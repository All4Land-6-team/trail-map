import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { courseNearbyPlacesUrl, loadCourseNearbyPlaces, parseCourseNearbyPlaces, toCourseNearbySpots } from '../src/api/courseNearbyPlaces.ts';

const place = (overrides = {}) => ({
  sourceType: 'KAKAO_PLACE', placeId: '101', name: '산아래 식당', category: 'RESTAURANT',
  longitude: 126.9846, latitude: 37.6599, address: '서울 종로구', roadAddress: '서울 종로구 길 1',
  phone: '02-123-4567', placeUrl: 'https://place.map.kakao.com/101', distanceFromCourseMeters: 120,
  ...overrides,
});
const response = data => ({ success: true, data });

test('코스 ID로 주변 장소를 요청하고 음식점과 카페를 지도 스팟으로 변환한다', () => {
  assert.equal(courseNearbyPlacesUrl(7, 'http://localhost:8080/'),
    'http://localhost:8080/api/v1/courses/7/nearby-places');
  const places = parseCourseNearbyPlaces(response([
    place({ placeId: '202', name: '능선 카페', category: 'CAFE', distanceFromCourseMeters: 200,
      placeUrl: 'https://place.map.kakao.com/202' }),
    place(),
    place({ placeId: '303', category: 'CONVENIENCE_STORE', placeUrl: 'https://place.map.kakao.com/303' }),
  ]));
  const spots = toCourseNearbySpots(places, 'db-7');
  assert.deepEqual(spots.map(item => item.kind), ['restaurant', 'cafe']);
  assert.deepEqual(spots.map(item => item.courseId), ['db-7', 'db-7']);
  assert.equal(spots[0].placeUrl, 'https://place.map.kakao.com/101');
  assert.equal(spots[0].roadAddress, '서울 종로구 길 1');
  assert.equal(spots[0].address, '서울 종로구');
  assert.equal(spots[0].phone, '02-123-4567');
});

test('지도에는 출발점과 가까운 음식점과 카페를 합쳐 최대 8개만 표시한다', () => {
  const places = Array.from({ length: 10 }, (_, index) => place({
    placeId: String(200 + index),
    name: `주변 장소 ${index}`,
    category: index % 2 ? 'CAFE' : 'RESTAURANT',
    longitude: 126.98 + index * 0.001,
    latitude: 37.65,
    distanceFromCourseMeters: 100 - index,
    placeUrl: `https://place.map.kakao.com/${200 + index}`,
  }));

  const spots = toCourseNearbySpots(places, 'db-7', [126.98, 37.65]);

  assert.equal(spots.length, 8);
  assert.deepEqual(spots.map(item => item.id), Array.from({ length: 8 }, (_, index) => `kakao-${200 + index}`));
});

test('중복 ID와 잘못된 좌표·URL·거리·카테고리를 거부한다', () => {
  assert.throws(() => parseCourseNearbyPlaces(response([place(), place()])));
  for (const change of [
    { latitude: 91 }, { longitude: NaN }, { distanceFromCourseMeters: -1 },
    { placeUrl: 'https://evil.example/101' }, { category: 'PARK' }, { placeId: '' },
  ]) assert.throws(() => parseCourseNearbyPlaces(response([{ ...place(), ...change }])));
  for (const body of [{ success: false, data: [] }, { success: true, data: null }]) {
    assert.throws(() => parseCourseNearbyPlaces(body));
  }
});

test('음식점 필터 하나로 음식점과 카페를 표시하고 전체에서는 제외한다', () => {
  const source = readFileSync(new URL('../src/pages/CourseListPage/components/CourseMap.tsx', import.meta.url), 'utf8');
  assert.match(source, /\["food", "음식점"\]/);
  assert.doesNotMatch(source, /\["cafe", "카페"\]/);
  assert.match(source, /filter === "all" \? facilitySpots/);
  assert.match(source, /visible && nearbySelected/);
  assert.match(source, /useCourseNearbyPlaces/);
  assert.match(source, /navigateFromHome\(courseDetailPath/);
  assert.match(source, /category: "food", spotId: spot\.id/);
});

test('코스 상세 음식점 탭에서만 주변 장소를 조회하고 전체 탭에서는 제외한다', () => {
  const profile = readFileSync(new URL('../src/utils/courseProfile.ts', import.meta.url), 'utf8');
  const detail = readFileSync(new URL('../src/pages/CourseDetailPage/CourseDetailPage.tsx', import.meta.url), 'utf8');
  assert.match(profile, /value: "food", label: "음식점"/);
  assert.match(profile, /category === "food"/);
  assert.match(detail, /useCourseNearbyPlaces/);
  assert.match(detail, /view\.tab === "spots" && view\.category === "food"/);
  assert.match(detail, /view\.category === "food" \? nearbySpots/);
});

test('실제 API 응답과 실패를 처리한다', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, options) => {
    assert.match(url, /\/api\/v1\/courses\/7\/nearby-places$/);
    assert.equal(options.headers.Accept, 'application/json');
    return new Response(JSON.stringify(response([place()])));
  };
  assert.equal((await loadCourseNearbyPlaces(7))[0].name, '산아래 식당');
  globalThis.fetch = async () => new Response('', { status: 500 });
  await assert.rejects(loadCourseNearbyPlaces(7), /불러오지 못/);
});
