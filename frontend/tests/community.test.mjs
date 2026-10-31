import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { communityApi } from '../src/api/community.ts';
import { DUPLICATE_RADIUS_METERS, REVIEW_WINDOW_MS, SPOT_HIDE_NEGATIVE_VOTES, canWriteCourseReview, canWriteReview, castSpotVote, distanceMeters, eligibleCourseCompletions, isSpotHidden, nearbySpotCandidates } from '../src/utils/community.ts';
import { communityMarkerMode } from '../src/pages/CommunityPage/components/communityMapZoom.ts';
import { groupCommunityMapPoints } from '../src/pages/CommunityPage/components/communityMapClusters.ts';
import { bufferMapBounds, coversMapBounds, nearestCoordinate } from '../src/pages/CommunityPage/components/communityMapBounds.ts';
import { communityCourseColor } from '../src/constants/community.ts';

test('커뮤니티 지도 줌 단계는 기본점, 숫자 클러스터, 개별 아이콘 순으로 전환한다', () => {
  assert.equal(communityMarkerMode(9.5), 'overview');
  assert.equal(communityMarkerMode(11.99), 'overview');
  assert.equal(communityMarkerMode(12), 'cluster');
  assert.equal(communityMarkerMode(12.99), 'cluster');
  assert.equal(communityMarkerMode(13), 'individual');
  assert.equal(communityMarkerMode(14), 'individual');
  assert.equal(communityMarkerMode(14.5), 'individual');
  assert.equal(communityMarkerMode(18), 'individual');
});

test('지도 클러스터는 입력 순서와 관계없이 가까운 그룹을 하나로 합친다', () => {
  const points = [
    { value: 'a', x: 0, y: 0 },
    { value: 'b', x: 55, y: 0 },
    { value: 'c', x: 40, y: 0 },
    { value: 'far', x: 150, y: 0 },
  ];
  const grouped = groupCommunityMapPoints(points, 45).map(group => group.map(point => point.value).sort());
  const reversed = groupCommunityMapPoints([...points].reverse(), 45).map(group => group.map(point => point.value).sort());
  assert.deepEqual(grouped, [['a', 'b', 'c'], ['far']]);
  assert.deepEqual(reversed.map(group => group.join(',')).sort(), grouped.map(group => group.join(',')).sort());
});

test('개별 마커 해제 전에는 가까운 마커를 묶는다', () => {
  const groups = groupCommunityMapPoints([
    { value: 'same-a', x: 10, y: 10 },
    { value: 'same-b', x: 10, y: 10 },
    { value: 'separate', x: 41, y: 10 },
  ], 30);
  assert.deepEqual(groups.map(group => group.map(point => point.value)), [['same-a', 'same-b'], ['separate']]);
});

test('지도 스팟 조회 영역은 화면 밖까지 포함하고 영역을 벗어날 때만 다시 조회한다', () => {
  const viewport = { west: 126.9, south: 37.5, east: 127.1, north: 37.7 };
  const buffered = bufferMapBounds(viewport);
  assert.equal(coversMapBounds(buffered, viewport), true);
  assert.equal(coversMapBounds(buffered, { west: 127, south: 37.55, east: 127.18, north: 37.74 }), true);
  assert.equal(coversMapBounds(buffered, { west: 127.1, south: 37.6, east: 127.3, north: 37.8 }), false);
});

test('스팟 필터 중심은 빈 중간 지점이 아니라 산과 가장 가까운 실제 스팟을 사용한다', () => {
  assert.deepEqual(nearestCoordinate([[126.8, 37.4], [127.01, 37.61], [127.2, 37.8]], [127, 37.6]), [127.01, 37.61]);
  assert.deepEqual(nearestCoordinate([], [127, 37.6]), [127, 37.6]);
});

