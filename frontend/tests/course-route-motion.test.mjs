import assert from 'node:assert/strict';
import test from 'node:test';
import {
  arrowSamples,
  buildRouteMetrics,
  interpolateBearing,
  sampleRouteAt,
  shortestBearingDelta,
} from '../src/utils/courseRouteMotion.ts';

const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance,
  `${actual} should be near ${expected}`);

test('이동은 불균등한 꼭짓점 개수가 아니라 누적 거리를 따른다', () => {
  const metrics = buildRouteMetrics([[0, 0], [0.1, 0], [2, 0]]);
  assert.equal(metrics.valid, true);
  assert.equal(metrics.closed, false);
  assert.equal(metrics.cumulativeMeters.length, 3);
  near(metrics.totalMeters, 222390.1604670658, 1e-6);
  const middle = sampleRouteAt(metrics, metrics.totalMeters / 2);
  near(middle.coordinate[0], 1);
  near(middle.coordinate[1], 0);
  near(middle.bearing, 90);
});

test('연속 중복 좌표를 보존하면서 시작·끝과 다음 유효 구간 방향을 계산한다', () => {
  const coordinates = [[0, 0], [0, 0], [1, 0], [1, 0], [1, 1], [1, 1]];
  const metrics = buildRouteMetrics(coordinates);
  assert.deepEqual(metrics.coordinates, coordinates);
  assert.deepEqual(sampleRouteAt(metrics, -Infinity), { coordinate: [0, 0], bearing: 90 });
  near(sampleRouteAt(metrics, metrics.cumulativeMeters[2]).bearing, 0);
  assert.deepEqual(sampleRouteAt(metrics, Infinity), { coordinate: [1, 1], bearing: 0 });
  assert.equal(sampleRouteAt(metrics, NaN), null);
});

test('왕복 경로의 되돌아오는 구간을 유지하고 같은 위치의 화살표는 중복하지 않는다', () => {
  const metrics = buildRouteMetrics([[0, 0], [2, 0], [0, 0]]);
  assert.equal(metrics.closed, true);
  near(sampleRouteAt(metrics, metrics.totalMeters * 0.75).bearing, 270);
  assert.equal(arrowSamples(metrics).length, 2);
  assert.deepEqual(arrowSamples(metrics).map(({ coordinate }) => coordinate), [[1, 0], [2, 0]]);
  assert.deepEqual(sampleRouteAt(metrics, metrics.totalMeters).coordinate, [0, 0]);
});

test('폐합은 정확히 같은 시작·끝만 판단하고 임의의 거리 기준을 사용하지 않는다', () => {
  assert.equal(buildRouteMetrics([[127, 37], [128, 38], [127, 37]]).closed, true);
  assert.equal(buildRouteMetrics([[127, 37], [128, 38], [127.000000001, 37]]).closed, false);
  assert.equal(buildRouteMetrics([[180, 0], [179, 1], [-180, 0]]).closed, true);
});

test('날짜변경선을 가로지르는 짧은 원본 구간을 보간한다', () => {
  const metrics = buildRouteMetrics([[179, 0], [-179, 0]]);
  near(metrics.totalMeters, 222390.1604670658, 1e-6);
  const middle = sampleRouteAt(metrics, metrics.totalMeters / 2);
  near(Math.abs(middle.coordinate[0]), 180);
  near(middle.bearing, 90);
  assert.deepEqual(sampleRouteAt(metrics, metrics.totalMeters).coordinate, [-179, 0]);
});

test('유효하지 않은 좌표와 길이 0인 경로에서는 미리보기나 화살표를 만들지 않는다', () => {
  for (const coordinates of [null, [], [[127, 37]], [[127, 37], [127, 37]],
    [[127, 37], [Infinity, 38]], [[127, 37], [127, NaN]], [[181, 37], [127, 38]],
    [[127, 91], [127, 38]], [[127, 37, 10], [127, 38]], [[127, 37], null]]) {
    const metrics = buildRouteMetrics(coordinates);
    assert.equal(metrics.valid, false);
    assert.equal(sampleRouteAt(metrics, 0), null);
    assert.deepEqual(arrowSamples(metrics), []);
  }
  const metrics = buildRouteMetrics([[127, 37], [128, 38]]);
  for (const count of [0, -1, 1.5, Infinity, NaN]) assert.deepEqual(arrowSamples(metrics, count), []);
});

test('원본 좌표를 수정하거나 반환 좌표와 원본 참조를 공유하지 않는다', () => {
  const points = Object.freeze([Object.freeze([127, 37]), Object.freeze([128, 38])]);
  const metrics = buildRouteMetrics(points);
  assert.deepEqual(metrics.coordinates, points);
  assert.notEqual(metrics.coordinates, points);
  assert.notEqual(metrics.coordinates[0], points[0]);
  sampleRouteAt(metrics, 0).coordinate[0] = 0;
  assert.equal(metrics.coordinates[0][0], 127);
  assert.equal(points[0][0], 127);
});

test('카메라 방향은 360도 경계를 넘어 가장 짧은 각도로 보간한다', () => {
  near(shortestBearingDelta(350, 10), 20);
  near(shortestBearingDelta(10, 350), -20);
  near(interpolateBearing(350, 10, 0.5), 0);
  near(interpolateBearing(10, 350, 0.5), 0);
  near(interpolateBearing(350, 10, -1), 350);
  near(interpolateBearing(350, 10, 2), 10);
});
