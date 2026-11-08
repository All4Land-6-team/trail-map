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
  assert.match(mapSource, /CLUSTER_CHOICE_MIN_ZOOM = CLUSTER_CHOICE_ZOOM/);
  assert.doesNotMatch(mapSource, /spreadOverlappingMarkers/);
  assert.match(mapSource, /currentZoom >= OVERLAP_RELEASE_ZOOM[\s\S]*map\(item => \[item\]\)/);
  assert.match(mapSource, /targetZoom = Math\.min\(CLUSTER_CHOICE_ZOOM, map\.getMaxZoom\(\)\)/);
  assert.match(mapSource, /map\.getZoom\(\) < targetZoom/);
  assert.match(mapSource, /remainingCluster\.overlap >= 2/);
  assert.match(mapSource, /markers: remainingCluster\.placement\.group\.map/);
  assert.match(cssSource, /community-map__cluster span \{[^}]*width:30px;[^}]*height:30px/);
  assert.doesNotMatch(mapSource, /map\.on\('zoomstart'/);
  assert.match(mapSource, /element\.classList\.add\('community-map__marker--appearing'\)/);
  assert.match(mapSource, /element\.classList\.add\('community-map__marker--disappearing'\)/);
  assert.match(cssSource, /community-map__marker--appearing \.community-map__pin \{[^}]*animation:community-map-marker-appear 180ms cubic-bezier\(\.22,1,\.36,1\)/);
  assert.match(cssSource, /community-map__marker--disappearing \.community-map__pin \{[^}]*animation:community-map-marker-disappear 120ms ease-in forwards/);
  assert.match(cssSource, /@media\(prefers-reduced-motion:reduce\) \{[^}]*community-map__marker--appearing[^}]*community-map__marker--disappearing[^}]*animation:none/);
  assert.match(cssSource, /community-map__pin \.af-spot-marker \{[^}]*width:44px;[^}]*height:44px/);
  assert.match(cssSource, /community-map__pin \.af-spot-marker::before \{[^}]*inset:6px/);
  assert.match(cssSource, /community-picker \.community-map__pin--selected \.af-spot-marker::before \{[^}]*border:2px solid var\(--af-green\)/);
  assert.match(cssSource, /community-picker \.community-map__pin--selected \.af-spot-marker::after \{[^}]*content:"\\2713"/);
  assert.match(cssSource, /community-map__cluster-choices \{[^}]*left:calc\(50% \+ 19px\);[^}]*width:164px;[^}]*padding:10px/);
  assert.match(cssSource, /community-map__cluster-choices \{[^}]*overflow-y:auto;[^}]*overscroll-behavior:contain;[^}]*touch-action:pan-y/);
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
  const gallery = readFileSync(new URL('../src/pages/CommunityPage/components/SpotPhotoGallery.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/pages/CommunityPage/community.css', import.meta.url), 'utf8');
  assert.match(source, /photoPage\.loading && photoPage\.items\.length === 0 && <CommunityPhotoSkeleton/);
  assert.match(gallery, /className="community-gallery-more-card"[\s\S]*사진<br \/>더보기/);
  assert.doesNotMatch(gallery, />전체보기/);
  assert.match(styles, /community-gallery-more-card \{[^}]*flex:0 0 96px;[^}]*height:150px/);
  assert.doesNotMatch(styles, /community-sheet-enter/);
});

