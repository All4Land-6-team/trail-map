import test from "node:test";
import assert from "node:assert/strict";
import { bearingDegrees, cameraForTwoPoints, chaikinSmooth, routeBehind, splitRouteAt, navigationFix, pointAlongRoute, routeAhead, simplifyPath, smoothLine } from "../src/utils/hikeNavigation.ts";
import { distanceToCourseMeters } from "../src/utils/hikeTracking.ts";

// 위도 0.001도 ≈ 111m. 북쪽으로 222m 올라간 뒤 동쪽으로 꺾는 코스
const route = [[127, 37.5], [127, 37.501], [127, 37.502], [127.002, 37.502]];
const near = (actual, expected, tolerance = 1) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≉ ${expected}`);

test("방위각은 북쪽 0도, 동쪽 90도, 남쪽 180도, 서쪽 270도다", () => {
  near(bearingDegrees([127, 37.5], [127, 37.6]), 0);
  near(bearingDegrees([127, 37.5], [127.1, 37.5]), 90);
  near(bearingDegrees([127, 37.5], [127, 37.4]), 180);
  near(bearingDegrees([127, 37.5], [126.9, 37.5]), 270);
});

test("코스를 따라 지정한 거리만큼 간 지점을 구하고 범위를 벗어나면 끝점에 멈춘다", () => {
  const point = pointAlongRoute(route, 55.6);
  near(point[1], 37.5005, 0.00001);
  assert.deepEqual(pointAlongRoute(route, -10), route[0]);
  assert.deepEqual(pointAlongRoute(route, 100_000), route.at(-1));
  assert.equal(pointAlongRoute([], 10), undefined);
});

test("남은 경로는 현재 지점에서 시작해 코스 끝까지 이어진다", () => {
  const ahead = routeAhead(route, 150);
  near(ahead[0][1], 37.50135, 0.00002);
  assert.deepEqual(ahead.slice(1), route.slice(2));
  assert.deepEqual(routeAhead(route, 100_000), []);
});

test("코스 위에서는 앞으로 갈 코스 방향을 진행 방향으로 쓴다", () => {
  const fix = navigationFix(route, [127, 37.5005]);
  near(fix.bearing, 0);
  near(fix.alongMeters, 55.6);
});

test("꺾이는 지점 근처에서는 내다보는 지점 쪽으로 방향이 돈다", () => {
  const fix = navigationFix(route, [127, 37.50199]);
  assert.ok(fix.bearing > 45 && fix.bearing < 91, `${fix.bearing}`);
});

test("코스에서 조금 벗어나도 코스 방향을 따른다", () => {
  const fix = navigationFix(route, [127.0002, 37.5005]); // 동쪽으로 약 18m
  near(fix.bearing, 0);
});

test("코스 끝에서는 직전 구간 방향을 유지한다", () => {
  const fix = navigationFix(route, route.at(-1));
  near(fix.bearing, 90);
  assert.deepEqual(fix.ahead, []);
});

test("코스 좌표가 2개 미만이면 계산하지 않는다", () => {
  assert.equal(navigationFix([[127, 37.5]], [127, 37.5]), null);
});

test("자잘한 꺾임(3m 이하)은 지우고 큰 꺾임은 남긴다", () => {
  const jitter = [[127, 37.5], [127.00001, 37.5005], [127, 37.501], [127.002, 37.501]]; // 가운데 점은 약 0.9m 벗어남
  assert.deepEqual(simplifyPath(jitter), [[127, 37.5], [127, 37.501], [127.002, 37.501]]);
  assert.deepEqual(simplifyPath(route.slice(0, 2)), route.slice(0, 2));
});

test("모서리를 깎아 곡선으로 만들고 양 끝점은 그대로 둔다", () => {
  const corner = [[127, 37.5], [127, 37.501], [127.001, 37.501]];
  const smooth = chaikinSmooth(corner, 1);
  assert.equal(smooth.length, 6);
  assert.deepEqual(smooth[0], corner[0]);
  assert.deepEqual(smooth.at(-1), corner.at(-1));
  assert.ok(!smooth.some(([lng, lat]) => lng === 127 && lat === 37.501), "꼭짓점은 깎여 없어진다");
});

test("다듬은 선은 원래 코스에서 크게 벗어나지 않는다", () => {
  const smooth = smoothLine(route);
  assert.ok(smooth.length > route.length);
  smooth.forEach(point => assert.ok(distanceToCourseMeters(route, point) < 40, `${point}`));
});

test("코스에서 벗어난 거리와 가장 가까운 코스 지점을 알려 준다", () => {
  const fix = navigationFix(route, [126.997, 37.5005]); // 서쪽으로 약 265m
  near(fix.offCourseMeters, 265, 3);
  assert.deepEqual(fix.onCourse.map(v => v.toFixed(5)), ["127.00000", "37.50050"]);
});

test("두 지점을 함께 보여 줄 중심은 가운데, 멀수록 덜 확대하고 최대 확대 수준을 넘지 않는다", () => {
  const near1 = cameraForTwoPoints([127, 37.5], [127, 37.503], 300, 17);
  const far1 = cameraForTwoPoints([127, 37.5], [127, 37.55], 300, 17);
  assert.deepEqual(near1.center.map(v => v.toFixed(4)), ["127.0000", "37.5015"]);
  assert.ok(far1.zoom < near1.zoom);
  assert.equal(cameraForTwoPoints([127, 37.5], [127, 37.50001], 300, 17).zoom, 17);
});

test("다듬어 둔 코스를 현재 위치에서 자르면 위치가 바뀌어도 앞 경로 곡선은 같은 점들을 쓴다", () => {
  const smooth = smoothLine(route);
  const key = point => point.map(v => v.toFixed(9)).join(",");
  const all = new Set(smooth.map(key));
  for (const position of [[127, 37.5003], [127, 37.5012], [127.0005, 37.502]]) {
    const { behind, ahead } = splitRouteAt(smooth, position);
    // 잘린 첫 점(현재 위치 지점)만 새로 생기고 나머지는 모두 원래 곡선의 점이다
    ahead.slice(1).forEach(point => assert.ok(all.has(key(point))));
    behind.slice(0, -1).forEach(point => assert.ok(all.has(key(point))));
    assert.deepEqual(behind.at(-1), ahead[0]);
  }
});

test("지나온 경로에 위치가 더해져도 이미 그린 앞부분 곡선은 바뀌지 않는다", () => {
  const path = [[127, 37.5], [127, 37.5003], [127.0003, 37.5006], [127.0003, 37.5009], [127.0006, 37.5012]];
  const before = chaikinSmooth(path);
  const after = chaikinSmooth([...path, [127.0006, 37.5016]]);
  const stable = before.length - 8; // 마지막 몇 점(끝 구간)만 바뀔 수 있다
  assert.deepEqual(after.slice(0, stable), before.slice(0, stable));
});

test("지나온 경로는 시작점부터 지정한 거리 지점까지다", () => {
  const behind = routeBehind(route, 150);
  assert.deepEqual(behind.slice(0, 2), route.slice(0, 2));
  near(behind.at(-1)[1], 37.50135, 0.00002);
  assert.deepEqual(routeBehind(route, 0), []);
});
