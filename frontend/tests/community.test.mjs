import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { communityApi } from '../src/api/community.ts';
import { DUPLICATE_RADIUS_METERS, REVIEW_WINDOW_MS, SPOT_HIDE_NEGATIVE_VOTES, canWriteCourseReview, canWriteReview, castSpotVote, distanceMeters, eligibleCourseCompletions, isSpotHidden, nearbySpotCandidates } from '../src/utils/community.ts';
import { communityMarkerMode } from '../src/pages/CommunityPage/components/communityMapZoom.ts';
import { communityCourseColor } from '../src/constants/community.ts';

test('커뮤니티 지도 줌 단계는 기본점, 숫자 클러스터, 개별 아이콘 순으로 전환한다', () => {
  assert.equal(communityMarkerMode(9.5), 'overview');
  assert.equal(communityMarkerMode(12), 'overview');
  assert.equal(communityMarkerMode(12.99), 'overview');
  assert.equal(communityMarkerMode(13), 'cluster');
  assert.equal(communityMarkerMode(14), 'cluster');
  assert.equal(communityMarkerMode(15.99), 'cluster');
  assert.equal(communityMarkerMode(16), 'individual');
});

test('북한산 커뮤니티 지도들은 공용 Terrain-RGB 상태와 연결한다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/components/CommunityMap.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  const registration = readFileSync(new URL('../src/pages/CommunityPage/components/SpotRegistration.tsx', import.meta.url), 'utf8');
  assert.match(source, /supportsTerrain\(mountainId \?\? overviewMarker\?\.id\)/);
  assert.match(source, /terrainMode=\{terrainEnabled \? dimension : undefined\}/);
  assert.match(source, /onTerrainStatusChange=\{setTerrainStatus\}/);
  assert.match(source, /terrainEnabled && terrainStatus !== 'ready'/);
  assert.match(page, /community-page__map--detail[\s\S]*mountainId=\{terrainMountainId\}/);
  assert.match(page, /community-picker__map[\s\S]*mountainId=\{terrainMountainId\}/);
  assert.match(registration, /<CommunityMap[\s\S]*mountainId=\{terrainMountainId\}/);
});

