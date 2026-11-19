import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildHikeRouteSegments, COURSE_ROUTE_COLOR, GRAY_ROUTE_COLOR } from '../src/components/hike/hikeRouteSegments.ts';
import { distanceMeters } from '../src/utils/hikeTracking.ts';

const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('세 등산 화면은 카드 없는 SunArc를 쓰고 등산·하산 중에는 진행 시트 위에 둔다', () => {
  const today = read('pages/HikeTodayPage/HikeTodayPage.tsx');
  const active = read('pages/HikeActivePage/HikeActivePage.tsx');
  const descent = read('pages/HikeDescentPage/HikeDescentPage.tsx');
  const sunCss = read('components/hike/SunArc.css');

  assert.match(today, /hike-today-page__bottom/);
  for (const page of [active, descent]) {
    assert.doesNotMatch(page, /HikeStatusHUD/);
    assert.ok(page.indexOf('<SunArc') < page.indexOf('<HikeProgressPanel'));
  }
  assert.doesNotMatch(sunCss, /\.af-sun-arc\s*\{[^}]*background:/s);
  assert.doesNotMatch(sunCss, /\.af-sun-arc\s*\{[^}]*border:/s);
});

test('등산의 주 조작은 원형 Play 또는 Pause 버튼이고 보조 동작은 캡슐 버튼이다', () => {
  const controls = read('components/hike/HikeFloatingControls.tsx');
  const css = read('components/hike/HikeFloatingUI.css');
  const today = read('pages/HikeTodayPage/HikeTodayPage.tsx');
  const active = read('pages/HikeActivePage/HikeActivePage.tsx');
  const descent = read('pages/HikeDescentPage/HikeDescentPage.tsx');

  assert.match(controls, /state: "start" \| "recording" \| "paused"/);
  assert.match(controls, /showMain\?: boolean/);
  assert.match(controls, /af-hike-control__start/);
  assert.match(controls, /af-hike-control__circle/);
  assert.match(controls, /af-hike-control__secondary/);
  assert.match(css, /\.af-hike-control__circle\s*\{[^}]*width:\s*56px;[^}]*height:\s*56px/s);
  assert.match(css, /\.af-hike-control__circle\s*\{[^}]*border-radius:\s*50%/s);
  assert.match(css, /\.af-hike-control__start\s*\{[^}]*border-radius:\s*999px/s);
  assert.doesNotMatch(today, /showMain=\{false\}/);
  // 등산·하산 중 조작(하산 시작·등산 종료)은 진행 시트 버튼으로 한다.
  assert.match(active, /<HikeProgressPanel[\s\S]*?onStartDescent=[\s\S]*?onEnd=/);
  assert.match(descent, /<HikeProgressPanel[\s\S]*?onEnd=/);
  assert.doesNotMatch(descent, /onStartDescent/);
});