test('스팟·코스 상세 바텀시트는 드래그 중 단계 높이를 다시 측정하지 않는다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/hooks/useCommunitySheet.ts', import.meta.url), 'utf8');
  assert.match(source, /stops: detail \? detailStops\(\) : undefined/);
  assert.match(source, /magnetizedHeight\(rawHeight, current\.stops\)/);
  assert.match(source, /const stops = current\.stops \?\? detailStops\(\)/);
  assert.match(source, /renderDragHeight\(nextHeight\)/);
  assert.match(source, /pendingDragHeight\.current = height[\s\S]*requestAnimationFrame/);
  assert.match(source, /currentSheet\(\)\?\.style\.setProperty\('--community-sheet-height'/);
  assert.doesNotMatch(source, /rootRef\.current\?\.style\.setProperty\('--community-sheet-height'/);
  assert.doesNotMatch(source, /function magnetizedHeight\(rawHeight: number\) \{[\s\S]*DETAIL_LEVELS\.map/);
});

test('상세 바텀시트는 콘텐츠를 제거하지 않고 측정한 단계 높이로 잘라서 표시한다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/hooks/useCommunitySheet.ts', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/pages/CommunityPage/community.css', import.meta.url), 'utf8');
  assert.match(source, /new ResizeObserver\(measure\)/);
  assert.match(source, /detailHeights\[detailLevel\]/);
  assert.match(source, /expandedHeight\(reviews, maximum\)/);
  assert.doesNotMatch(styles, /\.community-page__sheet--detail\.community-page__sheet--peek \.af-bottom-sheet__content \{ display:none; \}/);
  assert.doesNotMatch(styles, /\.community-page__sheet--detail\.community-page__sheet--collapsed \.af-bottom-sheet__body \{ display:none; \}/);
});

test('상세 바텀시트는 사진에서 이름 단계로 이동할 때 버튼 하단 여백을 유지한다', () => {
  const styles = readFileSync(new URL('../src/pages/CommunityPage/community.css', import.meta.url), 'utf8');
  assert.match(styles, /\.community-page__sheet:not\(\.community-page__sheet--detail\)\.community-page__sheet--peek \{ padding-bottom:0; \}/);
  assert.doesNotMatch(styles, /\n\.community-page__sheet--peek \{ padding-bottom:0; \}/);
  assert.match(styles, /\.community-page__sheet--detail\.community-page__sheet--collapsed \{ min-height:0; padding-bottom:0; \}/);
});

test('커뮤니티 목록 바텀시트는 드래그 중 React 상태를 반복 갱신하지 않는다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/hooks/useCommunitySheet.ts', import.meta.url), 'utf8');
  const pointerMove = source.slice(source.indexOf('const onPointerMove'), source.indexOf('const onPointerCancel'));
  assert.match(pointerMove, /renderDragHeight\(nextHeight\)/);
  assert.doesNotMatch(pointerMove, /setDragHeight\(nextHeight\)/);
});

test('전체·스팟·코스 목록 바텀시트는 놓은 높이를 유지하면서 최대 높이까지 조절한다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/hooks/useCommunitySheet.ts', import.meta.url), 'utf8');
  assert.match(source, /const content = detail \|\| mapPreview \? maximumHeight\(\) : contentHeight\(\)/);
  assert.match(source, /mapPreview && height > PEEK_HEIGHT \+ SNAP_MAGNET_DISTANCE[\s\S]*setMapHeight\(height\)[\s\S]*settle\('content', height, height\)/);
});