test('커뮤니티 필터는 전체·산, 스팟, 코스 목적에 맞는 중심과 줌을 사용한다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  const mapSource = readFileSync(new URL('../src/pages/CommunityPage/components/CommunityMap.tsx', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../src/pages/CommunityPage/community.css', import.meta.url), 'utf8');
  assert.match(source, /all: 12\.5, mountain: MAIN_MAP_ZOOM, spot: 14\.5, course: 11\.99/);
  assert.match(source, /mapFocusCategory === 'spot' \? spotFocusCenter \?\? mountainCenter/);
  assert.match(source, /mapFocusCategory === 'all' \|\| mapFocusCategory === 'course' \? -20 : undefined/);
  assert.match(source, /resetZoom: true, resetOrientation: true/);
  assert.match(mapSource, /visibleCenter \+ \(focusTarget\.verticalOffset \?\? 0\)/);
  assert.match(mapSource, /bearing: focusTarget\.resetOrientation \? 0 : undefined/);
  assert.match(mapSource, /pitch: focusTarget\.resetOrientation \? dimension === '3D' \? MAIN_MAP_3D_PITCH : 0 : undefined/);
  assert.doesNotMatch(source, /courseMapCenter/);
  assert.match(source, /setSpotFocusCenter\(nearestCoordinate\(visibleListedSpots\.map/);
  assert.match(source, /setMapFocusCategory\(category\)/);
  assert.match(source, /sheetPeek \? 240 : 0/);
  assert.match(source, /zoom: MOUNTAIN_DETAIL_ZOOM/);
  assert.match(source, /const MOUNTAIN_DETAIL_ZOOM = CATEGORY_MAP_ZOOM\.mountain/);
  assert.match(mapSource, /community-page__map--detail-mountain'[\s\S]*max-height: 720px\)'[\s\S]*154 : 160/);
  assert.match(mapSource, /MARKER_CLUSTER_DISTANCE = 45/);
  assert.match(mapSource, /INDIVIDUAL_OVERLAP_DISTANCE = 20/);
  assert.match(mapSource, /OVERLAP_RELEASE_ZOOM = 16/);
  assert.match(mapSource, /CLUSTER_CHOICE_ZOOM = OVERLAP_RELEASE_ZOOM - 0\.5/);
  assert.match(mapSource, /CLUSTER_CHOICE_MIN_ZOOM = 13/);
  assert.doesNotMatch(mapSource, /spreadOverlappingMarkers/);
  assert.match(mapSource, /currentZoom >= OVERLAP_RELEASE_ZOOM[\s\S]*map\(item => \[item\]\)/);
  assert.match(mapSource, /targetZoom = Math\.min\(CLUSTER_CHOICE_ZOOM, map\.getMaxZoom\(\)\)/);
  assert.match(mapSource, /map\.getZoom\(\) < CLUSTER_CHOICE_MIN_ZOOM/);
  assert.match(cssSource, /community-map__cluster span \{[^}]*width:30px;[^}]*height:30px/);
  assert.match(cssSource, /community-map__pin \.af-spot-marker \{[^}]*width:44px;[^}]*height:44px/);
  assert.match(cssSource, /community-map__pin \.af-spot-marker::before \{[^}]*inset:7px/);
  assert.match(cssSource, /community-map__cluster-choices \{[^}]*left:calc\(50% \+ 19px\);[^}]*width:164px;[^}]*padding:10px/);
  assert.match(cssSource, /community-map__cluster-choices--left \{[^}]*right:calc\(50% \+ 19px\)/);
  assert.match(cssSource, /community-map-filters \{[^}]*z-index:11/);
  assert.match(mapSource, /clusterIdentity\(group\)/);
  assert.match(mapSource, /rightSpace >= 183 \|\| rightSpace >= leftSpace/);
  assert.match(mapSource, /returningToMainMap && mainMapViewport\.current/);
  assert.match(mapSource, /map\.easeTo\(\{ \.\.\.mainMapViewport\.current/);
  assert.match(mapSource, /offset: group\.length > 1 && naturalPoint \? \[x - naturalPoint\.x, y - naturalPoint\.y\] : \[0, 0\]/);
  assert.doesNotMatch(mapSource, /map\.on\('zoomend'/);
  assert.match(cssSource, /community-map__mountain-marker \{[^}]*width:44px;[^}]*height:44px/);
  assert.match(cssSource, /community-map__mountain-marker \.af-mountain-marker__label \{[^}]*position:absolute/);
});