test('커뮤니티 목데이터 없이 API와 R2 업로드 절차를 사용한다', async () => {
  assert.equal(existsSync(new URL('../src/api/communityMock.ts', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/store/communityStore.ts', import.meta.url)), false);
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/photos/upload-url')) return Response.json({ data: { objectKey: 'community/test.webp', uploadUrl: 'https://r2.test/upload' } });
    if (String(url) === 'https://r2.test/upload') return new Response(null, { status: 200 });
    return Response.json({ data: { photoId: 1, url: 'https://r2.test/read', originalFileName: 'spot.webp', mediaType: 'image/webp', fileSizeBytes: 4, displayOrder: 0, author: 'tester', reviewContent: null, createdAt: '2026-10-25T00:00:00Z' } }, { status: 201 });
  };
  try {
    const file = Object.assign(new Blob(['test'], { type: 'image/webp' }), { name: 'spot.webp' });
    const result = await communityApi.uploadPhotos('USER_SPOT', 7, [{ file, previewUrl: 'blob:test' }]);
    assert.equal(result[0].url, 'https://r2.test/read');
    assert.deepEqual(calls.map(call => [call.init.method, call.url]), [
      ['POST', 'http://localhost:8080/api/v1/community/photos/upload-url'],
      ['PUT', 'https://r2.test/upload'],
      ['POST', 'http://localhost:8080/api/v1/community/photos'],
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('등산 완료 화면에서 바로 연 산 후기 폼에 서버의 완료 산행을 연결한다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /setDraft\(current => current\.kind === 'mountain'[\s\S]*completedHikeId: eligibleHikes\[0\]\.id/);
});

test('산행 후 스팟 등록은 가장 최근에 완료한 코스를 기본 경로로 사용한다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /\[\.\.\.eligibility\.hikes\][\s\S]*Date\.parse\(b\.endedAt\) - Date\.parse\(a\.endedAt\)/);
  assert.match(source, /completedCourse = initialScreen === 'newSpot'[\s\S]*eligibleHikes\[0\]\?\.courseId/);
});

test('스팟 등록 지도는 등산 중 현재 위치를 우선하고 실패하면 전달받은 코스 전체를 표시한다', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const activePage = readFileSync(new URL('../src/pages/HikeActivePage/HikeActivePage.tsx', import.meta.url), 'utf8');
  const registration = readFileSync(new URL('../src/pages/CommunityPage/components/SpotRegistration.tsx', import.meta.url), 'utf8');
  const map = readFileSync(new URL('../src/pages/CommunityPage/components/CommunityMap.tsx', import.meta.url), 'utf8');
  assert.match(activePage, /mode: "active"[\s\S]*course: session\.schedule\.courseId/);
  assert.match(app, /spotRegistrationMode=\{query\.get\('mode'\) === 'active' \? 'active' : 'postHike'\}/);
  assert.match(registration, /mode !== 'active'\) return[\s\S]*requestAnimationFrame\(locate\)/);
  assert.match(registration, /center=\{mountainCenter\}[\s\S]*fitHighlightedRoute=\{!locationFocus\}/);
  assert.doesNotMatch(registration, /mountainSpots\[0\]\?\.coordinate \?\? mountainCenter/);
  assert.match(map, /fitHighlightedRoute[\s\S]*map\.fitBounds/);
});

test('지도 마커 ID가 겹쳐도 종류에 맞는 상세 화면을 연다', () => {
  const mapSource = readFileSync(new URL('../src/pages/CommunityPage/components/CommunityMap.tsx', import.meta.url), 'utf8');
  const pageSource = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(mapSource, /onMarkerSelect\?\.\(marker\)/);
  assert.match(pageSource, /marker\.kind === 'mountain'[\s\S]*showDetail\('mountain', marker\.id\)/);
  assert.match(pageSource, /marker\.kind === 'course'[\s\S]*showDetail\('course', marker\.id\)/);
  assert.match(pageSource, /showDetail\('spot', marker\.id\)/);
});

const base = [126.978, 37.659];
const near = [base[0] + 0.00015, base[1]];
const far = [base[0] + 0.001, base[1]];
const spot = (id, type, coordinate) => ({ id, type, coordinate });

test('같은 유형·50m 이내 스팟만 중복 후보이며 거리순으로 표시한다', () => {
  assert.equal(DUPLICATE_RADIUS_METERS, 50);
  assert.ok(distanceMeters(base, near) < 50);
  assert.ok(distanceMeters(base, far) > 50);
  const spots = [spot('far', 'shelter', far), spot('other-type', 'photo', base), spot('near', 'shelter', near), spot('exact', 'shelter', base)];
  const result = nearbySpotCandidates(spots, base, 'shelter', {});
  assert.deepEqual(result.map(item => item.spot.id), ['exact', 'near']);
  assert.equal(result[0].meters, 0);
});

test('커뮤니티 메인 지도에 선택한 산의 모든 코스 경로를 표시한다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /allCourseRoutes = useMemo\(\(\) => visibleCourseTargets\.map\(course => \(\{/);
  assert.match(source, /highlightedRoutes=\{screen === 'map' \? allCourseRoutes : undefined\}/);
});

test('북한산 코스 경로는 이름별 고정 색상을 사용한다', () => {
  const courseNames = ['백운대 코스', '대남문 코스', '비봉 코스', '숨은벽 코스', '보국문 코스', '우이령 코스', '사모바위 코스'];
  const colors = courseNames.map(communityCourseColor);
  assert.equal(new Set(colors).size, courseNames.length);
  assert.deepEqual(colors, ['#2563EB', '#EA580C', '#7C3AED', '#0F766E', '#DB2777', '#92400E', '#1E3A8A']);
});

test('코스 상세 지도는 고정 확대 대신 전체 경로 경계에 맞춘다', () => {
  const mapSource = readFileSync(new URL('../src/pages/CommunityPage/components/CommunityMap.tsx', import.meta.url), 'utf8');
  const pageSource = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(mapSource, /community-page__map--detail-course[\s\S]*map\.fitBounds/);
  assert.match(mapSource, /bottom: Math\.max\(24, mapHeight - visibleBottom \+ 24\)[\s\S]*maxZoom: 16/);
  assert.doesNotMatch(pageSource, /courseDetailFocus[\s\S]{0,120}zoom: 16/);
});

test('부정 평가 3건부터 스팟을 숨기고 후보 조회에서도 제외한다', () => {
  assert.equal(SPOT_HIDE_NEGATIVE_VOTES, 3);
  const before = { yes: 1, no: 2, viewer: null };
  assert.equal(isSpotHidden(before), false);
  const after = castSpotVote(before, 'no');
  assert.equal(after.no, 3);
  assert.equal(isSpotHidden(after), true);
  assert.deepEqual(nearbySpotCandidates([spot('hidden', 'shelter', base)], base, 'shelter', { hidden: after }), []);
});

test('한 사용자의 평가 변경과 같은 버튼 재선택에 의한 취소를 반영한다', () => {
  const first = castSpotVote({ yes: 2, no: 1, viewer: null }, 'yes');
  assert.deepEqual(first, { yes: 3, no: 1, viewer: 'yes' });
  assert.deepEqual(castSpotVote(first, 'yes'), { yes: 2, no: 1, viewer: null });
  assert.deepEqual(castSpotVote(first, 'no'), { yes: 2, no: 2, viewer: 'no' });
});

test('완료한 산행 후 24시간 이내에만 그 산의 후기를 작성할 수 있다', () => {
  const now = Date.parse('2026-10-18T12:00:00+09:00');
  const hike = (id, courseId, ago, mountainId = 'bukhansan') => ({ id, courseId, mountainId, courseName: courseId, distanceKm: 4.2, finishedAt: new Date(now - ago).toISOString() });
  assert.equal(canWriteReview([hike('limit', 'course-a', REVIEW_WINDOW_MS)], 'bukhansan', now), true);
  assert.equal(canWriteReview([hike('expired', 'course-a', REVIEW_WINDOW_MS + 1)], 'bukhansan', now), false);
  assert.equal(canWriteReview([hike('other', 'course-a', 1000, 'dobongsan')], 'bukhansan', now), false);
  assert.equal(canWriteReview([{ ...hike('future', 'course-a', 0), finishedAt: new Date(now + 1000).toISOString() }], 'bukhansan', now), false);
  assert.equal(canWriteReview([], 'bukhansan', now), false);
});

test('24시간 이내 완료 코스는 최신순으로 표시하고 같은 코스는 최신 기록만 남긴다', () => {
  const now = Date.parse('2026-10-18T12:00:00+09:00');
  const hike = (id, courseId, hours) => ({ id, courseId, mountainId: 'bukhansan', courseName: courseId, distanceKm: 4.2,
    finishedAt: new Date(now - hours * 60 * 60 * 1000).toISOString() });
  const eligible = eligibleCourseCompletions([
    hike('a-old', 'course-a', 8), hike('b', 'course-b', 2), hike('a-new', 'course-a', 1), hike('expired', 'course-c', 25),
  ], 'bukhansan', now);
  assert.deepEqual(eligible.map(item => item.id), ['a-new', 'b']);
  assert.equal(canWriteCourseReview(eligible, 'bukhansan', 'course-a', 'a-new', now), true);
  assert.equal(canWriteCourseReview(eligible, 'bukhansan', 'course-b', 'a-new', now), false);
  assert.equal(canWriteCourseReview(eligible, 'bukhansan', 'course-a', 'a-old', now), false);
});