test('커뮤니티 바텀시트는 손잡이만 높이를 조절하고 본문 스크롤을 가로채지 않는다', () => {
  const page = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/pages/CommunityPage/community.css', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /\{\.\.\.sheetDragProps\}/);
  assert.doesNotMatch(styles, /community-page__sheet--detail \{ touch-action:none/);
  assert.match(styles, /community-page__sheet \.af-bottom-sheet__content \{[^}]*overflow-y:auto;[^}]*overscroll-behavior-y:contain/);
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
  assert.match(source, /onPointerDown=\{event => event\.stopPropagation\(\)\} onWheel=\{event => event\.stopPropagation\(\)\} onTouchMove=\{event => event\.stopPropagation\(\)\}/);
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
    assert.equal('X-User-Id' in calls[0].init.headers, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('등산 완료 화면에서 바로 연 산 후기 폼에 서버의 완료 산행을 연결한다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /initialScreen === 'review' \? communityApi\.mountainEligibility/);
  assert.match(source, /if \(initialScreen === 'review'\) setReviewEligibleCourses\(initialReviewHikes\)/);
  assert.match(source, /setDraft\(current => current\.kind === 'mountain'[\s\S]*completedHikeId: initialReviewHikes\[0\]\.id/);
});

test('코스 후기 폼은 코스 선택, 평점, 내용, 사진 순서로 표시한다', () => {
  const form = readFileSync(new URL('../src/pages/CommunityPage/components/ReviewForm.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/pages/CommunityPage/community.css', import.meta.url), 'utf8');
  const coursePicker = form.indexOf('community-course-options');
  const rating = form.indexOf('community-rating-section');
  const content = form.indexOf('<MultilineField');
  const photos = form.indexOf('<PhotoField');
  assert.ok(coursePicker < rating && rating < content && content < photos);
  assert.match(styles, /community-form-layout--review-course \.community-rating-section \.af-rating-input__star \{[^}]*color:#d98a26;[^}]*font-size:34px/);
  assert.match(form, /aria-label="코스 후기 작성 조건"[\s\S]*최근 24시간 안에 완료한 코스만 표시됩니다\./);
  assert.match(styles, /community-form-layout--review \.community-field-label \{ font-size:14px; line-height:20px; \}/);
  assert.match(styles, /community-form-layout--review \.community-photo-field \.af-photo-slot--add,[\s\S]*community-form-layout--review \.community-photo-field \.af-photo-slot--photo \{ width:100px; height:100px; \}/);
});

test('코스 전체 후기 등록은 코스 ID 없이도 완료 산행을 조회한다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /kind === 'course'[\s\S]*targetId[\s\S]*communityApi\.courseEligibility\(targetId\)[\s\S]*communityApi\.eligibleHikes\(mountainId\)/);
});

test('스팟 후기 등록은 완료 산행을 확인한 뒤 선택 화면을 연다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /const startMapReview = async[\s\S]*communityApi\.eligibleHikes\(mountainId\)[\s\S]*eligibleHikes\.length === 0[\s\S]*notify\(reviewEligibilityMessage\)[\s\S]*move\('spotPicker'\)/);
});

test('산행 후 스팟 등록은 가장 최근에 완료한 코스를 기본 경로로 사용한다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /\[\.\.\.eligibility\.hikes\][\s\S]*Date\.parse\(b\.endedAt\) - Date\.parse\(a\.endedAt\)/);
  assert.match(source, /screen !== 'newSpot' \|\| spotRegistrationMode === 'active'[\s\S]*communityApi\.eligibleHikes\(mountainId, controller\.signal\)/);
  assert.match(source, /completedCourse = courses\.find\(course => course\.id === eligibleHikes\[0\]\?\.courseId\)/);
});

test('커뮤니티의 스팟 등록 지도는 선택한 산의 최근 완료 코스들을 표시하고 현재 위치를 요청하지 않는다', () => {
  const page = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  const registration = readFileSync(new URL('../src/pages/CommunityPage/components/SpotRegistration.tsx', import.meta.url), 'utf8');
  assert.match(page, /spotRegistrationCourses = useMemo[\s\S]*eligibleCourses\.flatMap/);
  assert.match(registration, /mode === 'postHike'[\s\S]*최근에 다녀온 코스/);
  assert.match(registration, /highlightedRoutes=\{mode === 'postHike' \? recentRoutes : undefined\}/);
  assert.doesNotMatch(registration, /requestAnimationFrame\(locate\)/);
});

test('스팟 등록 지도는 등산 중 현재 위치를 우선하고 실패하면 전달받은 코스 전체를 표시한다', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const activePage = readFileSync(new URL('../src/pages/HikeActivePage/HikeActivePage.tsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  const registration = readFileSync(new URL('../src/pages/CommunityPage/components/SpotRegistration.tsx', import.meta.url), 'utf8');
  const map = readFileSync(new URL('../src/pages/CommunityPage/components/CommunityMap.tsx', import.meta.url), 'utf8');
  // 서버 일정은 실제 산·코스 ID를, 예시 일정은 기존 화면 ID를 전달한다.
  assert.match(activePage, /const target = hikeTargetIds\(session\);[\s\S]*mode: "active"[\s\S]*course: target\.courseId/);
  assert.match(activePage, /if \(target\.mountainId\) query\.set\("mountain", target\.mountainId\)/);
  assert.match(app, /spotRegistrationMode=\{query\.get\('mode'\) === 'active' \? 'active' : 'postHike'\}/);
  assert.match(app, /currentPosition: hikeSession\.currentPosition/);
  assert.match(page, /DEV_COURSE_IDS\[courseId\][\s\S]*course\.id === String\(dbCourseId\)/);
  assert.match(registration, /initialCoordinate \? \{ coordinate: initialCoordinate/);
  assert.doesNotMatch(registration, /requestAnimationFrame\(locate\)/);
  assert.doesNotMatch(registration, /cooperativeGestures/);
  assert.match(registration, /ariaLabel="새 스팟 위치 지정" onMapSelect=/);
  assert.match(registration, /center=\{mountainCenter\}[\s\S]*fitHighlightedRoute=\{!locationFocus\}/);
  assert.match(page, /activePickerPosition[\s\S]*name: '현재 위치'[\s\S]*focusTarget=\{spotPickerFocus \?\? undefined\}[\s\S]*fitHighlightedRoute=\{spotRegistrationMode === 'active' && !spotPickerFocus\}/);
  assert.doesNotMatch(registration, /mountainSpots\[0\]\?\.coordinate \?\? mountainCenter/);
  assert.match(map, /fitHighlightedRoute[\s\S]*map\.fitBounds/);
});

test('등산 중 스팟 등록은 GPS 현재 위치와 사용자가 선택한 위치를 분리해 표시한다', () => {
  const registration = readFileSync(new URL('../src/pages/CommunityPage/components/SpotRegistration.tsx', import.meta.url), 'utf8');
  const map = readFileSync(new URL('../src/pages/CommunityPage/components/CommunityMap.tsx', import.meta.url), 'utf8');
  const marker = readFileSync(new URL('../src/components/map/CurrentLocationMarker.tsx', import.meta.url), 'utf8');
  const markerCss = readFileSync(new URL('../src/components/map/CurrentLocationMarker.css', import.meta.url), 'utf8');
  assert.match(registration, /kind: 'current-location'[\s\S]*kind: 'point'/);
  assert.match(registration, /onMapSelect=\{point => \{ setCoordinate\(point\)/);
  assert.match(map, /marker\.kind !== 'mountain' && marker\.kind !== 'current-location'/);
  assert.match(map, /marker\.kind === 'current-location'[\s\S]*<CurrentLocationMarker/);
  assert.match(marker, /current-location-marker__pulse[\s\S]*current-location-marker__pulse[\s\S]*current-location-marker__dot/);
  assert.match(markerCss, /2\.7s ease-out infinite/);
  assert.match(markerCss, /animation-delay: 1\.35s/);
  assert.match(markerCss, /prefers-reduced-motion: reduce/);
});

test('새 스팟은 사진 없이 임시 보관하고 후기 제출 때 첫 후기와 함께 등록한다', () => {
  const page = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  const registration = readFileSync(new URL('../src/pages/CommunityPage/components/SpotRegistration.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(registration, /PhotoField/);
  assert.match(page, /setPendingSpot\(\{ name: spot\.name[\s\S]*clientRequestId: crypto\.randomUUID\(\)/);
  assert.match(page, /draft\.kind === 'spot' && pendingSpot[\s\S]*communityApi\.createSpot/);
  assert.match(page, /title: '사진을 올리지 못했어요'[\s\S]*void upload\(\)/);
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

test('커뮤니티 상세는 대상별 필요한 데이터를 중복 호출 없이 조회한다', () => {
  const apiSource = readFileSync(new URL('../src/api/community.ts', import.meta.url), 'utf8');
  const pageSource = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(apiSource, /CommunityCourseDto[\s\S]*representativePhotoUrl: string \| null/);
  assert.doesNotMatch(pageSource, /courseResult\.map\(course => communityApi\.courseReviews/);
  assert.match(pageSource, /communityApi\.coursePreview\(selectedCourse\.id/);
  assert.doesNotMatch(apiSource, /spotPreview/);
  assert.match(pageSource, /communityApi\.spotDetail\([\s\S]*result\.reviews[\s\S]*result\.photos/);
  assert.match(pageSource, /코스 후기 \(\{visibleCourseTargets\.length\}개\)/);
  assert.match(pageSource, /course\.representativePhotoUrl/);
});

test('완료 산행 목록은 산행 후 새 스팟 등록 화면에서만 조회한다', () => {
  const source = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(screen !== 'newSpot' \|\| spotRegistrationMode === 'active' \|\| !mountainId \|\| courses\.length === 0\) return[\s\S]*communityApi\.eligibleHikes/);
  assert.doesNotMatch(source, /Promise\.all\(\[[\s\S]{0,500}communityApi\.eligibleHikes/);
});

test('현재 코스와 새 코스는 courseId별로 겹치지 않는 고정 색상을 생성한다', () => {
  const colors = Array.from({ length: 100 }, (_, index) => communityCourseColor(String(index + 1)));
  assert.equal(new Set(colors).size, colors.length);
  assert.equal(communityCourseColor('123'), communityCourseColor('123'));
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

test('일반 코스 상세는 사진 없이 최신 후기 4개만 요청한다', () => {
  const source = readFileSync(new URL('../src/pages/CourseDetailPage/CourseDetailPage.tsx', import.meta.url), 'utf8');
  assert.match(source, /communityApi\.courseReviews\(String\(course\.courseId\), controller\.signal, 4\)/);
  assert.doesNotMatch(source, /communityApi\.coursePhotos/);
});

test('산·코스·스팟 상세 후기는 공통 가로 캐러셀을 사용한다', () => {
  const communitySource = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  const courseSource = readFileSync(new URL('../src/pages/CourseDetailPage/components/CourseAnalysis.tsx', import.meta.url), 'utf8');
  const carouselSource = readFileSync(new URL('../src/components/review/ReviewCarousel.tsx', import.meta.url), 'utf8');
  const cardSource = readFileSync(new URL('../src/components/review/ReviewCarouselCards.tsx', import.meta.url), 'utf8');
  assert.equal((communitySource.match(/<ReviewCarousel type=/g) ?? []).length, 3);
  assert.match(courseSource, /<ReviewCarousel type="course"/);
  assert.match(carouselSource, /MoreReviewsCard/);
  assert.match(carouselSource, /scrollIntoView/);
  assert.match(cardSource, /'☆'\.repeat\(5 - rating\)/);
  assert.match(cardSource, /review\.rating != null && <> \{review\.rating\.toFixed\(1\)\}<\/>/);
  assert.match(cardSource, /community-review-card__photo--placeholder/);
  assert.match(cardSource, /아직 등록된 후기가 없어요\./);
});

test('이미 작성한 스팟 후기와 새 스팟 등록 지도 클릭을 구분한다', () => {
  const apiSource = readFileSync(new URL('../src/api/community.ts', import.meta.url), 'utf8');
  const pageSource = readFileSync(new URL('../src/pages/CommunityPage/CommunityPage.tsx', import.meta.url), 'utf8');
  const registrationSource = readFileSync(new URL('../src/pages/CommunityPage/components/SpotRegistration.tsx', import.meta.url), 'utf8');
  const cssSource = readFileSync(new URL('../src/pages/CommunityPage/community.css', import.meta.url), 'utf8');
  assert.match(pageSource, /오늘 산행에서 해당 스팟 후기를 이미 작성했어요\./);
  assert.match(pageSource, /error instanceof CommunityApiError && error\.status === 409/);
  assert.match(apiSource, /review-eligibility\$\{hikeRecordId \? `\?hikeRecordId=\$\{hikeRecordId\}` : ''\}/);
  assert.match(apiSource, /eligibilityCode: 'ELIGIBLE' \| 'NO_COMPLETED_HIKE' \| 'ALREADY_REVIEWED'/);
  assert.match(pageSource, /eligibility\.eligibilityCode !== 'ELIGIBLE'/);
  assert.match(pageSource, /notify\(eligibility\.reason \?\? reviewEligibilityMessage\)/);
  assert.match(cssSource, /community-registration-error\.af-modal-layer \{[^}]*display:grid;[^}]*place-items:center/);
  assert.doesNotMatch(registrationSource, /onMarkerSelect=\{marker => \{ const found = spots\.find/);
  assert.match(registrationSource, /label="기존 스팟에 추가" onClick=\{\(\) => onUseExisting\(spot\)\}/);
});