test('산 선택 직후에도 전체 필터와 같은 지도 위치를 사용한다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /const scheduleMapFocus = \(category: MapCategory, delay: number\) => \{[\s\S]*window\.clearTimeout\(categoryFocusTimer\.current\)[\s\S]*setMapFocusCategory\(category\)[\s\S]*setCategoryFocusRequest\(current => current \+ 1\)/);
  assert.match(source, /const confirmMountainSelection = \(\) => \{[\s\S]*setMapCategory\('all'\)[\s\S]*move\('map'\)[\s\S]*scheduleMapFocus\('all', 240\)/);
  assert.match(source, /const changeMapCategory = \(category: MapCategory\) => \{[\s\S]*setMapCategory\(category\)[\s\S]*scheduleMapFocus\(category, sheetPeek \? 240 : 0\)/);
});

test('산 필터만 라벨을 표시하고 다른 화면에는 라벨 없는 깃발 산 기본점을 표시한다', () => {
  const page = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  const map = readFileSync(new URL('../src/pages/CommunityPage/components/CommunityMap.tsx', import.meta.url), 'utf8');
  assert.match(page, /const mapMarkers:[\s\S]*\{ id: mountain\.id, name: mountain\.name, coordinate: mountain\.position/);
  assert.match(page, /\{\(screen === 'map' \|\| isDetail\) && <CommunityMap[\s\S]*showMountainFlag/);
  assert.match(page, /showMountainLabel=\{screen === 'map' && mapCategory === 'mountain'\}/);
  assert.doesNotMatch(page, /community-page__map--select"[^>]*showMountainFlag/);
  assert.match(map, /mountain-flag\.svg/);
  assert.match(map, /showMountainFlag && <img[\s\S]*community-map__mountain-flag/);
  assert.match(map, /community-map__mountain-marker--label-hidden/);
});

test('활성 커뮤니티 탭을 다시 누르면 선택값 없이 산 선택 첫 화면으로 돌아간다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(destination === 'community'\) \{[\s\S]*setScreens\(\['mountainSelect'\]\)[\s\S]*setMountainId\(''\)[\s\S]*setMountainFocus\(null\)/);
});

test('산 선택 첫 화면은 홈 지도 위치에서 미선택으로 시작하고 선택할 때만 확대한다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(source, /const MOUNTAIN_SELECT_CENTER: Coordinate = SOUTH_KOREA_MAINLAND_CENTER/);
  assert.match(source, /const MOUNTAIN_SELECT_ZOOM = 6\.1/);
  assert.match(source, /zoom=\{MOUNTAIN_SELECT_ZOOM\}/);
  assert.match(source, /zoom: MOUNTAIN_SELECT_FOCUS_ZOOM, resetZoom: true/);
  assert.doesNotMatch(source, /initialMountainId = 'bukhansan'/);
  assert.doesNotMatch(source, /\?\? loaded\[0\]/);
  assert.match(source, /disabled=\{!mountainId\}/);
  assert.match(app, /initialMountainId=\{query\.get\('mountain'\) \?\? \(fromHikeComplete \? completedHikes\[0\]\?\.mountainId : undefined\)\}/);
});

test('상세 사진 로딩에는 스켈레톤을 적용하고 바텀시트 진입 모션은 사용하지 않는다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/pages/CommunityPage/community.css', import.meta.url), 'utf8');
  assert.match(source, /photoPage\.loading && photoPage\.items\.length === 0 && <CommunityPhotoSkeleton/);
  assert.doesNotMatch(styles, /community-sheet-enter/);
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

test('커뮤니티 스팟과 클러스터는 3D 지형 뒤에서 흐리게 표시하고 이동 중 재배치하지 않는다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/components/CommunityMap.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/pages/CommunityPage/community.css', import.meta.url), 'utf8');
  assert.match(source, /import \{ createPortal \} from 'react-dom'/);
  assert.match(source, /new Marker\(\{ element, anchor: 'center', opacityWhenCovered: 0\.2, subpixelPositioning: true \}\)/);
  assert.match(source, /\[markerElements\] = useState\(\(\) => new Map<string, HTMLDivElement>\(\)\)/);
  assert.match(source, /if \(!markerElements\.has\(key\)\) markerElements\.set\(key, document\.createElement\('div'\)\)/);
  assert.match(source, /createPortal\(<div/);
  assert.match(source, /map\.on\('moveend', update\)/);
  assert.doesNotMatch(source, /map\.on\('move', update\)/);
  assert.match(source, /document\.addEventListener\('pointerdown', closeOnOutsidePress\)/);
  assert.match(source, /clusterChoicesRef\.current\?\.contains\(target\)/);
  assert.match(css, /\.maplibregl-marker:has\(\.community-map__pin--cluster-choice\) \{ z-index:10; \}/);
});

