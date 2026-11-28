import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_SPOT_BOUNDS_MARGIN_DEGREES, courseSpotBounds, loadCommunityCourseSpots } from '../src/api/communityCourseSpots.ts';
import { toCourseCommunitySpots } from '../src/api/coursePhotoSpots.ts';
import { SPOT_HIDE_NEGATIVE_VOTES } from '../src/utils/community.ts';

const spot = (targetType, targetId, overrides = {}) => ({
  targetType, targetId, mountainId: 1, name: `${targetType} ${targetId}`, type: 'RESTROOM',
  longitude: 126.95, latitude: 37.65, status: targetType === 'FACILITY' ? 'OFFICIAL' : 'PENDING',
  yesVotes: 0, noVotes: 0, viewerVote: null, reviewCount: 1, photoCount: 2, representativePhotoUrl: null, ...overrides,
});

test('코스 스팟 조회 영역은 지도 화면이 아니라 코스 경로 전체를 감싼다', () => {
  const margin = COURSE_SPOT_BOUNDS_MARGIN_DEGREES;
  const bounds = courseSpotBounds([[126.95, 37.65], [126.97, 37.66], [126.96, 37.64]]);
  assert.deepEqual(bounds, { west: 126.95 - margin, south: 37.64 - margin, east: 126.97 + margin, north: 37.66 + margin });
  assert.equal(courseSpotBounds([]), null);
  assert.equal(courseSpotBounds([[Number.NaN, 37.6]]), null);
});

test('커뮤니티 코스 스팟 조회는 코스 ID와 경로 영역으로 커뮤니티 스팟 API를 호출한다', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    assert.deepEqual(await loadCommunityCourseSpots(1, 2, [[126.95, 37.65], [126.97, 37.66]]), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
  const url = new URL(urls[0]);
  assert.match(url.pathname, /\/api\/v1\/community\/mountains\/1\/spots$/);
  assert.equal(url.searchParams.get('courseId'), '2');
  assert.ok(Number(url.searchParams.get('west')) < 126.95 && Number(url.searchParams.get('east')) > 126.97);
  await assert.rejects(loadCommunityCourseSpots(1, 2, []), /코스 경로가 없어/);
});

test('코스 상세 스팟은 기존 ID 형식을 유지하고 사용자 스팟을 공식 시설보다 먼저 둔다', () => {
  const spots = toCourseCommunitySpots([
    spot('FACILITY', 11),
    spot('FACILITY', 12, { type: 'DRINKING_FOUNTAIN' }),
    spot('USER_SPOT', 7, { type: 'REST_AREA' }),
  ], 'db-2', 1);

  assert.deepEqual(spots.map(item => [item.id, item.kind]), [
    ['USER_SPOT:7', 'shelter'], ['facility-11', 'restroom'], ['facility-12', 'water'],
  ]);
  assert.equal(spots[1].facilityId, 11);
  assert.equal(spots[1].distanceMeters, undefined);
  assert.deepEqual(spots[1].communityTarget, { mountainId: '1', targetType: 'FACILITY', targetId: '11' });
  assert.deepEqual([spots[0].photoCount, spots[0].reviewCount], [2, 1]);
});

test('숨김·기타 유형·다른 산·중복 스팟은 코스 상세에서 제외한다', () => {
  const spots = toCourseCommunitySpots([
    spot('USER_SPOT', 7, { status: 'HIDDEN' }),
    spot('FACILITY', 13, { type: 'OTHER' }),
    spot('FACILITY', 14, { mountainId: 2 }),
    spot('FACILITY', 11), spot('FACILITY', 11),
  ], 'db-2', 1);

  assert.deepEqual(spots.map(item => item.id), ['facility-11']);
});

test('커뮤니티 화면과 같이 반대표가 기준 이상인 스팟은 코스 상세에서도 숨긴다', () => {
  const spots = toCourseCommunitySpots([
    spot('FACILITY', 11, { noVotes: SPOT_HIDE_NEGATIVE_VOTES }),
    spot('USER_SPOT', 7, { noVotes: SPOT_HIDE_NEGATIVE_VOTES + 1 }),
    spot('FACILITY', 12, { noVotes: SPOT_HIDE_NEGATIVE_VOTES - 1, yesVotes: 5 }),
  ], 'db-2', 1);

  assert.deepEqual(spots.map(item => item.id), ['facility-12']);
});
