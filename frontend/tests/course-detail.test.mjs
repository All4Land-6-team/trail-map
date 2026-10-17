import assert from 'node:assert/strict';
import test from 'node:test';
import { coordinateAlongRoute, nearestProfileIndex, selectCourseSpots, SPOT_CATEGORIES, toggleProfileMetric } from '../src/utils/courseProfile.ts';
import { courseDetailPath, readCourseDetailView } from '../src/routes/courseDetailRoutes.ts';
import { coursePaths, readCourseRoute } from '../src/routes/courseRoutes.ts';

test('그래프 선택은 가장 가까운 샘플과 양 끝 경계를 사용한다', () => {
  const samples = [0, 1, 2.4, 4.2].map(distanceKm => ({ distanceKm }));
  assert.equal(nearestProfileIndex(samples, -10), 0);
  assert.equal(nearestProfileIndex(samples, 100), 3);
  assert.equal(nearestProfileIndex(samples, 2.4), 2);
  assert.equal(nearestProfileIndex(samples, 0.5), 0);
  assert.equal(nearestProfileIndex(samples, 1.8), 2);
  assert.equal(nearestProfileIndex(samples, NaN), 0);
  assert.equal(nearestProfileIndex([], 1), -1);
});
test('지도 좌표는 선분 개수가 아닌 누적 길이에 따라 보간하고 원본을 보존한다', () => {
  const route = [[0, 0], [1, 0], [4, 0]];
  assert.deepEqual(coordinateAlongRoute(route, 0.5), [2, 0]);
  assert.deepEqual(coordinateAlongRoute(route, -1), [0, 0]);
  assert.deepEqual(coordinateAlongRoute(route, 2), [4, 0]);
  assert.deepEqual(route, [[0, 0], [1, 0], [4, 0]]);
});
test('누락·단일·중복 좌표에서도 지도 보간값이 유효하다', () => {
  assert.equal(coordinateAlongRoute([], 0.5), null);
  assert.deepEqual(coordinateAlongRoute([[127, 37]], 0.5), [127, 37]);
  assert.deepEqual(coordinateAlongRoute([[127, 37], [127, 37]], 0.5), [127, 37]);
  assert.deepEqual(coordinateAlongRoute([[0, 0], [0, 0], [2, 0]], 0.5), [1, 0]);
  assert.deepEqual(coordinateAlongRoute([[0, 0], [2, 0]], NaN), [0, 0]);
});
test('거리별 읽기 값과 지도 강조는 선택한 동일 샘플을 참조한다', () => {
  const route = [[127, 37], [127.04, 37]];
  const samples = [0, 1, 2, 4].map(distanceKm => ({ distanceKm, coordinate: coordinateAlongRoute(route, distanceKm / 4) }));
  const index = nearestProfileIndex(samples, 1.9);
  assert.equal(samples[index].distanceKm, 2);
  assert.ok(Math.abs(samples[index].coordinate[0] - 127.02) < 1e-9);
  assert.equal(samples[index].coordinate[1], 37);
});
test('고도·경사도는 개별 전환하며 마지막 항목 해제를 거부한다', () => {
  const both = { elevation: true, slope: true };
  const onlyElevation = toggleProfileMetric(both, 'slope');
  assert.deepEqual(onlyElevation, { elevation: true, slope: false });
  assert.equal(toggleProfileMetric(onlyElevation, 'elevation'), onlyElevation);
  assert.deepEqual(toggleProfileMetric(onlyElevation, 'slope'), both);
  const onlySlope = toggleProfileMetric(both, 'elevation');
  assert.equal(toggleProfileMetric(onlySlope, 'slope'), onlySlope);
  assert.deepEqual(both, { elevation: true, slope: true });
});
test('스팟 카테고리와 통제정보의 마커 없는 상태를 구분한다', () => {
  const spots = ['shelter', 'shelter', 'water', 'restroom', 'photo', 'photo'].map((kind, id) => ({ id, kind }));
  assert.equal(selectCourseSpots(spots, 'all').length, 6);
  assert.equal(selectCourseSpots(spots, 'shelter').length, 2);
  assert.equal(selectCourseSpots(spots, 'water').length, 1);
  assert.equal(selectCourseSpots(spots, 'restroom').length, 1);
  assert.equal(selectCourseSpots(spots, 'photo').length, 2);
  assert.equal(selectCourseSpots(spots, 'control').length, 0);
  assert.equal(spots.length, 6);
  assert.equal(new Set(SPOT_CATEGORIES.map(item => item.value)).size, 6);
});
test('스팟 후기 복귀 주소가 산·코스·카테고리·선택 ID를 보존한다', () => {
  const request = { mountainId: '산/1', courseId: '코스 2' };
  const view = { tab: 'spots', category: 'water', spotId: '물/1' };
  const path = courseDetailPath(request, view);
  assert.deepEqual(readCourseDetailView('#' + path), view);
  assert.deepEqual(readCourseRoute('#' + path), { ...request, destination: 'detail' });
  assert.deepEqual(readCourseDetailView('#x?tab=unknown&category=unknown'), { tab: 'analysis', category: 'all' });
  assert.deepEqual(readCourseDetailView('#x'), { tab: 'analysis', category: 'all' });
  assert.equal(readCourseDetailView(courseDetailPath(request, { tab: 'analysis', category: 'water' })).tab, 'analysis');
  assert.equal(readCourseRoute(coursePaths.list(request.mountainId, request.courseId)).selectedCourseId, request.courseId);
});