test('스팟 상세 지도 조회는 메인 지도의 마커 목록을 덮어쓰지 않는다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /const cacheKey = `\$\{screen\}:\$\{mountainId\}:\$\{type \?\? 'all'\}`/);
  assert.match(source, /if \(screen === 'map'\) setMapSpots\(loaded\)/);
  assert.match(source, /if \(screen === 'map' && shownMapSpotKey\.current !== cacheKey\)/);
});

test('클러스터는 3D 화면 투영이 아니라 줌 단계의 평면 지도 거리로 계산한다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/components/CommunityMap.tsx', import.meta.url), 'utf8');
  assert.match(source, /MercatorCoordinate\.fromLngLat\(marker\.coordinate\)/);
  assert.match(source, /useMapDistance \? item\.mapX : item\.x/);
  assert.match(source, /markerMode === 'cluster'\)/);
  assert.match(source, /lastReportedCamera\.zoom - zoom/);
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
    assert.equal(calls[0].init.headers['X-User-Id'], '1');
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

test('커뮤니티의 스팟 등록 지도는 선택한 산의 최근 완료 코스들을 표시하고 현재 위치를 요청하지 않는다', () => {
  const page = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  const registration = readFileSync(new URL('../src/pages/CommunityPage/components/SpotRegistration.tsx', import.meta.url), 'utf8');
  assert.match(page, /spotRegistrationCourses = useMemo[\s\S]*eligibleCourses\.flatMap/);
  assert.match(registration, /mode === 'postHike'[\s\S]*최근에 다녀온 코스/);
  assert.match(registration, /highlightedRoutes=\{mode === 'postHike' \? recentRoutes : undefined\}/);
  assert.match(registration, /if \(mode !== 'active'\) return[\s\S]*requestAnimationFrame\(locate\)/);
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

test('등산 중 스팟 공유는 기존 스팟 선택부터 시작하고 새 스팟 등록을 선택 화면에서 제공한다', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const activePage = readFileSync(new URL('../src/pages/HikeActivePage/HikeActivePage.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(activePage, /screen: "spotPicker"/);
  assert.match(app, /entry === 'spotPicker'/);
  assert.match(page, /screen === 'spotPicker'[\s\S]*찾는 스팟이 없나요\? 새 스팟 등록/);
});

test('산·스팟·코스 후기 전체보기에서 처음 20개와 다음 20개를 조회한다', () => {
  const page = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /communityApi\.mountainReviews\(mountainId, controller\.signal, 21\)/);
  assert.match(page, /communityApi\.spotReviews\(mountainId, listSpot!\.targetType, listSpot!\.targetId, controller\.signal, 21\)/);
  assert.match(page, /communityApi\.courseReviews\(detailCourseId, controller\.signal, 21, offset\)/);
  assert.match(page, /new IntersectionObserver/);
});

test('산 전체 스팟 목록은 지도 영역 없이 유형과 이어보기 커서를 전송한다', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(String(url));
    return Response.json({ data: { items: [], nextCursor: null, hasNext: false } });
  };
  try {
    await communityApi.spotList('2', undefined, 'RESTROOM', 'next-page');
    assert.equal(calls[0], 'http://localhost:8080/api/v1/community/mountains/2/spots/list?size=20&type=RESTROOM&cursor=next-page');
    const page = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
    assert.match(page, /communityApi\.spotList\(mountainId, controller\.signal, listType, spotListCursor\)/);
    assert.match(page, /new IntersectionObserver\([\s\S]*\{ root, rootMargin: '120px' \}/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('스팟 상세에서 목록으로 돌아올 때 기존 목록을 유지하며 갱신한다', () => {
  const page = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /const spotListKey = `\$\{mountainId\}:\$\{listType \?\? 'all'\}`/);
  assert.match(page, /const keepCurrentList = shownSpotListKey\.current === spotListKey/);
  assert.match(page, /if \(!keepCurrentList\) \{\s*setListedSpots\(\[\]\)/);
  assert.match(page, /return \[\.\.\.loaded, \.\.\.current\.filter\(spot => !loadedIds\.has\(spot\.id\)\)\]/);
});

test('지도 마커 ID가 겹쳐도 종류에 맞는 상세 화면을 연다', () => {
  const mapSource = readFileSync(new URL('../src/pages/CommunityPage/components/CommunityMap.tsx', import.meta.url), 'utf8');
  const pageSource = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(pageSource, /id: `\$\{spot\.targetType\}:\$\{spot\.targetId\}`/);
  assert.match(mapSource, /onMarkerSelect\?\.\(marker\)/);
  assert.match(mapSource, /markerIdentity = \(marker: CommunityMapMarker\) => `\$\{marker\.kind\}:\$\{marker\.id\}`/);
  assert.match(mapSource, /key=\{markerIdentity\(marker\)\}/);
  assert.match(pageSource, /marker\.kind === 'mountain'[\s\S]*showDetail\('mountain', marker\.id\)/);
  assert.match(pageSource, /marker\.kind === 'course'[\s\S]*showDetail\('course', marker\.id\)/);
  assert.match(pageSource, /showDetail\('spot', marker\.id\)/);
  assert.match(pageSource, /targetId: spot\.id/);
});

test('커뮤니티 지도는 현재 영역의 공식 시설을 조회하고 출처를 구분해 표시한다', () => {
  const apiSource = readFileSync(new URL('../src/api/community.ts', import.meta.url), 'utf8');
  const mapSource = readFileSync(new URL('../src/pages/CommunityPage/components/CommunityMap.tsx', import.meta.url), 'utf8');
  const pageSource = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(apiSource, /west: String\(bounds\.west\)[\s\S]*north: String\(bounds\.north\)/);
  assert.match(mapSource, /map\.on\('moveend', report\)/);
  assert.match(pageSource, /communityApi\.spots\(mountainId, queryBounds, controller\.signal, type\)/);
  assert.match(pageSource, /targetType: spot\.targetType/);
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

test('커뮤니티 메인과 산·스팟 후기 상세 지도에 선택한 산의 모든 코스 경로를 표시한다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /allCourseRoutes = useMemo\(\(\) => visibleCourseTargets\.map\(course => \(\{/);
  assert.match(source, /showAllCourseRoutes = screen === 'map' \|\| screen === 'mountainDetail' \|\| screen === 'spotDetail'/);
  assert.match(source, /highlightedRoutes=\{showAllCourseRoutes \? allCourseRoutes : undefined\}/);
  assert.match(source, /highlightedRoute=\{screen === 'courseDetail' \? selectedCourse\.coordinates : undefined\}/);
});

test('커뮤니티 전체 화면은 코스 목록의 집계와 대표 사진을 재사용하고 상세 진입 시에만 미리보기를 조회한다', () => {
  const apiSource = readFileSync(new URL('../src/api/community.ts', import.meta.url), 'utf8');
  const pageSource = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(apiSource, /CommunityCourseDto[\s\S]*representativePhotoUrl: string \| null/);
  assert.doesNotMatch(pageSource, /courseResult\.map\(course => communityApi\.courseReviews/);
  assert.match(pageSource, /activePhotoKind === 'course' \? communityApi\.coursePreview\(selectedCourse\.id/);
  assert.match(pageSource, /코스 후기 \(\{visibleCourseTargets\.length\}개\)/);
  assert.match(pageSource, /course\.representativePhotoUrl/);
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
  assert.match(mapSource, /courseDetailDimension === '3D'[\s\S]*map\.cameraForBounds\(bounds, \{ padding, offset: \[0, -72\], maxZoom: 16 \}\)/);
  assert.match(mapSource, /camera\.zoom \?\? map\.getZoom\(\)\) \+ 0\.7, 16/);
  assert.match(pageSource, /communityApi\.spotDetail\([\s\S]*setDetailSpotFocus\(current => current[\s\S]*coordinate: spot\.coordinate/);
  assert.match(mapSource, /spotDetail3D = className\?\.includes\('community-page__map--detail-spot'\) && dimension === '3D'/);
  assert.match(mapSource, /if \(spotDetail3D && terrainStatus !== 'ready' && terrainStatus !== 'error'\) return/);
  assert.match(mapSource, /spotDetailTerrainReady = spotDetail3D && terrainStatus === 'ready'/);
  assert.match(mapSource, /if \(spotDetailTerrainReady\) \{[\s\S]*map\.easeTo\(\{ center: focusTarget\.coordinate,[\s\S]*duration: 0 \}\)[\s\S]*map\.panBy\([\s\S]*duration: 0[\s\S]*map\.jumpTo\(initialCamera\)[\s\S]*map\.easeTo\(\{ \.\.\.camera,[\s\S]*duration: reducedMotion \? 0 : 550/);
  assert.match(mapSource, /\}, \[map, focusTarget, className, highlightedRoute, isMainMap, courseDetailDimension, spotDetail3D, spotDetailTerrainReady, terrainStatus, dimension\]\)/);
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

test('24시간 이내 완료 산행은 같은 코스라도 각각 최신순으로 표시한다', () => {
  const now = Date.parse('2026-10-18T12:00:00+09:00');
  const hike = (id, courseId, hours) => ({ id, courseId, mountainId: 'bukhansan', courseName: courseId, distanceKm: 4.2,
    finishedAt: new Date(now - hours * 60 * 60 * 1000).toISOString() });
  const eligible = eligibleCourseCompletions([
    hike('a-old', 'course-a', 8), hike('b', 'course-b', 2), hike('a-new', 'course-a', 1), hike('expired', 'course-c', 25),
  ], 'bukhansan', now);
  assert.deepEqual(eligible.map(item => item.id), ['a-new', 'b', 'a-old']);
  assert.equal(canWriteCourseReview(eligible, 'bukhansan', 'course-a', 'a-new', now), true);
  assert.equal(canWriteCourseReview(eligible, 'bukhansan', 'course-b', 'a-new', now), false);
  assert.equal(canWriteCourseReview(eligible, 'bukhansan', 'course-a', 'a-old', now), true);
});

test('일반 코스 상세는 사진 없이 최신 후기 2개만 요청한다', () => {
  const source = readFileSync(new URL('../src/pages/CourseDetailPage/CourseDetailPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /communityApi\.courseReviews\(String\(course\.courseId\), controller\.signal, 2\)/);
  assert.doesNotMatch(source, /communityApi\.coursePhotos/);
});