test('SunArc 영역은 지도와 이어지는 그라데이션을 쓰고 진행 시트를 따라 움직인다', () => {
  const todayCss = read('pages/HikeTodayPage/HikeTodayPage.css');
  const activeCss = read('pages/HikeActivePage/HikeActivePage.css');

  assert.match(todayCss, /\.hike-today-page__bottom\s*\{[^}]*linear-gradient/s);
  assert.match(activeCss, /\.hike-active-page__sun\s*\{[^}]*linear-gradient/s);
  assert.match(activeCss, /\.hike-active-page__sun\s*\{[^}]*bottom:\s*calc\(var\(--hike-sheet-inset/s);
  assert.match(todayCss, /transparent 0 56%/);
});

test('SunArc는 화면 안쪽의 둥근 아치이며 지나온 구간만 채운다', () => {
  const sunArc = read('components/hike/SunArc.tsx');
  const sunCss = read('components/hike/SunArc.css');
  const today = read('pages/HikeTodayPage/HikeTodayPage.tsx');
  const active = read('pages/HikeActivePage/HikeActivePage.tsx');
  const descent = read('pages/HikeDescentPage/HikeDescentPage.tsx');

  assert.match(sunArc, /M 76 126 A 110 110 0 0 1 284 126/);
  assert.match(sunArc, /getPointAtLength/);
  assert.match(sunArc, /strokeDasharray/);
  assert.match(sunArc, /radialGradient/);
  assert.doesNotMatch(sunArc, /sun-arc-track-/);
  assert.match(sunArc, /#ffb875/);
  assert.match(sunArc, /#fff3b5/);
  assert.match(sunCss, /\.af-sun-arc\s*\{[^}]*width:\s*100%/s);
  assert.match(sunCss, /\.af-sun-arc__track\s*\{[^}]*rgb\(255 255 255 \/ 56%\)/s);
  assert.match(sunCss, /\.af-sun-arc__graphic\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(sunCss, /stroke-width:\s*8/);
  assert.match(sunCss, /span:first-child\s*\{[^}]*left:\s*21\.11%/s);
  assert.match(sunCss, /span:last-child\s*\{[^}]*left:\s*78\.89%/s);
  assert.match(today, /className="hike-sun-controls"[\s\S]*?<SunArc[\s\S]*?<HikeFloatingControls[\s\S]*?<\/div>/);
  for (const page of [active, descent]) {
    assert.match(page, /className="hike-active-page__sun"[\s\S]*?<SunArc[\s\S]*?<\/div>/);
  }
});

test('진행 정보는 지도 경로 색상과 하단 진행 시트(진행률·이동·남은 거리)로 표시한다', () => {
  const status = read('components/hike/HikeStatusHUD.tsx');
  const panel = read('components/hike/HikeProgressPanel.tsx');
  const map = read('components/hike/HikeRouteMap.tsx');
  const active = read('pages/HikeActivePage/HikeActivePage.tsx');
  const descent = read('pages/HikeDescentPage/HikeDescentPage.tsx');

  assert.doesNotMatch(status, /af-hike-status__metrics|af-hike-status__track|남은/);
  assert.match(map, /buildHikeRouteSegments/);
  assert.match(panel, /role="progressbar"/);
  assert.match(panel, /진행률/);
  assert.match(panel, /이동 거리/);
  assert.match(panel, /남은 거리/);
  for (const page of [active, descent]) assert.match(page, /progressPercent=\{controls\.progressPercent\}/);
  assert.match(active, /stage=\{session\.phase === "downhill" \? "descent" : "ascent"\}/);
  assert.match(descent, /stage="descent"/);
  assert.match(active, /progressMeters=\{controls\.progressMeters\}/);
  assert.match(descent, /progressMeters=\{controls\.progressMeters\}/);
});

test('등산·하산 모두 지나온 경로는 회색, 앞으로 갈 경로는 원래 색으로 표시한다', () => {
  const route = [[126.95, 37.63], [126.95, 37.64], [126.96, 37.64]];
  const partial = distanceMeters(route[0], route[1]) / 2;

  const ascent = buildHikeRouteSegments(route, 'ascent', partial);
  assert.deepEqual(ascent.map(segment => segment.color), [GRAY_ROUTE_COLOR, COURSE_ROUTE_COLOR]);
  assert.deepEqual(ascent[0].coordinates.at(-1), ascent[1].coordinates[0]);

  const descent = buildHikeRouteSegments(route, 'descent', partial);
  assert.deepEqual(descent.map(segment => segment.color), [GRAY_ROUTE_COLOR, COURSE_ROUTE_COLOR]);
  assert.deepEqual(descent[0].coordinates.at(-1), descent[1].coordinates[0]);

  assert.deepEqual(buildHikeRouteSegments(route, 'ascent', 0).map(segment => segment.color), [COURSE_ROUTE_COLOR]);
  assert.deepEqual(buildHikeRouteSegments(route, 'descent', Infinity).map(segment => segment.color), [GRAY_ROUTE_COLOR]);
  assert.deepEqual(buildHikeRouteSegments(route, 'descent', undefined, 1).map(segment => segment.color),
    [GRAY_ROUTE_COLOR, COURSE_ROUTE_COLOR]);
});
